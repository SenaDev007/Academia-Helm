/**
 * ============================================================================
 * RECEIPT FINANCE SERVICE — Génération PDF de reçus pour FinanceTransaction
 * ============================================================================
 *
 * Génère un PDF de reçu pour chaque encaissement (FinanceTransaction) :
 *   - Numéro de reçu format local : CSPEB-R-25-00001 (via MatriculeGeneratorService)
 *   - Date/heure automatiques (récupérées de la transaction)
 *   - PDF via PuppeteerPoolService (HTML inline → PDF A4)
 *   - Stockage : uploads/receipts/{tenantId}/{yearId}/receipt-{num}.pdf
 *   - Mise à jour de FinanceTransaction.receiptUrl
 *   - Notifications fire-and-forget : email (PDF en PJ), WhatsApp, SMS
 *
 * Pattern identique à receipt-generation.service.ts (Payment) mais adapté
 * pour FinanceTransaction (sous-module 3).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { MatriculeGeneratorService } from '../common/services/matricule-generator.service';
// ⭐ 2026-09-16 — Nom du trésorier (comptable / secrétaire-comptable paramétré
//    dans RH > Administration) + cachet comptable + signature — automatiques
import { DocumentSealsService } from '../settings/services/document-seals.service';
// ⭐ 2026-11-13 — Identité secondaire (écoles combinées) : helper partagé
//    d'override du branding pour les documents du niveau SECONDAIRE.
import {
  applyLevelIdentityOverlay,
  resolveLevelIdentityOverlay,
} from '../common/context/resolve-level-identity';

/**
 * ⭐ PERF 2026-09-16 — version de maquette du PDF de reçu (suffixe -vN dans le
 * nom de fichier) : incrémenter à chaque changement de mise en page (cachets,
 * piles verticales…) pour forcer UNE seule régénération puis re-cacher.
 */
const RECEIPT_CONTENT_VERSION = 2;

@Injectable()
export class ReceiptFinanceService {
  private readonly logger = new Logger(ReceiptFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly matriculeGenerator: MatriculeGeneratorService,
    private readonly configService: ConfigService,
    private readonly documentSealsService: DocumentSealsService,
  ) {}

  /**
   * Génère le numéro de reçu au format local : CSPEB-R-25-00001
   * (R = REC dans MatriculeGeneratorService)
   */
  async generateReceiptNumber(
    tenantId: string,
    academicYearId: string,
  ): Promise<{ local: string; global: string }> {
    const result = await this.matriculeGenerator.generate('REC', tenantId, academicYearId);
    return { local: result.local, global: result.global };
  }

