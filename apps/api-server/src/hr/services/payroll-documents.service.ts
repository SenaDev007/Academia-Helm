/**
 * ============================================================================
 * PAYROLL DOCUMENTS SERVICE — Émission FP / EP (RH Bénin)
 * ============================================================================
 *
 * Couche DOCUMENTS du module de paie (au-dessus du moteur payroll-engine) :
 *
 *   FICHE_DE_PAIE    (FP-2026-000123) — salariés déclarés / non déclarés
 *   ETAT_DE_PAIEMENT (EP-2026-000045) — prestataires de services (AIB)
 *
 * Garanties structurelles :
 *   - Le type de document est TOUJOURS dérivé du statut contractuel
 *     (deriveDocumentPaieType) — jamais choisi par l'appelant.
 *   - Le document est un SNAPSHOT FIGÉ : les montants proviennent de la ligne
 *     de paie calculée (PayrollItem), le barème est celui en vigueur sur la
 *     période, et les cumuls annuels sont RECALCULÉS depuis les documents
 *     déjà émis (jamais stockés en incrément manuel).
 *   - IMMUABILITÉ : une ligne → au plus un document. Réémettre = 422.
 *     Le PDF est scellé par SHA-256 (contentHash) et archivé (StorageService
 *     R2/S3, repli /uploads local).
 *   - Numérotation séquentielle annuelle ATOMIQUE (UPSERT ... RETURNING sur
 *     payroll_document_sequences) — pas de doublon sous concurrence.
 *   - La prévisualisation passe par la MÊME construction de snapshot que
 *     l'émission (prévisu = émission, modulo numéro/hash/filigrane).
 * ============================================================================
 */

import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException,
} from '@nestjs/common';
// ⭐ 161 — règle fiscale Permanent/Vacataire (onglet CNSS) : la vue
//    « Vacataires » = prestataires + non déclarés CNSS.
import { fiscalStaffType } from '../taxes/services/payroll.service';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import { PayrollEngineService } from './payroll-engine.service';
import {
  deriveDocumentPaieType, CATEGORY_LABELS, categoryKeyFromRoleType,
} from './employment-contract-templates';
import {
  FichePaieSnapshot, EtatPaiementSnapshot, PayrollDocumentSnapshot,
  renderFicheDePaieHtml, renderEtatDePaiementHtml,
  monthLabel, joursOuvres, ancienneteLabel, computeConges, formatDocumentNumber,
  MENTION_FICHE_CONSERVATION, MENTION_ETAT_PAIEMENT,
} from './payroll-document-templates';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
// ⭐ 22/11/2026 — Notification in-app au personnel à l'émission de sa paie :
// chaque membre du personnel est notifié dans SON interface (cloche) avec le
// lien vers « Ma Paie » (module self-service de téléchargement FP/EP).
import { NotificationService } from '../../notifications/notification.service';
// ⭐ 22/11/2026 — identité par niveau : le personnel du SECONDAIRE reçoit
// l'identité du niveau secondaire (onglet Identité) sur ses documents de paie.
import { resolveLevelIdentityOverlay } from '../../common/context/resolve-level-identity';

const BLANK = '…à compléter';