  /**
   * Pipeline complet de génération de reçu PDF pour une FinanceTransaction.
   * 1. Récupère la transaction + élève + compte + allocations
   * 2. Génère le HTML du reçu
   * 3. Convertit en PDF via Puppeteer
   * 4. Stocke le fichier et met à jour receiptUrl
   * 5. Retourne le chemin + buffer pour notifications
   */
  async generateForTransaction(
    transactionId: string,
    tenantId: string,
  ): Promise<{ filePath: string; receiptUrl: string; pdfBuffer: Buffer }> {
    // ⭐ PERF 2026-09-16 — FAST PATH (cache disque versionné) : Visualiser /
    //    Télécharger / Envoyer par mail ne régénèrent PLUS le PDF à chaque
    //    clic — chaque consultation repartait d'un rendu Puppeteer complet
    //    (~2-5 s : requêtes DB + QR + logo via HTTP + networkidle0). Le reçu
    //    étant un document financier immuable (transaction verrouillée après
    //    clôture journalière), on sert le fichier déjà généré ; le suffixe
    //    -v{N} garantit qu'un changement de maquette régénère UNE fois puis
    //    re-cache les consultations suivantes (quasi instantanées).
    const cached = await this.tryServeCachedReceipt(transactionId, tenantId);
    if (cached) return cached;

    // 1. Charger la transaction avec toutes les infos nécessaires
    const tx = await this.prisma.financeTransaction.findUnique({
      where: { id: transactionId },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                matricule: true,
                studentGuardians: { include: { guardian: true } },
              },
            },
            breakdowns: { include: { feeStructure: true } },
          },
        },
        allocations: { include: { accountBreakdown: { include: { feeStructure: true } } } },
        cashRegister: { select: { code: true, name: true } },
      },
    });

    // Récupérer la classe de l'élève pour cette année
    let className = '—';
    let studentSchoolLevelId: string | null = null;
    if (tx?.studentAccount?.studentId && tx?.academicYearId) {
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId: tx.studentAccount.studentId, academicYearId: tx.academicYearId },
        // ⭐ 2026-09-16 — schoolLevelId ajouté (résolution du trésorier par niveau)
        select: {
          schoolLevelId: true,
          class: { select: { name: true, code: true } },
        },
      }).catch(() => null as any);
      className = enrollment?.class?.name || '—';
      studentSchoolLevelId = enrollment?.schoolLevelId || null;
    }

    if (!tx) {
      throw new Error(`Transaction ${transactionId} introuvable`);
    }

    // 1.bis Récupérer les arriérés (FeeArrear) ouverts pour cet élève
    // (toutes années confondues, OPEN ou PARTIALLY_PAID)
    const openArrears = tx.studentAccount?.studentId
      ? await this.prisma.feeArrear.findMany({
          where: {
            tenantId,
            studentId: tx.studentAccount.studentId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
            balanceDue: { gt: 0 },
          },
          include: {
            academicYear: { select: { name: true } },
          },
          orderBy: [{ academicYear: { startDate: 'asc' } }],
        })
      : [];

    // 1.ter Calculer la part du paiement appliquée aux arriérés (FIFO)
    // = total payé - somme des allocations aux AccountBreakdown de l'année en cours
    const totalAllocatedToBreakdowns = (tx.allocations || []).reduce(
      (sum: number, a: any) => sum + Number(a.amount ?? 0),
      0,
    );
    const amountAppliedToArrears = Math.max(0, Number(tx.amount) - totalAllocatedToBreakdowns);

    // ─── 1.quater Récupérer la ShopSale liée (multi-action : frais + boutique) ───
    // On cherche une ShopSale dont notes contient "MULTI_ACTION_TX:{transactionId}"
    // Si trouvée, on affichera une section "Articles Boutique" dans le reçu PDF.
    let linkedShopSale: any = null;
    try {
      linkedShopSale = await this.prisma.shopSale.findFirst({
        where: {
          tenantId,
          notes: { contains: `MULTI_ACTION_TX:${tx.id}` },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, code: true, imageUrl: true },
              },
            },
          },
        },
      });
      if (linkedShopSale) {
        this.logger.log(
          `Reçu multi-action: ShopSale ${linkedShopSale.saleNumber} liée à ${tx.receiptNumber} ` +
          `(${linkedShopSale.items?.length || 0} articles, ${Number(linkedShopSale.totalAmount)} FCFA)`,
        );
      }
    } catch (err: any) {
      // Non bloquant — si la table n'existe pas ou erreur, on continue sans boutique
      this.logger.warn(`Recherche ShopSale liée échouée (non bloquant): ${err.message}`);
    }

    // 2. Récupérer le branding de l'école + logo pour filigrane
    // ⭐ 2026-11-13 — Identité secondaire : si l'élève du reçu est du niveau
    //    SECONDAIRE et qu'une identité secondaire est configurée (école
    //    combinée), on override le branding (nom/contacts/logo). Overlay
    //    null (élève maternelle/primaire ou identité non configurée) →
    //    branding inchangé — zéro changement de comportement.
    let branding = await this.getTenantBranding(tenantId);
    if (studentSchoolLevelId) {
      const overlay = await resolveLevelIdentityOverlay(this.prisma, tenantId, {
        schoolLevelId: studentSchoolLevelId,
      }).catch(() => null);
      if (overlay) {
        branding = applyLevelIdentityOverlay(branding, overlay);
        // Projection sur les clés lues par buildReceiptHTML (schoolAddress /
        // schoolPhone / schoolEmail) + logo inline — le HTML n'est pas modifié.
        const merged: any = { ...branding };
        if (overlay.address) merged.schoolAddress = overlay.address;
        if (overlay.phonePrimary) merged.schoolPhone = overlay.phonePrimary;
        if (overlay.email) merged.schoolEmail = overlay.email;
        if (overlay.logoUrl) {
          // Même résolution inline que getTenantBranding (data-URL Puppeteer).
          merged.logoUrl = await this.resolveInlineLogo(overlay.logoUrl);
        }
        branding = merged;
      }
    }

    // 3. Calculer le solde restant à payer (totalDue - totalPaid APRES ce paiement)
    // tx.studentAccount.totalPaid et balance sont déjà mis à jour par le trigger SQL
    const totalDue = Number(tx.studentAccount?.totalDue ?? 0);
    const totalPaidAfter = Number(tx.studentAccount?.totalPaid ?? 0);
    const balanceAfter = Number(tx.studentAccount?.balance ?? 0);

    // Solde restant par frais (depuis les breakdowns)
    const breakdownsByType: Record<string, { due: number; paid: number; remaining: number; name?: string }> = {};
    for (const b of tx.studentAccount?.breakdowns ?? []) {
      const feeType = b.feeStructure?.feeType || 'OTHER';
      breakdownsByType[feeType] = {
        due: Number(b.initialAmount ?? 0),
        paid: Number(b.paidAmount ?? 0),
        remaining: Number(b.remainingAmount ?? 0),
        name: b.feeStructure?.name,
      };
    }

    // Total arriérés encore dus (somme des balanceDue des FeeArrear ouverts)
    const totalArrearsRemaining = openArrears.reduce(
      (sum, a) => sum + Number(a.balanceDue ?? 0),
      0,
    );

    // 3. Générer le token de vérification (pour QR code)
    const verificationToken = this.generateVerificationToken(tx.id, tx.receiptNumber);

    // 4. Générer le QR code en data URL
    const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
    const verifyUrl = `${publicUrl}/api/receipt/verify?token=${verificationToken}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });

    // ⭐ 4.bis 2026-09-16 — TRÉSORIER (comptable / secrétaire-comptable) :
    //    résolution dynamique du titulaire paramétré dans RH > Administration
    //    (staff_admin_assignements — par niveau : maternelle / primaire /
    //    secondaire), + cachet nominatif + signature. Même moteur de génération
    //    que le module Personnel. Non bloquant : sans cachet si échec.
    let treasurer: any = null;
    try {
      treasurer = await this.documentSealsService.getAccountantSeals(
        tenantId, studentSchoolLevelId,
      );
    } catch {
      treasurer = null;
    }

    // 5. Construire le HTML du reçu
    const html = this.buildReceiptHTML({
      tx,
      branding,
      qrCodeDataUrl,
      verificationToken,
      totalDue,
      totalPaidAfter,
      balanceAfter,
      breakdownsByType,
      className,
      openArrears,
      amountAppliedToArrears,
      totalArrearsRemaining,
      linkedShopSale,
      treasurer,
    });

    // 6. Convertir en PDF via Puppeteer
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      // ⭐ PERF 2026-09-16 — domcontentloaded + court délai (pattern bulletin) :
      //    toutes les images (QR, cachets, signature, logo, filigrane) sont
      //    désormais des data-URL inline — plus AUCUN trafic réseau à attendre,
      //    networkidle0 faisait perdre 1-2 s par reçu.
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 300));
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      // Puppeteer v25 retourne Uint8Array — convertir en Buffer
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

      // 7. Stocker le fichier (suffixe -v{N} = version de maquette)
      const yearDir = tx.academicYearId;
      const dir = path.join(process.cwd(), 'uploads', 'receipts', tenantId, yearDir);
      fs.mkdirSync(dir, { recursive: true });
      const fileName = this.receiptFileName(tx.receiptNumber);
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buf);
      // Nettoyage best-effort des versions de maquette antérieures du même reçu
      try {
        const prefix = `receipt-${String(tx.receiptNumber || 'x').replace(/[/\\?%*:|"<>]/g, '-')}-`;
        for (const f of fs.readdirSync(dir)) {
          if (f.startsWith(prefix) && f !== fileName && /-v\d+\.pdf$/.test(f)) {
            fs.unlinkSync(path.join(dir, f));
          }
        }
      } catch {}

      // 8. URL publique (servie par /api/receipts/{filename})
      const receiptUrl = `${publicUrl}/api/finance/transactions/${tx.id}/receipt.pdf`;

      // 9. Mettre à jour la transaction avec receiptUrl
      // ⭐ FIX 2026-09-16 — l'écriture receiptUrl ne doit JAMAIS faire échouer
      //    la génération/consultation d'un reçu : le trigger SQL
      //    lock_transaction_after_closure refuse tout UPDATE d'une transaction
      //    dont la journée est clôturée (clôture de caisse), ce qui renvoyait
      //    un 500 « Reçu introuvable » sur Visualiser / Télécharger / Email
      //    d'un encaissement déjà clôturé. L'URL étant déterministe
      //    ({publicUrl}/api/finance/transactions/{id}/receipt.pdf), on ne
      //    persiste que si la valeur change réellement, et en mode dégradé
      //    silencieux (warning) — le PDF reste généré et servi normalement.
      if ((tx.receiptUrl || '') !== receiptUrl) {
        await this.prisma.financeTransaction
          .update({ where: { id: tx.id }, data: { receiptUrl } })
          .catch((err: any) => {
            const msg = String(err?.message || '');
            if (msg.includes('Transaction locked after daily closure')) {
              this.logger.warn(
                `Reçu ${tx.receiptNumber} : receiptUrl non persisté (journée clôturée) — le PDF reste servi.`,
              );
            } else {
              this.logger.warn(`Reçu ${tx.receiptNumber} : receiptUrl non persisté (${msg}).`);
            }
          });
      }

      this.logger.log(`Reçu généré: ${tx.receiptNumber} → ${filePath}`);

      return { filePath, receiptUrl, pdfBuffer: buf };
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Construit le HTML du reçu (style institutionnel, A4).
   */
  private buildReceiptHTML(params: {
    tx: any;
    branding: any;
    qrCodeDataUrl: string;
    verificationToken: string;
    totalDue: number;
    totalPaidAfter: number;
    balanceAfter: number;
    breakdownsByType: Record<string, { due: number; paid: number; remaining: number; name?: string }>;
    className?: string;
    openArrears?: any[];
    amountAppliedToArrears?: number;
    totalArrearsRemaining?: number;
    linkedShopSale?: any;
    // ⭐ 2026-09-16 — Trésorier résolu dynamiquement (RH > Administration) :
    //    nom + cachet nominatif + signature (peut être null)
    treasurer?: any;
  }): string {
    const { tx, branding, qrCodeDataUrl, verificationToken, totalDue, totalPaidAfter, balanceAfter, breakdownsByType, className, openArrears = [], amountAppliedToArrears = 0, totalArrearsRemaining = 0, linkedShopSale = null, treasurer = null } = params;
    const student = tx.studentAccount?.student;
    const studentName = student ? `${student.lastName} ${student.firstName}` : '—';
    const matricule = student?.matricule || '—';
    const studentClass = className || '—';
    const dateOp = new Date(tx.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const heureOp = new Date(tx.createdAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Détail des allocations (par frais) — uniquement les allocations aux
    // AccountBreakdown de l'année en cours (les arriérés sont affichés séparément)
    const allocationsRows = (tx.allocations || [])
      .map(
        (a: any) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">
            ${a.accountBreakdown?.feeStructure?.name || a.accountBreakdown?.feeStructure?.feeType || '—'}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${Number(a.amount).toLocaleString('fr-FR')} FCFA
          </td>
        </tr>`,
      )
      .join('');

    // Ligne "Arriérés antérieurs (FIFO)" si une partie du paiement y a été appliquée
    const fifoRow = amountAppliedToArrears > 0
      ? `<tr style="background: #fef3c7;">
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #92400e; font-weight: 600;">
            📅 Arriérés antérieurs (règlement FIFO)
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #92400e; font-weight: 600;">
            ${amountAppliedToArrears.toLocaleString('fr-FR')} FCFA
          </td>
        </tr>`
      : '';

    const methodLabels: Record<string, string> = {
      CASH: 'Espèces',
      MOBILE_MONEY: 'Mobile Money',
      WIRE: 'Virement bancaire',
      FEDAPAY: 'Fedapay',
    };

    // Libellés des types de frais
    const feeTypeLabels: Record<string, string> = {
      INSCRIPTION: 'Inscription',
      REINSCRIPTION: 'Réinscription',
      TUITION: 'Scolarité',
      CANTEEN: 'Cantine',
      EXAMEN: 'Frais d\'examen',
      GENERAL: 'Frais généraux',
      OTHER: 'Autre',
    };

    // Lignes de solde par frais (pour la section "Solde restant à payer")
    const balanceRows = Object.entries(breakdownsByType)
      .filter(([, v]) => v.due > 0)
      .map(([type, v]) => {
        const label = feeTypeLabels[type] || v.name || type;
        const remaining = Math.max(0, v.remaining);
        const statusColor = remaining <= 0 ? '#16a34a' : '#dc2626';
        const statusText = remaining <= 0 ? 'Soldé' : 'À payer';
        return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${label}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${v.due.toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${v.paid.toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${statusColor}; font-weight: 700;">
            ${remaining.toLocaleString('fr-FR')} FCFA
            <span style="font-size: 9px; font-weight: 400; display: block;">(${statusText})</span>
          </td>
        </tr>`;
      })
      .join('');

    // Logo filigrane (si disponible)
    const logoWatermark = branding.logoUrl
      ? `<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); z-index: 0; opacity: 0.06; pointer-events: none;">
           <img src="${branding.logoUrl}" alt="logo" style="width: 350px; height: auto;" />
         </div>`
      : '';

    // Logo en header (si disponible)
    const logoHeader = branding.logoUrl
      ? `<img src="${branding.logoUrl}" alt="logo" style="width: 60px; height: 60px; object-fit: contain; margin-right: 12px;" />`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu ${tx.receiptNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; }
    .school-block { flex: 1; }
    .school-name { font-size: 20px; font-weight: 700; color: #1e293b; }
    .school-info { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
    .receipt-meta { text-align: right; }
    .receipt-title { font-size: 18px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-number { font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 4px; font-family: 'Courier New', monospace; }
    .receipt-date { font-size: 11px; color: #64748b; margin-top: 2px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px; }
    .info-item { display: flex; }
    .info-label { color: #64748b; min-width: 110px; }
    .info-value { font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; padding: 8px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; }
    .total-row { background: #f8fafc; font-weight: 700; }
    .total-row td { padding: 10px 8px; border-top: 2px solid #4f46e5; font-size: 14px; }
    .total-row .amount { color: #4f46e5; text-align: right; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    .qr-block { text-align: center; }
    .qr-block img { width: 90px; height: 90px; }
    .qr-label { font-size: 9px; color: #64748b; margin-top: 4px; }
    .stamp { text-align: right; font-size: 11px; color: #64748b; }
    .stamp-line { margin-top: 24px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
    .verification-info { margin-top: 16px; padding: 8px; background: #f8fafc; border-radius: 4px; font-size: 9px; color: #64748b; text-align: center; }
    .balance-summary { margin-top: 18px; padding: 12px; border-radius: 8px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; }
    .balance-summary-title { font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; margin-bottom: 8px; }
    .balance-total { font-size: 18px; font-weight: 700; color: #92400e; text-align: center; padding: 8px 0; }
    .content { position: relative; z-index: 1; }
  </style>
</head>
<body>
  ${logoWatermark}
  <div class="content">
  <div class="header">
    <div style="display: flex; align-items: center;">
      ${logoHeader}
      <div class="school-block">
        <div class="school-name">${branding.schoolName || 'Établissement'}</div>
        <div class="school-info">
          ${branding.schoolAddress || ''}<br>
          ${branding.schoolPhone ? 'Tél : ' + branding.schoolPhone : ''} ${branding.schoolEmail ? ' · ' + branding.schoolEmail : ''}
        </div>
      </div>
    </div>
    <div class="receipt-meta">
      <div class="receipt-title">Reçu de paiement</div>
      <div class="receipt-number">N° ${tx.receiptNumber}</div>
      <div class="receipt-date">${dateOp} à ${heureOp}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Élève</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nom :</span><span class="info-value">${studentName}</span></div>
      <div class="info-item"><span class="info-label">Matricule :</span><span class="info-value">${matricule}</span></div>
      <div class="info-item"><span class="info-label">Classe :</span><span class="info-value">${studentClass}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Détail du paiement</div>
    <table>
      <thead>
        <tr>
          <th>Frais</th>
          <th style="text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${allocationsRows || `<tr><td colspan="2" style="padding: 8px; text-align: center; color: #94a3b8;">Paiement global (non imputé par frais)</td></tr>`}
        ${fifoRow}
        <tr class="total-row">
          <td>TOTAL Frais scolaires</td>
          <td class="amount">${Number(tx.amount).toLocaleString('fr-FR')} FCFA</td>
        </tr>
      </tbody>
    </table>
    ${amountAppliedToArrears > 0 ? `
    <p style="margin-top: 8px; padding: 6px 10px; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 10px; color: #92400e; line-height: 1.5;">
      <strong>ℹ️ Règlement FIFO :</strong> Conformément à la politique de l'établissement, <strong>${amountAppliedToArrears.toLocaleString('fr-FR')} FCFA</strong> ont été affectés en priorité au règlement des arriérés des années antérieures. Le reste (${(Number(tx.amount) - amountAppliedToArrears).toLocaleString('fr-FR')} FCFA) a été imputé aux frais de l'année en cours.
    </p>` : ''}
  </div>

  ${linkedShopSale ? `
  <!-- Section Articles Boutique (multi-action) -->
  <div class="section">
    <div class="section-title" style="color: #7c3aed;">🛍️ Articles Boutique — Vente ${linkedShopSale.saleNumber}</div>
    <table>
      <thead>
        <tr style="background: #f5f3ff;">
          <th style="color: #6d28d9;">Article</th>
          <th style="text-align: center; color: #6d28d9;">Qté</th>
          <th style="text-align: right; color: #6d28d9;">Prix unitaire</th>
          <th style="text-align: right; color: #6d28d9;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${(linkedShopSale.items || []).map((item: any) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ede9fe;">
            ${item.product?.name || 'Article supprimé'}
            ${item.product?.code ? `<span style="font-size: 9px; color: #94a3b8; margin-left: 6px;">(${item.product.code})</span>` : ''}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ede9fe; text-align: center;">${item.quantity}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ede9fe; text-align: right;">${Number(item.unitPrice).toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ede9fe; text-align: right; font-weight: 600;">${Number(item.totalPrice).toLocaleString('fr-FR')} FCFA</td>
        </tr>`).join('')}
        <tr class="total-row" style="background: #f5f3ff;">
          <td colspan="3" style="color: #6d28d9;">TOTAL Articles boutique</td>
          <td class="amount" style="color: #7c3aed;">${Number(linkedShopSale.totalAmount).toLocaleString('fr-FR')} FCFA</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Récapitulatif Global : Frais + Boutique -->
  <div class="section" style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border: 2px solid #7c3aed; border-radius: 8px; padding: 16px; margin-top: 12px;">
    <div style="font-size: 12px; font-weight: 700; color: #5b21b6; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
      🧾 Récapitulatif Global — Multi-opération
    </div>
    <table style="font-size: 13px;">
      <tbody>
        <tr>
          <td style="padding: 6px 0; color: #4c1d95;">Frais scolaires</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #4c1d95;">${Number(tx.amount).toLocaleString('fr-FR')} FCFA</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #4c1d95;">Articles boutique</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #4c1d95;">${Number(linkedShopSale.totalAmount).toLocaleString('fr-FR')} FCFA</td>
        </tr>
        <tr style="border-top: 2px solid #7c3aed;">
          <td style="padding: 10px 0; font-weight: 700; font-size: 15px; color: #5b21b6;">TOTAL ENCAISSÉ</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 800; font-size: 16px; color: #5b21b6;">${(Number(tx.amount) + Number(linkedShopSale.totalAmount)).toLocaleString('fr-FR')} FCFA</td>
        </tr>
        ${tx.paymentMethod === 'CASH' && tx.tenderedAmount != null ? `
        <tr>
          <td style="padding: 6px 0; color: #4c1d95; font-size: 12px;">Montant remis en espèces</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #4c1d95; font-size: 12px;">${Number(tx.tenderedAmount).toLocaleString('fr-FR')} FCFA</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #059669; font-size: 12px; font-weight: 600;">Reliquat rendu au client</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #059669; font-size: 12px;">${Number(tx.changeGiven ?? 0).toLocaleString('fr-FR')} FCFA</td>
        </tr>
        ` : ''}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Mode de paiement :</span><span class="info-value">${methodLabels[tx.paymentMethod] || tx.paymentMethod}</span></div>
      <div class="info-item"><span class="info-label">Référence :</span><span class="info-value">${tx.reference || '—'}</span></div>
      ${tx.cashRegister ? `<div class="info-item"><span class="info-label">Caisse :</span><span class="info-value">${tx.cashRegister.code} — ${tx.cashRegister.name}</span></div>` : ''}
      ${tx.cashRegister?.code === 'FONDE' ? `<div class="info-item" style="grid-column: 1 / -1;"><span class="info-label" style="color: #92400e; font-weight: 700;">⚠ Reçu directement par le promoteur/fondateur</span><span class="info-value"></span></div>` : ''}
      ${tx.paymentMethod === 'CASH' && tx.tenderedAmount != null ? `
        <div class="info-item"><span class="info-label">Montant remis :</span><span class="info-value" style="font-weight: 700;">${Number(tx.tenderedAmount).toLocaleString('fr-FR')} FCFA</span></div>
        <div class="info-item"><span class="info-label">Reliquat rendu :</span><span class="info-value" style="font-weight: 700; color: #059669;">${Number(tx.changeGiven ?? 0).toLocaleString('fr-FR')} FCFA</span></div>
      ` : ''}
    </div>
  </div>

  <!-- Section Solde restant à payer -->
  ${balanceRows ? `
  <div class="section">
    <div class="section-title">Situation du compte — Solde restant à payer</div>
    <table>
      <thead>
        <tr>
          <th>Frais</th>
          <th style="text-align: right;">Dû</th>
          <th style="text-align: right;">Payé</th>
          <th style="text-align: right;">Reste à payer</th>
        </tr>
      </thead>
      <tbody>
        ${balanceRows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align: right;">${totalDue.toLocaleString('fr-FR')} FCFA</td>
          <td style="text-align: right;">${totalPaidAfter.toLocaleString('fr-FR')} FCFA</td>
          <td class="amount" style="color: ${balanceAfter <= 0 ? '#16a34a' : '#dc2626'};">
            ${Math.max(0, balanceAfter).toLocaleString('fr-FR')} FCFA
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  ${balanceAfter > 0 ? `
  <div class="balance-summary">
    <div class="balance-summary-title">💡 Solde restant à payer</div>
    <div class="balance-total">${balanceAfter.toLocaleString('fr-FR')} FCFA</div>
    <p style="text-align: center; font-size: 11px; color: #92400e; margin-top: 4px;">
      Merci de régulariser ce montant auprès de l'établissement.
    </p>
  </div>
  ` : `
  <div class="balance-summary" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-color: #10b981;">
    <div class="balance-summary-title" style="color: #065f46;">✅ Compte soldé</div>
    <div class="balance-total" style="color: #065f46;">Aucun solde restant</div>
    <p style="text-align: center; font-size: 11px; color: #065f46; margin-top: 4px;">
      Toutes les frais de l'année ont été réglés. Merci !
    </p>
  </div>
  `}
  ` : ''}

  <!-- Section Arriérés antérieurs (si l'élève a des arriérés ouverts) -->
  ${openArrears.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color: #b45309;">📅 Arriérés antérieurs en cours</div>
    <table>
      <thead>
        <tr style="background: #fef3c7;">
          <th style="color: #92400e;">Année scolaire</th>
          <th style="text-align: right; color: #92400e;">Montant dû</th>
          <th style="text-align: right; color: #92400e;">Déjà payé</th>
          <th style="text-align: right; color: #92400e;">Reste à payer</th>
        </tr>
      </thead>
      <tbody>
        ${openArrears.map((arrear: any) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #fde68a;">${arrear.academicYear?.name || '—'}${arrear.notes ? `<br><span style="font-size: 9px; color: #94a3b8;">${arrear.notes}</span>` : ''}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #fde68a; text-align: right;">${Number(arrear.totalDue).toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #fde68a; text-align: right; color: #059669;">${Number(arrear.totalPaid).toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #fde68a; text-align: right; color: #dc2626; font-weight: 700;">${Number(arrear.balanceDue).toLocaleString('fr-FR')} FCFA</td>
        </tr>`).join('')}
        <tr class="total-row" style="background: #fef3c7;">
          <td style="color: #92400e;">TOTAL arriérés</td>
          <td colspan="2" style="text-align: right; color: #92400e;"></td>
          <td class="amount" style="color: #b45309; text-align: right;">${totalArrearsRemaining.toLocaleString('fr-FR')} FCFA</td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top: 8px; padding: 8px 10px; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 10px; color: #92400e; line-height: 1.5;">
      <strong>⚠️ Information :</strong> Cet élève présente des arriérés des années antérieures non réglés.
      Conformément à la politique de l'établissement (règle FIFO), tout nouveau paiement sera affecté
      en priorité à ces arriérés avant les frais de l'année en cours.
    </p>
  </div>` : ''}

  <div class="footer">
    <div class="qr-block">
      <img src="${qrCodeDataUrl}" alt="QR vérification" />
      <div class="qr-label">Scannez pour vérifier l'authenticité</div>
    </div>
    <div class="stamp">
      ${treasurer?.holderName ? `
      <div style="font-weight:700;">${treasurer.holderRole || 'Le Trésorier'}</div>
      <div style="width:190px;margin:3px auto 0;text-align:center;line-height:0;">
        ${treasurer.signatureDataUrl ? `<img src="${treasurer.signatureDataUrl}" style="display:block;margin:0 auto 2px;max-height:44px;max-width:85%;object-fit:contain;z-index:2;" />` : ''}
        ${treasurer.nominativeCircularDataUrl ? `<img src="${treasurer.nominativeCircularDataUrl}" style="display:block;margin:0 auto;height:80px;width:80px;object-fit:contain;opacity:0.92;" />` : ''}
        ${treasurer.nominativeRectangularDataUrl ? `<img src="${treasurer.nominativeRectangularDataUrl}" style="display:block;margin:2px auto 0;max-height:34px;max-width:106px;object-fit:contain;opacity:0.95;" />` : ''}
      </div>` : `
      <div>Le comptable</div>
      <div class="stamp-line">Signature &amp; cachet</div>`}
    </div>
  </div>

  <div class="verification-info">
    Reçu généré électroniquement le ${dateOp} à ${heureOp} ·
    Ce document est authentique et ne peut être modifié.
  </div>
  </div>
</body>
</html>`;
  }

  /**
   * Génère un token de vérification HMAC-SHA256 (pour QR code public).
   */
  private generateVerificationToken(transactionId: string, receiptNumber: string): string {
    const crypto = require('crypto');
    const secret = this.configService.get<string>('RECEIPT_VERIFICATION_SECRET') || 'academia-helm-receipt-secret-2026';
    const data = `${transactionId}|${receiptNumber}`;
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }

  /**
   * Nom de fichier du PDF de reçu, suffixé par la version de maquette.
   */
  private receiptFileName(receiptNumber: string): string {
    const safe = String(receiptNumber || 'x').replace(/[/\\?%*:|"<>]/g, '-');
    return `receipt-${safe}-v${RECEIPT_CONTENT_VERSION}.pdf`;
  }

  /**
   * ⭐ PERF 2026-09-16 — Sert le PDF déjà généré SANS repasser par Puppeteer.
   * Retourne null si le PDF de la version de maquette courante est absent
   * (l'appelant régénère alors une fois puis re-cache). NB : on ne teste PAS
   * tx.receiptUrl — pour les journées clôturées ce champ peut rester null à
   * vie (trigger lock) alors que le fichier v{N} existe bien sur le disque.
   */
  private async tryServeCachedReceipt(
    transactionId: string,
    tenantId: string,
  ): Promise<{ filePath: string; receiptUrl: string; pdfBuffer: Buffer } | null> {
    try {
      const tx = await this.prisma.financeTransaction.findUnique({
        where: { id: transactionId },
        select: { receiptNumber: true, academicYearId: true },
      });
      if (!tx?.receiptNumber || !tx?.academicYearId) return null;
      const filePath = path.join(
        process.cwd(), 'uploads', 'receipts', tenantId, tx.academicYearId,
        this.receiptFileName(tx.receiptNumber),
      );
      if (!fs.existsSync(filePath)) return null;
      const pdfBuffer = fs.readFileSync(filePath);
      const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
      this.logger.log(`Reçu ${tx.receiptNumber} servi depuis le cache disque (v${RECEIPT_CONTENT_VERSION})`);
      return {
        filePath,
        receiptUrl: `${publicUrl}/api/finance/transactions/${transactionId}/receipt.pdf`,
        pdfBuffer,
      };
    } catch {
      return null;
    }
  }

  /**
   * Récupère le branding de l'école (réutilise le pattern admission-notification).
   */
  async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });
      if (profile?.schoolName) {
        // ⭐ PERF 2026-09-16 — logo INLINE (data-URL) : l'URL HTTP
        //    /api/tenants/{id}/logo forçait un aller-retour réseau PENDANT le
        //    rendu Puppeteer (networkidle0 l'attendait → +1-2 s par reçu).
        //    data-URL → servi tel quel ; http(s) → fetch + base64 (fallback :
        //    URL brute) ; chemin fichier → lecture disque + base64.
        const logoUrl = await this.resolveInlineLogo(profile.logoUrl);

        return {
          schoolName: profile.schoolName,
          logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return { schoolName: tenant?.name || 'Établissement' };
    } catch {
      return { schoolName: 'Établissement' };
    }
  }

  /**
   * ⭐ PERF 2026-09-16 — Résout le logo en data-URL inline pour le HTML
   * Puppeteer (aucune requête réseau pendant le rendu). Best-effort :
   * renvoie la valeur brute en cas d'échec.
   */
  private async resolveInlineLogo(raw: string | null | undefined): Promise<string | null> {
    if (!raw) return null;
    if (raw.startsWith('data:')) return raw;
    try {
      if (/^https?:\/\//.test(raw)) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        try {
          const r = await fetch(raw, { signal: ctrl.signal });
          if (r.ok) {
            const ct = r.headers.get('content-type') || 'image/png';
            const buf = Buffer.from(await r.arrayBuffer());
            return `data:${ct};base64,${buf.toString('base64')}`;
          }
        } finally {
          clearTimeout(timer);
        }
        return raw; // fallback : laisser le navigateur la charger
      }
      // Chemin fichier relatif (uploads/…)
      const abs = path.join(process.cwd(), String(raw).replace(/^\/+/, ''));
      const buf = await fs.promises.readFile(abs);
      const ext = path.extname(abs).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
      return `data:image/${mime};base64,${buf.toString('base64')}`;
    } catch {
      return raw;
    }
  }

  /**
   * Récupère les contacts (email/téléphone) du parent principal d'un élève.
   */
  async getParentContacts(studentId: string): Promise<{ email?: string; phone?: string; name?: string }> {
    const sgs = await this.prisma.studentGuardian.findMany({
      where: { studentId, isPrimary: true },
      include: { guardian: true },
      take: 1,
    });
    if (sgs.length === 0) {
      // Fallback : n'importe quel guardian
      const anySg = await this.prisma.studentGuardian.findFirst({
        where: { studentId },
        include: { guardian: true },
      });
      if (!anySg) return {};
      return {
        email: anySg.guardian?.email || undefined,
        phone: anySg.guardian?.phone || undefined,
        name: anySg.guardian ? `${anySg.guardian.firstName} ${anySg.guardian.lastName}` : undefined,
      };
    }
    const g = sgs[0].guardian;
    return {
      email: g?.email || undefined,
      phone: g?.phone || undefined,
      name: g ? `${g.firstName} ${g.lastName}` : undefined,
    };
  }
}