@Injectable()
export class PayrollDocumentsService {
  private readonly logger = new Logger(PayrollDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
    private readonly payrollEngine: PayrollEngineService,
    private readonly notifications: NotificationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PRÉVISUALISATION (même construction que l'émission, sans numéro/hash)
  // ─────────────────────────────────────────────────────────────────────────

  async previewDocument(payrollItemId: string, tenantId: string) {
    const ctx = await this.loadContext(payrollItemId, tenantId);
    // ⭐ 162 — prévisualisation d'une ligne DÉJÀ ÉMISE : le VRAI numéro du
    //    document émis (FP-2026-000123) remplace le tampon « PROJET — NON ÉMIS »
    //    — l'aperçu d'une ligne émise est conforme au document scellé (même
    //    numéro, même QR) : le RH voit exactement le gabarit actuel.
    const snapshot = await this.buildSnapshot(ctx, {
      forIssue: false,
      documentNumber: ctx.existingDocument?.documentNumber ?? undefined,
    });
    const html =
      snapshot.kind === 'FICHE_DE_PAIE'
        ? renderFicheDePaieHtml(snapshot)
        : renderEtatDePaiementHtml(snapshot);
    return { snapshot, html, alreadyIssued: !!ctx.existingDocument };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉMISSION — immuable, numérotée, hachée, archivée
  // ─────────────────────────────────────────────────────────────────────────

  async issueDocument(payrollItemId: string, tenantId: string, user: any) {
    const ctx = await this.loadContext(payrollItemId, tenantId);

    if (ctx.existingDocument) {
      throw new ConflictException(
        `Un document de paie a déjà été émis pour cette ligne (${ctx.existingDocument.documentNumber}) — ` +
        `le document est immuable. Toute correction passe par un document rectificatif tracé.`,
      );
    }

    // 1. Allocation atomique du numéro (UPSERT RETURNING — pas de doublon sous concurrence)
    const documentType = ctx.documentType as 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT';
    const seq = await this.allocateSequence(tenantId, documentType, ctx.fiscalYear);
    const documentNumber = formatDocumentNumber(documentType, ctx.fiscalYear, seq);
    const issuedAt = new Date();

    // 2. Snapshot figé (avec numéro + émetteur)
    const snapshot = await this.buildSnapshot(ctx, {
      forIssue: true,
      documentNumber,
      issuedAt,
      issuedByName: user?.email || user?.fullName || user?.name || null,
    });

    // 3. Rendu PDF (Puppeteer — hors transaction DB, l'insertion reste atomique)
    const html =
      snapshot.kind === 'FICHE_DE_PAIE'
        ? renderFicheDePaieHtml(snapshot)
        : renderEtatDePaiementHtml(snapshot);
    const pdfBuffer = await this.renderPdf(html);
    const contentHash = createHash('sha256').update(pdfBuffer).digest('hex');

    // 4. Archivage (R2/S3, repli local)
    const filePath = await this.savePdf(tenantId, documentNumber, ctx, pdfBuffer);

    // 5. Insertion — contraintes uniques (payrollItemId, documentNumber) = verrous d'immuabilité
    try {
      const doc = await this.prisma.payrollDocument.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          academicYearId: ctx.item.academicYearId ?? null,
          staffId: ctx.staff.id,
          payrollItemId: ctx.item.id,
          documentType,
          documentNumber,
          periodYear: ctx.period.year,
          periodMonth: ctx.period.month,
          fiscalYear: ctx.fiscalYear,
          periodLabel: ctx.period.label,
          statutContractuel: ctx.statut,
          snapshot: snapshot as any,
          contentHash,
          filePath,
          issuedAt,
          issuedBy: user?.id ?? null,
          issuedByName: user?.email || user?.fullName || user?.name || null,
        },
      });
      this.logger.log(`📄 Document de paie émis : ${documentNumber} (${fmtHash(contentHash)})`);
      // ⭐ 22/11/2026 — Self-service paie : le personnel est NOTIFIÉ dans son
      // interface (cloche) dès que sa fiche de paie / son état de paiement est
      // émis — le PDF est téléchargeable depuis « Ma Paie » (best-effort : un
      // échec de notification n'annule jamais l'émission).
      this.notifyStaffDocumentIssued(doc, ctx, snapshot as any).catch(() => {});
      return { document: doc, pdfBase64: pdfBuffer.toString('base64'), contentHash };
    } catch (err: any) {
      // Collision d'unicité = émission concurrente de la même ligne
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Émission concurrente détectée : un document existe déjà pour cette ligne de paie.',
        );
      }
      // Nettoyage du fichier archivé si l'insertion échoue (pas de fichier orphelin)
      try {
        if (filePath && this.storageService.getStorageType() !== 'local') {
          await this.storageService.deleteFile(filePath);
        }
      } catch { /* best effort */ }
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRE & TÉLÉCHARGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async listDocuments(
    tenantId: string,
    filters: { periodYear?: number; periodMonth?: number; documentType?: string; staffId?: string },
  ) {
    return this.prisma.payrollDocument.findMany({
      where: {
        tenantId,
        ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
        ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
        ...(filters.documentType ? { documentType: filters.documentType } : {}),
        ...(filters.staffId ? { staffId: filters.staffId } : {}),
      },
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: true },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { documentNumber: 'desc' }],
    });
  }

  async getDocument(id: string, tenantId: string) {
    const doc = await this.prisma.payrollDocument.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: true },
        },
      },
    });
    if (!doc) throw new NotFoundException(`Document de paie ${id} introuvable.`);
    return doc;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⭐ 22/11/2026 — SELF-SERVICE « MA PAIE » (portail du personnel)
  //
  // Le Staff est TOUJOURS résolu par l'email de l'utilisateur connecté
  // (anti-usurpation — même règle que my-history / my-overtime / my-presence).
  // Un membre du personnel ne voit et ne télécharge que SES documents.
  // ─────────────────────────────────────────────────────────────────────────

  /** Résout le Staff lié à l'utilisateur connecté (par email, insensible à la casse). */
  private async resolveStaffByEmail(tenantId: string, email: string) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true, firstName: true, lastName: true, roleType: true, position: true, status: true },
    });
    if (!staff) {
      throw new NotFoundException(
        'Aucun dossier de personnel ne correspond à votre compte utilisateur ' +
        '(email non rattaché à une fiche de personnel de cet établissement).',
      );
    }
    return staff as any;
  }

  /**
   * Documents de paie émis de l'utilisateur connecté (fiches FP + états EP),
   * par période décroissante. Le net vient du SNAPSHOT FIGÉ (jamais recalculé).
   */
  async listMyPayslips(tenantId: string, email: string) {
    const staff = await this.resolveStaffByEmail(tenantId, email);
    const docs = await this.prisma.payrollDocument.findMany({
      where: { tenantId, staffId: staff.id },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        periodYear: true,
        periodMonth: true,
        periodLabel: true,
        statutContractuel: true,
        snapshot: true,
        contentHash: true,
        issuedAt: true,
        issuedByName: true,
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { documentNumber: 'desc' }],
    });

    return {
      staff: { id: staff.id, firstName: staff.firstName, lastName: staff.lastName, position: staff.position },
      documents: docs.map((d: any) => ({
        id: d.id,
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        periodYear: d.periodYear,
        periodMonth: d.periodMonth,
        periodLabel: d.periodLabel,
        statutContractuel: d.statutContractuel,
        net: Number(d.snapshot?.net ?? 0),
        gross: Number(d.snapshot?.brut ?? 0),
        issuedAt: d.issuedAt,
        issuedByName: d.issuedByName,
        hasFile: !!d.contentHash,
      })),
    };
  }

  /**
   * Téléchargement SELF-SERVICE : le document DOIT appartenir au Staff
   * résolu par l'email de l'utilisateur connecté (403 sinon).
   */
  async downloadMyDocument(id: string, tenantId: string, email: string): Promise<{ buffer: Buffer; document: any }> {
    const staff = await this.resolveStaffByEmail(tenantId, email);
    const doc = await this.getDocument(id, tenantId);
    if (doc.staffId !== staff.id) {
      // Anti-usurpation : le personnel ne télécharge QUE ses propres documents.
      throw new ForbiddenException(
        'Ce document de paie ne vous appartient pas — le téléchargement est réservé à vos propres documents.',
      );
    }
    return this.downloadDocument(id, tenantId);
  }

  /**
   * ⭐ 22/11/2026 — Notification in-app au personnel lors de l'émission de son
   * document de paie : « Paie de <période> disponible » + lien « Ma Paie » du
   * portail de l'utilisateur (enseignant → /app/teacher/paie, autres → /app/my-paie).
   * Best-effort : échec journalisé, jamais propagé.
   */
  private async notifyStaffDocumentIssued(doc: any, ctx: any, snapshot: any): Promise<void> {
    try {
      const staff = ctx?.staff;
      const email = staff?.email;
      if (!email) {
        this.logger.warn(`notifyStaffDocumentIssued: pas d'email sur le dossier ${staff?.id} — notification ignorée`);
        return;
      }
      const user = await this.prisma.user.findFirst({
        where: {
          tenantId: doc.tenantId,
          status: 'active',
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!user) {
        this.logger.log(
          `notifyStaffDocumentIssued: aucun compte utilisateur actif pour ${email} — notification ignorée`,
        );
        return;
      }

      const isFiche = doc.documentType === 'FICHE_DE_PAIE';
      const docLabel = isFiche ? 'fiche de paie' : 'état de paiement';
      const net = Number(snapshot?.net ?? 0);
      const url = staff?.roleType === 'TEACHER' ? '/app/teacher/paie' : '/app/my-paie';

      await this.notifications.create({
        tenantId: doc.tenantId,
        recipientId: user.id,
        type: 'PAYROLL_DOCUMENT_ISSUED',
        title: `Paie de ${doc.periodLabel} disponible`,
        body:
          `Votre ${docLabel} (${doc.documentNumber}) de ${doc.periodLabel} vient d'être émise` +
          (net > 0 ? ` — net à payer : ${net.toLocaleString('fr-FR')} FCFA.` : '.') +
          ` Téléchargez le PDF depuis votre espace « Ma Paie ».`,
        priority: 'HIGH',
        data: { url },
        relatedEntityType: 'PayrollDocument',
        relatedEntityId: doc.id,
      });
      this.logger.log(`🔔 Notification paie envoyée (${doc.documentNumber}) → user ${user.id} (${email})`);
    } catch (err: any) {
      this.logger.warn(`notifyStaffDocumentIssued: échec non bloquant — ${err?.message}`);
    }
  }

  /** PDF émis — fichier archivé tel quel (jamais régénéré) + contrôle du hash. */
  async downloadDocument(id: string, tenantId: string): Promise<{ buffer: Buffer; document: any }> {
    const doc = await this.getDocument(id, tenantId);
    if (!doc.filePath) {
      throw new NotFoundException('Aucun fichier PDF archivé pour ce document.');
    }
    const buffer = await this.readStoredPdf(doc.filePath);
    // Contrôle d'intégrité — le document scellé doit être intègre
    const actual = createHash('sha256').update(buffer).digest('hex');
    if (doc.contentHash && actual !== doc.contentHash) {
      this.logger.error(`Intégrité rompue sur ${doc.documentNumber} (attendu ${doc.contentHash}, obtenu ${actual})`);
      throw new BadRequestException(
        `Intégrité du document ${doc.documentNumber} compromise — le fichier archivé ne correspond plus à son sceau SHA-256.`,
      );
    }
    return { buffer, document: doc };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⭐ 161 — 22/11/2026 — ONGLET CNSS (module Impôts) : PDF CONFORME AU MODÈLE
  //
  // Le bouton PDF des sous-onglets CNSS (« Vacataires » / « États de
  // paiement ») générait une « fiche de paie » maison sans rapport avec
  // l'affiche modèle établie. Désormais chaque ligne fiscale produit le
  // VRAI document du module Paie :
  //   · ligne de paie réelle du mois (PayrollItem) → snapshot EXACT de la
  //     prévisualisation/émission (mêmes gabarits FP bleu nuit / EP vert,
  //     filigrane diagonal, identité complète de l'école) ;
  //   · sinon (mois sans paie générée) → snapshot reconstruit depuis la
  //     fiche fiscale (tax_payslips) sur les MÊMES gabarits.
  // Le type reste TOUJOURS dérivé du statut contractuel : prestataire →
  // ÉTAT DE PAIEMENT (retour promoteur : les vacataires téléchargent un état
  // de paiement, PAS une fiche de paie) ; salarié (déclaré ou non) → FICHE
  // DE PAIE.
  // ─────────────────────────────────────────────────────────────────────────

  async renderTaxPayslipPdf(
    taxPayslipId: string,
  ): Promise<{ buffer: Buffer; documentType: 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT'; fileName: string }> {
    const payslip: any = await this.prisma.taxPayslip.findUnique({
      where: { id: taxPayslipId },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
            contracts: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!payslip) throw new NotFoundException(`Fiche fiscale ${taxPayslipId} introuvable.`);
    const staff: any = payslip.staff;
    const contract: any = staff?.contracts?.[0] ?? null;

    // ── 1. PRIORITÉ : ligne de paie réelle du mois → snapshot exact du module Paie ──
    const item = await this.prisma.payrollItem.findFirst({
      where: {
        tenantId: payslip.tenantId,
        staffId: payslip.staffId,
        payroll: { month: payslip.period },
      },
    });
    if (item && item.status !== 'PENDING') {
      const preview = await this.previewDocument(item.id, payslip.tenantId);
      const buffer = await this.renderPdf(preview.html);
      return {
        buffer,
        documentType: preview.snapshot.kind,
        fileName: this.prettyTaxDocumentFileName(preview.snapshot.kind, staff, preview.snapshot.period?.label),
      };
    }

    // ── 2. Repli : snapshot reconstruit depuis la fiche fiscale (tax_payslips) ──
    const snapshot = await this.buildSnapshotFromTaxPayslip(payslip, staff, contract);
    // ⭐ 162 — QR de vérification sur le document servi par l'onglet CNSS
    //    aussi (même règle que l'émission FP/EP : référence lisible
    //    uniquement au scan, jamais en clair sur l'affiche).
    (snapshot as any).qrDataUrl = await this.buildDocumentQrDataUrl({
      doc: snapshot.kind,
      ref: null,
      periode: snapshot.period.label,
      net: snapshot.kind === 'FICHE_DE_PAIE' ? snapshot.net : snapshot.decompte.net,
    });
    const html =
      snapshot.kind === 'FICHE_DE_PAIE'
        ? renderFicheDePaieHtml(snapshot)
        : renderEtatDePaiementHtml(snapshot);
    const buffer = await this.renderPdf(html);
    return {
      buffer,
      documentType: snapshot.kind,
      fileName: this.prettyTaxDocumentFileName(snapshot.kind, staff, snapshot.period.label),
    };
  }

  /** Nom de fichier professionnel : « Fiche de paie / État de paiement <Prénom(s) NOM> <Période>.pdf ». */
  private prettyTaxDocumentFileName(
    kind: 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT',
    staff: any,
    periodLabel?: string,
  ): string {
    const typeLabel = kind === 'ETAT_DE_PAIEMENT' ? 'État de paiement' : 'Fiche de paie';
    const staffName = `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.replace(/\s+/g, ' ').trim() || 'personnel';
    const period = String(periodLabel || '').replace(/\s+/g, ' ').trim();
    return [typeLabel, staffName, period].filter(Boolean).join(' ');
  }

  /**
   * ⭐ 161 — snapshot FP/EP reconstruit depuis une fiche fiscale du module
   * Impôts (mois sans ligne de paie générée) : mêmes gabarits, mêmes
   * mentions légales, mêmes cumuls — aucune donnée inventée (les rubriques
   * vides de la fiche fiscale restent vides sur le document).
   */
  private async buildSnapshotFromTaxPayslip(payslip: any, staff: any, contract: any): Promise<PayrollDocumentSnapshot> {
    const monthKey = String(payslip.period || '');
    const periodStart = /^\d{4}-\d{2}$/.test(monthKey)
      ? new Date(`${monthKey}-01T00:00:00Z`)
      : new Date();
    const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0));
    const year = periodStart.getUTCFullYear();
    const month = periodStart.getUTCMonth() + 1;
    const period = {
      year,
      month,
      label: monthLabel(year, month),
      startDate: periodStart.toISOString(),
      endDate: periodEnd.toISOString(),
      joursOuvres: joursOuvres(year, month),
    };
    const fiscalYear = year;

    // Barème fiscal réel (jamais de taux codé en dur) — best-effort.
    let rates: any = null;
    try {
      rates = await this.payrollEngine.getFiscalRates('BJ', periodEnd);
    } catch (err: any) {
      this.logger.warn(`Barème fiscal indisponible (fiche CNSS ${payslip.id}) : ${err?.message}`);
    }

    const employeur = await this.resolveEmployer(payslip.tenantId, contract, staff);
    const statut = staff?.statutContractuel || contract?.statutContractuel || null;

    // Type de document TOUJOURS dérivé du statut contractuel ; dossier
    // hérité sans statut → la règle fiscale CNSS tranche (vacataire = état).
    let documentType = statut ? deriveDocumentPaieType(statut) : null;
    if (!documentType) {
      documentType = fiscalStaffType(staff) === 'VACATAIRE' ? 'ETAT_DE_PAIEMENT' : 'FICHE_DE_PAIE';
    }

    // Cumuls annuels depuis les fiches fiscales de l'exercice (recalculés).
    const yearPayslips: any[] = await this.prisma.taxPayslip.findMany({
      where: { tenantId: payslip.tenantId, staffId: payslip.staffId, period: { startsWith: `${fiscalYear}-` } },
    }).catch(() => []);
    const cumuls = {
      brut: yearPayslips.reduce((acc, p) => acc + Number(p.salaireBrut || 0), 0),
      impot: yearPayslips.reduce((acc, p) => acc + Number(p.totalRetenues || 0), 0),
      cnss: yearPayslips.reduce((acc, p) => acc + Number(p.cnssOuvriere || 0), 0),
      net: yearPayslips.reduce((acc, p) => acc + Number(p.netAPayer || 0), 0),
      documents: yearPayslips.length,
    };

    // Rubriques d'indemnités non vides (aucune ligne à zéro sur le document).
    const indemnites = [
      Number(payslip.gratificationsEtrennes) > 0
        ? { label: 'Gratifications et étrennes', amount: Number(payslip.gratificationsEtrennes) } : null,
      Number(payslip.indemnites) > 0
        ? { label: 'Indemnités', amount: Number(payslip.indemnites) } : null,
      Number(payslip.primeSalissures) > 0
        ? { label: 'Prime de salissures', amount: Number(payslip.primeSalissures) } : null,
      Number(payslip.moinsPercesArriere) > 0
        ? { label: 'Moins perçus / arriéré', amount: Number(payslip.moinsPercesArriere) } : null,
    ].filter(Boolean) as Array<{ label: string; amount: number }>;

    if (documentType === 'ETAT_DE_PAIEMENT') {
      const brut = Number(payslip.salaireBrut);
      const autresRetenues =
        Number(payslip.avanceAcompte || 0) + Number(payslip.opposition || 0) + Number(payslip.taxesRadioTele || 0);
      // Retenues fiscales/sociales du relevé = tout ce qui n'est ni avance,
      // ni opposition, ni taxes radio/télé (AIB des prestataires, CNSS/ITS
      // sinon) — jamais inventée : vient de la fiche fiscale elle-même.
      const aib = Math.max(0, Number(payslip.totalRetenues || 0) - autresRetenues);
      const ifu = staff?.ifuNumber || null;
      const tauxAib = rates
        ? (ifu ? rates.aibAvecIfu : rates.aibSansIfu)
        : brut > 0
          ? Math.round((aib / brut) * 1000) / 10
          : 0;

      const snapshot: EtatPaiementSnapshot = {
        kind: 'ETAT_DE_PAIEMENT',
        statutContractuel: 'PRESTATAIRE_SERVICE',
        documentNumber: null,
        period,
        fiscalYear,
        employeur,
        prestataire: {
          nom: staff?.lastName || BLANK,
          prenoms: staff?.firstName || BLANK,
          ifu,
          contratReference: contract?.id ? `CT-${String(contract.id).slice(0, 8).toUpperCase()}` : null,
          description:
            (contract?.terms as any)?.prestation?.description ||
            (contract?.terms as any)?.description ||
            staff?.position ||
            null,
          mode: staff?.prestationPaymentMode || contract?.prestationPaymentMode || null,
          heures: null,
          tauxHoraire:
            (staff?.prestationPaymentMode || contract?.prestationPaymentMode) === 'HORAIRE'
              ? Number(staff?.prestationAmount ?? contract?.prestationAmount ?? 0)
              : null,
        },
        decompte: { brut, tauxAib, aib, net: Number(payslip.netAPayer), indemnites },
        presences: null,
        cumuls,
        rates: { fiscalYear: rates?.fiscalYear ?? fiscalYear, aibPct: tauxAib, sourceNotes: rates?.sourceNotes ?? null },
        mention: MENTION_ETAT_PAIEMENT,
      };
      return snapshot;
    }

    // ── FICHE DE PAIE (salarié déclaré / non déclaré) ──
    // Statut affiché : le statut réel du dossier ; dossier hérité sans statut
    // → dérivé de la déclaration CNSS (n° actif = déclaré).
    const cnssNumber = staff?.employeeCNSS?.cnssNumber || staff?.cnssNumber || null;
    const effectiveStatut = statut === 'SALARIE_DECLARE' || statut === 'SALARIE_NON_DECLARE'
      ? statut
      : (cnssNumber ? 'SALARIE_DECLARE' : 'SALARIE_NON_DECLARE');
    const cnssDeclare = effectiveStatut === 'SALARIE_DECLARE';
    const conges = computeConges({
      joursCongesParMois: rates?.joursCongesParMois ?? 0,
      hireDate: staff?.hireDate || contract?.startDate || null,
      periodEnd,
      joursPris: 0,
    });

    const snapshot: FichePaieSnapshot = {
      kind: 'FICHE_DE_PAIE',
      statutContractuel: effectiveStatut,
      cnssDeclare,
      documentNumber: null,
      period,
      fiscalYear,
      employeur,
      salarie: {
        matricule: staff?.tenantMatricule || staff?.employeeNumber || BLANK,
        nom: staff?.lastName || BLANK,
        prenoms: staff?.firstName || BLANK,
        poste: staff?.position || staff?.roleType || BLANK,
        categorie: CATEGORY_LABELS[categoryKeyFromRoleType(staff?.roleType)] || staff?.roleType || BLANK,
        cnssNumber: cnssDeclare ? cnssNumber : null,
        anciennete: ancienneteLabel(staff?.hireDate || contract?.startDate || null, periodEnd),
        ancienneteDepuis: staff?.hireDate || contract?.startDate || null,
        joursTravailles: period.joursOuvres,
      },
      gains: {
        base: Number(payslip.salaireBase),
        heuresSup: 0,
        primes: 0,
        indemnites,
        brut: Number(payslip.salaireBrut),
      },
      retenues: {
        cnss: Number(payslip.cnssOuvriere || 0),
        its: Number(payslip.itsNet || 0),
        autres:
          Number(payslip.avanceAcompte || 0) +
          Number(payslip.opposition || 0) +
          Number(payslip.taxesRadioTele || 0),
        total: Number(payslip.totalRetenues || 0),
      },
      net: Number(payslip.netAPayer),
      chargesPatronales: null,
      presences: null,
      cumuls,
      conges,
      rates: { fiscalYear: rates?.fiscalYear ?? fiscalYear, cnssSalarialPct: rates?.cnssSalarial, sourceNotes: rates?.sourceNotes ?? null },
      mention: MENTION_FICHE_CONSERVATION,
    };
    return snapshot;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUCTION DU SNAPSHOT (prévisu = émission)
  // ─────────────────────────────────────────────────────────────────────────

  private async loadContext(payrollItemId: string, tenantId: string) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
            contracts: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        payroll: { include: { tenant: { include: { country: true } } } },
        taxWithholdings: { where: { taxType: 'AIB' }, take: 1 },
        salarySlip: true,
        payrollDocument: true,
      },
    });
    if (!item) throw new NotFoundException(`Ligne de paie ${payrollItemId} introuvable.`);
    if (item.status === 'PENDING') {
      throw new BadRequestException(
        'La ligne de paie doit être calculée avant d\u2019émettre un document (bouton Calculer).',
      );
    }

    const staff: any = item.staff as any;
    const contract: any = staff?.contracts?.[0] ?? null;
    const statut = staff?.statutContractuel || contract?.statutContractuel || null;
    const documentType = deriveDocumentPaieType(statut);
    if (!statut || !documentType) {
      throw new BadRequestException(
        'Ce personnel n\u2019a pas de statut contractuel (salarié déclaré / non déclaré / prestataire). ' +
        'Le document de paie ne peut pas être déterminé — complétez le statut sur sa fiche.',
      );
    }

    const payroll: any = item.payroll;
    // ⭐ 125 — période dérivée du MOIS EXPLICITE du lot (« 2026-11 »), pas de
    //    la date startDate (les lots hérités décalés d'un jour par le fuseau
    //    produisaient periodMonth ≠ mois du lot → le registre FP/EP filtré sur
    //    le mois de la période trouvait « aucun document »).
    const monthKey: string | null = payroll?.month ?? null;
    const periodStart = monthKey && /^\d{4}-\d{2}$/.test(monthKey)
      ? new Date(`${monthKey}-01T00:00:00Z`)
      : payroll?.startDate
        ? new Date(payroll.startDate)
        : new Date();
    const periodEnd = payroll?.endDate ? new Date(payroll.endDate) : periodStart;
    const period = {
      year: periodStart.getUTCFullYear(),
      month: periodStart.getUTCMonth() + 1,
      label: monthLabel(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1),
      startDate: periodStart.toISOString(),
      endDate: periodEnd.toISOString(),
      joursOuvres: joursOuvres(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1),
    };
    const fiscalYear = period.year;

    return { item, staff, contract, statut, documentType, payroll, period, fiscalYear, tenantId, existingDocument: (item as any).payrollDocument };
  }

  private async buildSnapshot(
    ctx: any,
    opts: { forIssue: boolean; documentNumber?: string; issuedAt?: Date; issuedByName?: string | null },
  ): Promise<PayrollDocumentSnapshot> {
    // ⭐ 17/11/2026 — FIX ReferenceError « tenantId is not defined » : le
    //    champ existe dans le contexte (retourné par loadContext) mais
    //    n'était pas déstructuré → TOUTES les prévisualisations/émissions
    //    FP/EP renvoyaient 500 depuis l'origine.
    const { item, staff, contract, statut, period, fiscalYear, tenantId } = ctx;
    const countryCode = ctx.payroll?.tenant?.country?.code || 'BJ';
    const rates = await this.payrollEngine.getFiscalRates(countryCode, new Date(period.endDate));
    if (!rates) {
      throw new BadRequestException(
        'Aucun barème fiscal disponible (payroll_fiscal_rates) — l\u2019émission est impossible. ' +
        'Créez d\u2019abord le barème de l\u2019exercice.',
      );
    }

    const employeur = await this.resolveEmployer(tenantId, contract, staff);
    const cnssNumber = staff.employeeCNSS?.cnssNumber || staff.cnssNumber || null;
    const periodEnd = new Date(period.endDate);

    // ⭐ 162 — QR code de vérification (retour promoteur : les modifications
    //    « avec le QR code et tout » doivent s'appliquer AUSSI à la fiche de
    //    paie et à l'état de paiement, pas seulement au bulletin). La
    //    référence (n° FP/EP émis, null en prévisualisation) est lisible
    //    UNIQUEMENT au scan — jamais en clair sur le document.
    const qrDataUrl = await this.buildDocumentQrDataUrl({
      doc: ctx.documentType as 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT',
      ref: opts.documentNumber ?? ctx.existingDocument?.documentNumber ?? null,
      periode: period.label,
      net: Number(item.netSalary),
    });

    // ⭐ 22/11/2026 — proration par présences (mode « présences » de la
    //    période) : base de proration figée dans la ligne de paie au calcul.
    //    Affichée sur la fiche (jours pointés / ouvrés, taux) — traçabilité
    //    du lien présences ↔ paie exigé par le promoteur.
    const attendanceRaw = (item as any).attendanceDetail;
    const presences = attendanceRaw && attendanceRaw.mode === 'ATTENDANCE'
      ? {
          daysPresent: Number(attendanceRaw.daysPresent ?? 0),
          daysExpected: Number(attendanceRaw.daysExpected ?? 0),
          ratio: Number(attendanceRaw.ratio ?? 1),
          noRecords: attendanceRaw.noRecords === true,
          fullBase: attendanceRaw.fullBase != null ? Number(attendanceRaw.fullBase) : null,
        }
      : null;

    // Cumuls annuels : RECALCULÉS depuis les documents émis (jamais d'incrément stocké)
    const cumuls = await this.recalculateCumuls(staff.id, staff.tenantId, fiscalYear, item);

    if (ctx.documentType === 'ETAT_DE_PAIEMENT') {
      // ─── ÉTAT DE PAIEMENT (prestataire) : AIB uniquement, jamais une fiche ───
      const ifu = staff.ifuNumber || null;
      const brut = Number(item.grossSalary);
      const aib = Number(item.otherDeductions);
      const net = Number(item.netSalary);
      // Taux AIB DÉRIVÉ de l'IFU (jamais saisi) : trace fiscale d'abord, barème sinon
      const trace: any = (item as any).taxWithholdings?.[0];
      const tauxAib =
        trace?.ratePercentage != null
          ? Number(trace.ratePercentage)
          : ifu
            ? rates.aibAvecIfu
            : rates.aibSansIfu;

      const snapshot: EtatPaiementSnapshot = {
        kind: 'ETAT_DE_PAIEMENT',
        statutContractuel: 'PRESTATAIRE_SERVICE',
        documentNumber: opts.documentNumber ?? null,
        period,
        fiscalYear,
        employeur,
        prestataire: {
          nom: staff.lastName || BLANK,
          prenoms: staff.firstName || BLANK,
          ifu,
          contratReference: contract?.id ? `CT-${String(contract.id).slice(0, 8).toUpperCase()}` : null,
          description:
            (contract?.terms as any)?.prestation?.description ||
            (contract?.terms as any)?.description ||
            staff.position ||
            null,
          mode: staff.prestationPaymentMode || contract?.prestationPaymentMode || null,
          heures: null,
          tauxHoraire:
            (staff.prestationPaymentMode || contract?.prestationPaymentMode) === 'HORAIRE'
              ? Number(staff.prestationAmount ?? contract?.prestationAmount ?? 0)
              : null,
        },
        decompte: { brut, tauxAib, aib, net, indemnites: buildIndemnitesGains(item) },
        presences,
        cumuls,
        rates: { fiscalYear: rates.fiscalYear, aibPct: tauxAib, sourceNotes: rates.sourceNotes },
        mention: MENTION_ETAT_PAIEMENT,
        qrDataUrl,
      };
      return snapshot;
    }

    // ─── FICHE DE PAIE (salarié déclaré / non déclaré) ───
    const cnssDeclare = statut === 'SALARIE_DECLARE';
    const brut = Number(item.grossSalary);
    const base = Number(item.baseSalary);
    const heuresSup = Number(item.overtimeAmount);
    // ⭐ 17/11/2026 — indemnités DÉTAILLÉES par type (figées dans la ligne de
    //    paie au calcul) : salaire réel = base + Σ indemnités + heures supp +
    //    primes. Lignes héritées sans détail → repli « Primes et indemnités »
    //    (résidu brut − base − heures sup), rendu inchangé.
    const indemnites = buildIndemnitesGains(item);
    const indemTotal = indemnites
      ? Math.round(indemnites.reduce((s: number, a: any) => s + a.amount, 0) * 100) / 100
      : 0;
    // Primes ponctuelles pures : complément du brut hors base/indemnités/heures supp
    const primes = indemnites
      ? Math.max(0, Math.round((brut - base - heuresSup - indemTotal) * 100) / 100)
      : Math.max(0, Math.round((brut - base - heuresSup) * 100) / 100);
    const retenues = {
      cnss: Number(item.cnssEmployee || 0),
      its: Number(item.irppAmount || 0),
      autres: Math.max(0, Number(item.otherDeductions || 0)),
      total: Number(item.totalDeductions || 0),
    };

    // Charges patronales : informatives, recalculées au barème de la période
    const chargesPatronales = cnssDeclare
      ? {
          prestationsFamiliales: round2((brut * rates.cnssPrestationsFamiliales) / 100),
          risquesProfessionnels: round2((brut * rates.cnssRisquesProMin) / 100),
          vieillesse: round2((brut * rates.cnssVieillesse) / 100),
          total: round2((brut * rates.cnssPatronalGlobal) / 100),
          informatif: true as const,
        }
      : null;

    // Congés payés : module Congés (congés annuels approuvés) + barème jours/mois
    const joursPris = await this.countApprovedAnnualLeaveDays(staff.id, staff.tenantId, period);
    const conges = computeConges({
      joursCongesParMois: rates.joursCongesParMois,
      hireDate: staff.hireDate || contract?.startDate || null,
      periodEnd,
      joursPris,
    });

    const snapshot: FichePaieSnapshot = {
      kind: 'FICHE_DE_PAIE',
      statutContractuel: statut,
      cnssDeclare,
      documentNumber: opts.documentNumber ?? null,
      period,
      fiscalYear,
      employeur,
      salarie: {
        matricule: staff.tenantMatricule || staff.employeeNumber || BLANK,
        nom: staff.lastName || BLANK,
        prenoms: staff.firstName || BLANK,
        poste: staff.position || staff.roleType || BLANK,
        categorie: CATEGORY_LABELS[categoryKeyFromRoleType(staff.roleType)] || staff.roleType || BLANK,
        cnssNumber: cnssDeclare ? cnssNumber : null,
        anciennete: ancienneteLabel(staff.hireDate || contract?.startDate || null, periodEnd),
        ancienneteDepuis: staff.hireDate || contract?.startDate || null,
        joursTravailles: period.joursOuvres,
      },
      gains: { base, heuresSup, primes, indemnites, brut },
      retenues,
      net: Number(item.netSalary),
      chargesPatronales,
      presences,
      cumuls,
      conges,
      rates: { fiscalYear: rates.fiscalYear, cnssSalarialPct: rates.cnssSalarial, sourceNotes: rates.sourceNotes },
      mention: MENTION_FICHE_CONSERVATION,
      qrDataUrl,
    };
    return snapshot;
  }

  /**
   * ⭐ 162 — QR code de vérification du document de paie (fiche FP / état
   * EP) : même exigence promoteur que le bulletin — la référence est lisible
   * UNIQUEMENT au scan, JAMAIS en clair sur l'affiche. Best-effort : null si
   * la librairie qrcode est indisponible (le document reste complet sans QR).
   */
  private async buildDocumentQrDataUrl(payload: {
    doc: 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT';
    ref: string | null;
    periode: string;
    net: number;
  }): Promise<string | null> {
    try {
      const QRCode: any = await import('qrcode');
      const data = JSON.stringify({
        app: 'academia-helm',
        doc: payload.doc,
        ref: payload.ref,
        periode: payload.periode,
        net: payload.net,
      });
      return await QRCode.toDataURL(data, {
        margin: 1,
        width: 128,
        errorCorrectionLevel: 'M',
        color: { dark: '#1f2937', light: '#ffffff' },
      });
    } catch {
      return null;
    }
  }

  /** Cumuls annuels RECALCULÉS depuis les payroll_documents émis + la ligne courante. */
  private async recalculateCumuls(staffId: string, tenantId: string, fiscalYear: number, currentItem: any) {
    const previousDocs = await this.prisma.payrollDocument.findMany({
      where: { staffId, tenantId, fiscalYear },
      select: { snapshot: true },
    });
    const sum = (fn: (s: any) => number) =>
      previousDocs.reduce((acc, d) => acc + (fn(d.snapshot as any) || 0), 0);

    const prevBrut = sum((s) => (s.kind === 'FICHE_DE_PAIE' ? s.gains?.brut : s.decompte?.brut));
    const prevNet = sum((s) => (s.kind === 'FICHE_DE_PAIE' ? s.net : s.decompte?.net));
    const prevImpot = sum((s) =>
      s.kind === 'FICHE_DE_PAIE' ? s.retenues?.its : s.decompte?.aib,
    );
    const prevCnss = sum((s) => (s.kind === 'FICHE_DE_PAIE' ? s.retenues?.cnss : 0));

    const isFiche = currentItem
      ? deriveDocumentPaieType(currentItem.staff?.statutContractuel || (currentItem as any).statut) !== 'ETAT_DE_PAIEMENT'
      : true;
    const curBrut = Number(currentItem?.grossSalary ?? 0);
    const curNet = Number(currentItem?.netSalary ?? 0);
    const curImpot = Number(currentItem?.irppAmount ?? 0);
    const curCnss = Number(currentItem?.cnssEmployee ?? 0);
    // Pour un état de paiement, l'impôt du document = AIB (otherDeductions)
    const curDocImpot = isFiche ? curImpot : Number(currentItem?.otherDeductions ?? 0);

    return {
      brut: round2(prevBrut + curBrut),
      impot: round2(prevImpot + curDocImpot),
      cnss: round2(prevCnss + (isFiche ? curCnss : 0)),
      net: round2(prevNet + curNet),
      documents: previousDocs.length + 1,
    };
  }

  /** Congés annuels approuvés (module Congés) sur l'exercice, jusqu'à la fin de période. */
  private async countApprovedAnnualLeaveDays(staffId: string, tenantId: string, period: any): Promise<number> {
    try {
      const yearStart = new Date(period.year, 0, 1);
      const periodEnd = new Date(period.endDate);
      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          staffId,
          tenantId,
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: { gte: yearStart, lte: periodEnd },
        },
        select: { startDate: true, endDate: true },
      });
      return leaves.reduce((acc, l) => {
        const s = new Date(l.startDate);
        const e = new Date(l.endDate);
        const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
        return acc + Math.max(0, days);
      }, 0);
    } catch (err: any) {
      this.logger.warn(`Congés indisponibles (${err?.message}) — pris = 0`);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITÉ EMPLOYEUR — ONGLET IDENTITÉ DU MODULE PARAMÈTRES (source de vérité)
  // ⭐ 22/11/2026 — retour promoteur : « toutes les informations de l'école ne
  //    sont pas bien récupérées » + distinction maternelle/primaire vs
  //    secondaire :
  //      · personnel de la MATERNELLE/PRIMAIRE → tenant_identity_profiles
  //        (profil ACTIF de l'onglet Identité) ;
  //      · personnel du SECONDAIRE → overlay tenant_level_identity_profiles
  //        (Identité du niveau secondaire du même onglet) — chaque champ non
  //        vide remplace le champ global ;
  //      · replis legacy : SchoolSettings → School → Tenant.
  //    Le LOGO (filigrane + en-tête) suit la même résolution, converti en
  //    data-URL pour le rendu Puppeteer (aucune requête réseau pendant le PDF).
  // ─────────────────────────────────────────────────────────────────────────

  private async resolveEmployer(tenantId: string, contract?: any, staff?: any): Promise<any> {
    const schoolSettings: any = await this.prisma.schoolSettings.findFirst({ where: { tenantId } }).catch(() => null);
    const identityProfile: any = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true }, orderBy: { version: 'desc' },
    }).catch(() => null);
    const school: any = await this.prisma.school.findFirst({ where: { tenantId } }).catch(() => null);
    const financialHeader: any = await this.prisma.financialReportHeader.findFirst({
      where: { tenantId }, orderBy: { updatedAt: 'desc' },
    }).catch(() => null);
    const tenant: any = await this.prisma.tenant.findUnique({ where: { id: tenantId } }).catch(() => null);
    const recruiter: any = await this.prisma.recruiterProfile.findFirst({ where: { tenantId } }).catch(() => null);

    // ⭐ 22/11/2026 — overlay SECONDAIRE : le personnel du secondaire reçoit
    //    l'identité du niveau secondaire paramétrée dans l'onglet Identité.
    const overlay = staff
      ? await resolveLevelIdentityOverlay(this.prisma, tenantId, {
          schoolLevelId: (staff as any)?.schoolLevelId ?? null,
        }).catch(() => null)
      : null;
    // Champ override non vide → remplace le champ global (maternelle/primaire).
    const lvl = (field: string): string | null => {
      const v = (overlay as any)?.[field];
      return v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim();
    };

    const schoolName =
      lvl('schoolName') ||
      identityProfile?.schoolName ||
      schoolSettings?.schoolName ||
      school?.name ||
      tenant?.name ||
      "L'École";
    const sigle =
      lvl('schoolAcronym') ||
      identityProfile?.schoolAcronym ||
      null;
    const address =
      lvl('address') ||
      identityProfile?.address ||
      schoolSettings?.address ||
      school?.address ||
      BLANK;
    const city =
      lvl('city') ||
      identityProfile?.city ||
      schoolSettings?.city ||
      '';
    const department =
      lvl('department') ||
      identityProfile?.department ||
      null;
    const telephone =
      lvl('phonePrimary') ||
      identityProfile?.phonePrimary ||
      schoolSettings?.phone ||
      school?.primaryPhone ||
      null;
    const telephone2 =
      lvl('phoneSecondary') ||
      identityProfile?.phoneSecondary ||
      null;
    const whatsapp = lvl('whatsapp') || identityProfile?.whatsapp || null;
    const email =
      lvl('email') ||
      identityProfile?.email ||
      schoolSettings?.email ||
      school?.primaryEmail ||
      null;
    const website = lvl('website') || identityProfile?.website || null;
    const autorisation =
      identityProfile?.authorizationNumber ||
      null;
    const devise = lvl('slogan') || identityProfile?.slogan || null;
    const pays =
      lvl('country') ||
      identityProfile?.country ||
      null;

    // Logo — overlay secondaire d'abord, profil global ensuite ; data-URL
    // inline pour Puppeteer (pattern receipt-finance PERF 2026-09-16).
    const rawLogo = lvl('logoUrl') || identityProfile?.logoUrl || null;
    const logoUrl = rawLogo ? await this.resolveInlineLogo(rawLogo) : null;

    const adresseParts = [address, city, department].filter((p: any) => p && String(p).trim());
    return {
      // Raison sociale = NOM de l'école (onglet Identité) ; la dénomination
      // sociale des états financiers reste le repli légal.
      raisonSociale: schoolName,
      sigle,
      formeJuridique: financialHeader?.formeJuridique || null,
      rccm: financialHeader?.numeroRC || null,
      ifu: financialHeader?.numeroIF || null,
      cnss: financialHeader?.numeroCNSS || (financialHeader as any)?.cnssNumber || null,
      autorisation,
      devise,
      adresse: adresseParts.join(', '),
      ville: city || null,
      departement: department || null,
      pays,
      telephone,
      telephone2,
      whatsapp,
      email,
      website,
      logoUrl,
      representant: contract?.terms?.employerSignerName || recruiter?.fullName || school?.directorPrimary || 'Le Directeur',
      qualite: (contract?.terms as any)?.employer?.representantQualite || recruiter?.functionLabel || 'Directeur(trice)',
    };
  }

  /**
   * ⭐ 22/11/2026 — Résout le logo en data-URL inline pour le HTML Puppeteer
   * (aucune requête réseau pendant le rendu). Best-effort : renvoie la
   * valeur brute en cas d'échec. Pattern commun receipt-finance /
   * class-list-pdf (PERF 2026-09-16).
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
        return raw;
      }
      // Chemin de fichier local (uploads) → lecture disque + base64.
      const fs = await import('fs');
      const pathMod = await import('path');
      const candidates = [
        raw,
        pathMod.join(process.cwd(), String(raw).replace(/^\//, '')),
        pathMod.join(process.cwd(), 'uploads', String(raw).replace(/^(\/)?uploads\/?/, '')),
      ];
      for (const c of candidates) {
        try {
          if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            const buf = fs.readFileSync(c);
            const ext = pathMod.extname(c).toLowerCase();
            const ct = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif'
              : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            return `data:${ct};base64,${buf.toString('base64')}`;
          }
        } catch { /* essai suivant */ }
      }
      return raw;
    } catch {
      return raw;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF + STOCKAGE + NUMÉROTATION
  // ─────────────────────────────────────────────────────────────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  private async savePdf(tenantId: string, documentNumber: string, ctx: any, pdfBuffer: Buffer): Promise<string> {
    const fileName = `${documentNumber}.pdf`;
    const storageKey = `payroll-documents/${tenantId}/${ctx.fiscalYear}/${fileName}`;
    try {
      const result = await this.storageService.uploadBuffer(pdfBuffer, storageKey, 'application/pdf');
      return result;
    } catch (cloudError: any) {
      this.logger.warn(`Cloud upload failed, fallback local : ${cloudError?.message}`);
      const dir = path.join(process.cwd(), 'uploads', 'payroll-documents', tenantId, String(ctx.fiscalYear));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      return `/uploads/payroll-documents/${tenantId}/${ctx.fiscalYear}/${fileName}`;
    }
  }

  private async readStoredPdf(filePath: string): Promise<Buffer> {
    // Cloud storage (R2/S3)
    try {
      const type = this.storageService.getStorageType();
      if (type === 'r2' || type === 's3') {
        return await this.storageService.downloadFile(filePath);
      }
    } catch (err: any) {
      this.logger.warn(`Cloud download failed (${filePath}) : ${err?.message}`);
    }
    // Vercel Blob (URL directe)
    if (filePath.startsWith('https://')) {
      const res = await fetch(filePath);
      if (!res.ok) throw new NotFoundException('Fichier PDF introuvable dans le stockage distant.');
      return Buffer.from(await res.arrayBuffer());
    }
    // Fallback système de fichiers local
    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Fichier PDF introuvable sur le système de fichiers.');
    }
    return fs.readFileSync(absolutePath);
  }

  /** Allocation atomique : UPSERT ... RETURNING sur payroll_document_sequences. */
  private async allocateSequence(tenantId: string, documentType: string, fiscalYear: number): Promise<number> {
    try {
      const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
        `INSERT INTO "payroll_document_sequences" ("id","tenantId","documentType","fiscalYear","lastNumber","createdAt","updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now())
         ON CONFLICT ("tenantId","documentType","fiscalYear")
         DO UPDATE SET "lastNumber" = "payroll_document_sequences"."lastNumber" + 1, "updatedAt" = now()
         RETURNING "lastNumber"`,
        tenantId, documentType, fiscalYear,
      );
      return Number(rows?.[0]?.lastNumber ?? 1);
    } catch (err: any) {
      this.logger.warn(`Séquence SQL indisponible (${err?.message}) — repli Prisma upsert`);
      // Repli (par exemple si la table vient d'être créée par bootstrap dans la même seconde)
      const existing = await this.prisma.payrollDocumentSequence.findUnique({
        where: { tenantId_documentType_fiscalYear: { tenantId, documentType, fiscalYear } },
      });
      const next = (existing?.lastNumber ?? 0) + 1;
      await this.prisma.payrollDocumentSequence.upsert({
        where: { tenantId_documentType_fiscalYear: { tenantId, documentType, fiscalYear } },
        create: { ...prismaCreateDefaults(), tenantId, documentType, fiscalYear, lastNumber: next },
        update: { ...prismaUpdateDefaults(), lastNumber: next },
      });
      return next;
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * ⭐ 17/11/2026 — Indemnités DÉTAILLÉES par type, figées dans la ligne de paie
 * (payroll_items.allowancesDetail) au moment du calcul :
 *   • détail présent  → [{label, amount}] par type d'indemnité ;
 *   • total seul      → ligne agrégée « Indemnités » (montant figé) ;
 *   • rien (héritage) → null → les gabarits retombent sur « Primes et
 *     indemnités » (résidu), rendu inchangé des documents déjà émis.
 * Le SALAIRE RÉEL s'affiche alors : base + chaque type d'indemnité + heures
 * supp + primes = SALAIRE BRUT.
 */
function buildIndemnitesGains(item: any): Array<{ label: string; amount: number }> | null {
  const detailRaw = Array.isArray(item?.allowancesDetail) ? item.allowancesDetail : [];
  const detail = detailRaw
    .map((a: any) => ({
      label: String(a?.label ?? a?.code ?? 'Indemnité'),
      amount: round2(Number(a?.amount ?? 0)),
    }))
    .filter((a: any) => a.amount > 0);
  if (detail.length > 0) return detail;
  const total = round2(Number(item?.allowancesTotal ?? 0));
  if (total > 0) return [{ label: 'Indemnités', amount: total }];
  return null;
}

function fmtHash(hash: string): string {
  return hash ? `${hash.slice(0, 12)}…` : '—';
}
