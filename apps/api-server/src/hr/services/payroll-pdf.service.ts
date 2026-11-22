/**
 * ============================================================================
 * PAYROLL PDF SERVICE - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Service pour la génération de bulletins de paie PDF officiels,
 * aligné sur les modèles PayrollItem + SalarySlip.
 *
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
// ⭐ 22/11/2026 — identité de l'école (onglet Identité ; overlay secondaire)
import { resolveLevelIdentityOverlay } from '../../common/context/resolve-level-identity';
// ⭐ 161 — helpers d'échappement/formatage partagés avec les gabarits FP/EP
import { esc, fmtMoney } from './payroll-document-templates';
import * as fs from 'fs';
import * as path from 'path';

/** ⭐ 161 — Libellé de période du bulletin (« Novembre 2026 ») partagé par le
 *  HTML et les gabarits d'en-tête/pied de page du PDF. */
function periodLabelOf(payroll: any): string {
  if (payroll?.startDate) {
    return new Date(payroll.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  return payroll?.month || 'N/A';
}

@Injectable()
export class PayrollPdfService {
  private readonly logger = new Logger(PayrollPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Génère un bulletin de paie PDF officiel (SalarySlip)
   */
  async generatePaySlipPdf(payrollItemId: string, tenantId: string, userId: string) {
    const payrollItem = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
          },
        },
        payroll: {
          include: {
            tenant: {
              include: { country: true },
            },
            academicYear: true,
          },
        },
        salarySlip: true,
      },
    });

    if (!payrollItem) {
      throw new NotFoundException(`Payroll item with ID ${payrollItemId} not found`);
    }

    const payroll = payrollItem.payroll;
    const tenant = payroll?.tenant;
    const country = tenant?.country;

    // Détection du pays et configuration des labels régionaux
    const countryCode = country?.code || 'BJ';
    const currency = country?.currencyCode || 'XOF';

    // Labels sociaux par pays
    const socialLabels: Record<string, string> = {
      'BJ': 'CNSS', 'TG': 'CNSS', 'SN': 'IPRES/CSS',
      'CI': 'CNPS', 'ML': 'INPS', 'BF': 'CNSS',
    };

    // Labels fiscaux par pays
    const taxLabels: Record<string, string> = {
      'BJ': 'IRPP', 'TG': 'IRPP', 'SN': 'ITS',
      'CI': 'IS', 'ML': 'ITS', 'BF': 'IUTS',
    };

    const labels = {
      social: socialLabels[countryCode] || 'Cotisations Sociales',
      tax: taxLabels[countryCode] || 'Impôt sur le Revenu',
      currency,
    };

    // Vérifier que la paie est validée
    if (payrollItem.status === 'PENDING') {
      throw new BadRequestException(
        'Cannot generate pay slip for payroll item with status PENDING. Please calculate/validate first.',
      );
    }

    // 1. Résoudre l'identité COMPLÈTE de l'école (onglet Identité du module
    //    Paramètres — maternelle/primaire, ou niveau secondaire via overlay)
    //    + logo en data-URL (filigrane diagonal + en-tête du bulletin).
    const school = await this.resolveSchoolIdentity(tenantId, payrollItem.staff);

    // ⭐ 161 — QR CODE de vérification (retour promoteur) : l'identifiant ne
    //    doit PAS figurer en clair sur le document — il est encodé dans un QR
    //    code discret en pied de page (scan = référence, période, net, sceau).
    const qrDataUrl = await this.buildQrDataUrl(
      payrollItem.id,
      payrollItem.salarySlip?.receiptNumber || null,
      periodLabelOf(payroll),
      Number(payrollItem.netSalary),
    );

    // 2. Générer le HTML du bulletin
    const html = this.generatePaySlipHtml(payrollItem, labels, school, qrDataUrl);

    // 3. Convertir en PDF (PuppeteerPoolService handles browser availability)
    const pdfBuffer = await this.renderPdfFromHtml(html, {
      schoolName: school?.name || tenant?.name || 'Établissement',
      periodLabel: periodLabelOf(payroll),
    });

    // 4. Sauvegarder le PDF
    const pdfUrl = await this.savePdf(
      tenantId,
      payroll?.id ?? 'unknown',
      payrollItem.staffId,
      pdfBuffer,
    );

    // 5. Créer ou mettre à jour le SalarySlip
    const existingSlip = payrollItem.salarySlip;
    let salarySlip;

    if (existingSlip) {
      // Delete old PDF file before updating (prevent orphaned files in cloud + local)
      if (existingSlip.filePath) {
        try {
          // Try cloud storage deletion first
          if (this.storageService.getStorageType() === 'r2' || this.storageService.getStorageType() === 's3') {
            await this.storageService.deleteFile(existingSlip.filePath);
            this.logger.log(`Deleted old payslip PDF from cloud: ${existingSlip.filePath}`);
          } else if (existingSlip.filePath.startsWith('https://')) {
            // Vercel Blob
            await this.storageService.deleteFile(existingSlip.filePath);
          } else {
            // Local filesystem
            const oldPath = path.join(process.cwd(), existingSlip.filePath);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
              this.logger.log(`Deleted old payslip PDF: ${oldPath}`);
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to delete old payslip PDF: ${err}`);
        }
      }

      salarySlip = await this.prisma.salarySlip.update({
        where: { id: existingSlip.id },
        data: {
          filePath: pdfUrl,
          pdfGenerated: true,
          pdfGeneratedAt: new Date(),
          issuedBy: userId || null,
        },
      });
    } else {
      const receiptNumber = `SLP-${Date.now()}-${payrollItemId.substring(0, 8)}`;
      salarySlip = await this.prisma.salarySlip.create({
        data: {
          tenantId,
          payrollItemId,
          receiptNumber,
          period: payroll?.month ?? '',
          filePath: pdfUrl,
          pdfGenerated: true,
          pdfGeneratedAt: new Date(),
          issuedBy: userId || null,
        },
      });
    }

    return {
      ...salarySlip,
      pdfBuffer,
    };
  }

  /**
   * ⭐ 22/11/2026 — Identité COMPLÈTE de l'école pour le bulletin générique :
   * onglet Identité du module Paramètres (profil actif), avec l'overlay du
   * niveau SECONDAIRE si le personnel est du secondaire. Le logo est résolu
   * en data-URL (filigrane + en-tête, pattern receipt-finance PERF 2026-09-16).
   */
  private async resolveSchoolIdentity(tenantId: string, staff?: any) {
    const identityProfile: any = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { version: 'desc' },
    }).catch(() => null);
    const tenant: any = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    }).catch(() => null);
    const overlay = staff
      ? await resolveLevelIdentityOverlay(this.prisma, tenantId, {
          schoolLevelId: (staff as any)?.schoolLevelId ?? null,
        }).catch(() => null)
      : null;
    const lvl = (field: string): string | null => {
      const v = (overlay as any)?.[field];
      return v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim();
    };
    const rawLogo = lvl('logoUrl') || identityProfile?.logoUrl || null;
    const logoUrl = rawLogo ? await this.resolveInlineLogo(rawLogo) : null;
    return {
      name: lvl('schoolName') || identityProfile?.schoolName || tenant?.name || 'Établissement',
      sigle: lvl('schoolAcronym') || identityProfile?.schoolAcronym || null,
      address: lvl('address') || identityProfile?.address || tenant?.address || null,
      city: lvl('city') || identityProfile?.city || null,
      phone: lvl('phonePrimary') || identityProfile?.phonePrimary || tenant?.primaryPhone || null,
      phone2: lvl('phoneSecondary') || identityProfile?.phoneSecondary || null,
      whatsapp: lvl('whatsapp') || identityProfile?.whatsapp || null,
      email: lvl('email') || identityProfile?.email || tenant?.primaryEmail || null,
      website: lvl('website') || identityProfile?.website || null,
      autorisation: identityProfile?.authorizationNumber || null,
      slogan: lvl('slogan') || identityProfile?.slogan || null,
      logoUrl,
    };
  }

  /** Logo en data-URL inline pour Puppeteer (best-effort : valeur brute si échec). */
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
      const candidates = [
        raw,
        path.join(process.cwd(), String(raw).replace(/^\//, '')),
        path.join(process.cwd(), 'uploads', String(raw).replace(/^(\/)?uploads\/?/, '')),
      ];
      for (const c of candidates) {
        try {
          if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            const buf = fs.readFileSync(c);
            const ext = path.extname(c).toLowerCase();
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

  /**
   * Génère le HTML du bulletin de paie avec labels régionaux.
   *
   * ⭐ 161 — refonte du gabarit (retour promoteur) :
   *   · filigrane logo PENCHÉ EN DIAGONALE (45°) ;
   *   · plus AUCUN identifiant en clair — la référence est encodée dans un
   *     QR code discret en pied de page ;
   *   · identité visuelle alignée sur les gabarits FP/EP (bandeau école,
   *     strip de coordonnées, tables gains/retenues séparées) ;
   *   · pagination maîtrisée : en-tête de table répété, lignes insécables,
   *     signatures/pied insécables (les marges répétées sont posées par le
   *     rendu PDF displayHeaderFooter).
   */
  private generatePaySlipHtml(
    payrollItem: any,
    labels: any,
    school: any,
    qrDataUrl: string | null,
  ): string {
    const { staff, payroll } = payrollItem;
    const tenant = payroll?.tenant;
    const academicYear = payroll?.academicYear;

    // Format de date
    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const periodName = periodLabelOf(payroll);
    const schoolName = school?.name || tenant?.name || 'N/A';

    const cnssNumber = staff.employeeCNSS?.cnssNumber || staff.cnssNumber || 'N/A';

    // ⭐ 22/11/2026 — proration par présences (mode « présences » de la période)
    const att = (payrollItem as any)?.attendanceDetail;
    const presences = att && att.mode === 'ATTENDANCE' ? att : null;
    const presencePct = presences
      ? String(Math.round(Number(presences.ratio ?? 1) * 1000) / 10).replace('.', ',')
      : null;
    const baseLabel = presences && Number(presences.ratio) < 1 && !presences.noRecords
      ? `Salaire de base (proraté présences ${presencePct} %)`
      : 'Salaire de base';

    // Filigrane + en-tête logo (onglet Identité — maternelle/primaire ou
    // niveau secondaire selon le personnel).
    // ⭐ 161 — DIAGONALE VRAIE : rotate(-45deg) (le promoteur exige un logo
    // penché en diagonale, pas droit à la verticale).
    const watermark = school?.logoUrl
      ? `<div class="watermark"><img src="${school.logoUrl}" alt="logo" /></div>`
      : '';
    const logoHeader = school?.logoUrl
      ? `<img class="logo-head" src="${school.logoUrl}" alt="logo" />`
      : '';
    const schoolAddr = [school?.address, school?.city].filter(Boolean).map(esc).join(', ');
    const contactSpans = [
      school?.phone ? `<span>Tél. ${esc(school.phone)}</span>` : null,
      school?.phone2 ? `<span>Tél. 2 ${esc(school.phone2)}</span>` : null,
      school?.whatsapp ? `<span>WhatsApp ${esc(school.whatsapp)}</span>` : null,
      school?.email ? `<span>${esc(school.email)}</span>` : null,
      school?.website ? `<span>${esc(school.website)}</span>` : null,
      school?.autorisation ? `<span>Autorisation N° ${esc(school.autorisation)}</span>` : null,
      school?.slogan ? `<span class="slogan">« ${esc(school.slogan)} »</span>` : null,
    ].filter(Boolean).join('');
    const contactsStrip = contactSpans
      ? `<div class="school-contacts">${contactSpans}</div>`
      : '';

    const num = (v: any) => fmtMoney(Number(v ?? 0));
    // ⭐ 161 — affichage monétaire aligné sur les gabarits FP/EP : le franc
    //    CFA (XOF/XAF) s'affiche « FCFA », les autres devises gardent leur code.
    const currencyLabel = ['XOF', 'XAF'].includes(String(labels.currency || '').toUpperCase())
      ? 'FCFA'
      : String(labels.currency || '');
    const hasOtherDeductions = Number(payrollItem.otherDeductions) > 0;
    const totalDeductionsRow = Number(payrollItem.totalDeductions);

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.45; }
    /* ⭐ 161 — logo en FILIGRANE DIAGONAL (45°) : traverse la feuille de coin,
       très léger, sans gêner la lecture — sur CHAQUE page du bulletin. */
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); z-index: 0; opacity: .06; pointer-events: none; }
    .watermark img { width: 330px; height: auto; }
    .band { background: #1e3a5f; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px 4px 0 0; }
    .band .org-wrap { display: flex; gap: 12px; align-items: center; max-width: 66%; }
    .band .logo-head { width: 50px; height: 50px; object-fit: contain; background: #fff; border-radius: 6px; padding: 2px; flex-shrink: 0; }
    .band .org { font-size: 15px; font-weight: 800; letter-spacing: .2px; }
    .band .org .sigle { font-size: 10px; font-weight: 600; opacity: .85; }
    .band .org-sub { font-size: 8.5px; opacity: .85; margin-top: 2px; }
    .band .doc { text-align: right; }
    .band .doc .type { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
    .band .doc .num { font-size: 10px; opacity: .9; margin-top: 2px; font-weight: 600; }
    .school-contacts { display: flex; flex-wrap: wrap; gap: 3px 14px; font-size: 8px; color: #4b5563; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 4px 4px; padding: 5px 10px; background: #f9fafb; }
    .school-contacts .slogan { font-style: italic; color: #6b7280; }
    .identity { border: 1px solid #d1d5db; border-radius: 4px; display: flex; margin-top: 10px; }
    .identity > div { flex: 1; padding: 8px 12px; }
    .identity > div + div { border-left: 1px solid #d1d5db; }
    .identity h4 { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
    .identity p { margin: 1px 0; }
    .identity .hl { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    caption { text-align: left; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; padding: 5px 10px; border-radius: 3px 3px 0 0; color: #fff; background: #1e3a5f; }
    th { font-size: 8px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; text-align: left; padding: 5px 10px; border-bottom: 1.5px solid #d1d5db; background: #f9fafb; }
    th.r, td.r { text-align: right; }
    td { padding: 4.5px 10px; border-bottom: 1px solid #e5e7eb; }
    tr.total td { font-weight: 800; background: #f3f4f6; border-top: 1.5px solid #9ca3af; }
    .net-box { margin-top: 14px; border-radius: 4px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; color: #fff; background: #1e3a5f; page-break-inside: avoid; }
    .net-box .lbl { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; opacity: .92; }
    .net-box .val { font-size: 19px; font-weight: 900; }
    .signature-area { display: flex; gap: 30px; margin-top: 26px; page-break-inside: avoid; }
    .signature-area > div { flex: 1; text-align: center; }
    .signature-area .who { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #374151; }
    .signature-area .box { border: 1px dashed #9ca3af; border-radius: 3px; height: 58px; margin-top: 5px; }
    .doc-footer { margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 7px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
    .doc-footer .mention { font-size: 7.8px; color: #6b7280; max-width: 70%; }
    .qr-wrap { display: flex; align-items: center; gap: 8px; text-align: right; }
    .qr-wrap img { width: 64px; height: 64px; }
    .qr-wrap .cap { font-size: 7.5px; color: #6b7280; }
    /* ⭐ 161 — pagination : l'en-tête de table se répète à chaque page et
       AUCUNE ligne n'est coupée en deux (le tableau ne descend jamais dans
       le pied de page ni ne remonte dans l'en-tête de la page suivante). */
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>${watermark}
  <div class="band">
    <div class="org-wrap">
      ${logoHeader}
      <div>
        <div class="org">${esc(schoolName)}${school?.sigle ? ` <span class="sigle">(${esc(school.sigle)})</span>` : ''}</div>
        ${schoolAddr ? `<div class="org-sub">${schoolAddr}</div>` : ''}
        <div class="org-sub">Année scolaire ${esc(academicYear?.name || 'N/A')}</div>
      </div>
    </div>
    <div class="doc">
      <div class="type">Bulletin de paie</div>
      <div class="num">Période : ${esc(periodName)}</div>
      <div class="num">Émis le ${formatDate(new Date())}</div>
    </div>
  </div>
  ${contactsStrip}

  <div class="identity">
    <div>
      <h4>Salarié</h4>
      <p class="hl">${esc(staff.firstName)} ${esc(staff.lastName)}</p>
      <p>Matricule : <span class="hl">${esc(staff.tenantMatricule || staff.employeeNumber || 'N/A')}</span></p>
      <p>Catégorie : ${esc(staff.roleType || 'N/A')}</p>
      <p>Fonction : ${esc(staff.position || 'Personnel')}</p>
      <p>N° ${esc(labels.social)} : ${esc(cnssNumber)}</p>
    </div>
    <div>
      <h4>Établissement employeur</h4>
      <p class="hl">${esc(schoolName)}</p>
      ${schoolAddr ? `<p>${schoolAddr}</p>` : ''}
      ${school?.phone ? `<p>Tél. ${esc(school.phone)}${school?.phone2 ? ` · ${esc(school.phone2)}` : ''}</p>` : ''}
      ${school?.email ? `<p>${esc(school.email)}</p>` : ''}
      ${presences ? `<p>Présences pointées : <span class="hl">${presences.daysPresent}/${presences.daysExpected} j</span> · taux ${presencePct} %${presences.noRecords ? ' · aucun pointage sur la période' : ''}</p>` : ''}
    </div>
  </div>

  <table>
    <caption>Gains</caption>
    <thead><tr><th>Rubrique</th><th class="r">Montant (${esc(currencyLabel)})</th></tr></thead>
    <tbody>
      <tr><td>${esc(baseLabel)}</td><td class="r">${num(payrollItem.baseSalary)}</td></tr>
      <tr><td>Heures supplémentaires</td><td class="r">${num(payrollItem.overtimeAmount)}</td></tr>
      <tr><td>Indemnités et primes</td><td class="r">${num(payrollItem.bonuses)}</td></tr>
      <tr class="total"><td>SALAIRE BRUT</td><td class="r">${num(payrollItem.grossSalary)}</td></tr>
    </tbody>
  </table>

  <table>
    <caption>Retenues</caption>
    <thead><tr><th>Rubrique</th><th class="r">Montant (${esc(currencyLabel)})</th></tr></thead>
    <tbody>
      <tr><td>Cotisation ${esc(labels.social)} (salariale)</td><td class="r">${num(payrollItem.cnssEmployee)}</td></tr>
      <tr><td>Cotisation ${esc(labels.social)} (patronale — informative)</td><td class="r">${num(payrollItem.cnssEmployer)}</td></tr>
      <tr><td>${esc(labels.tax)}</td><td class="r">${num(payrollItem.irppAmount)}</td></tr>
      ${hasOtherDeductions ? `<tr><td>Autres retenues</td><td class="r">${num(payrollItem.otherDeductions)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL RETENUES (salariales)</td><td class="r">${num(totalDeductionsRow)}</td></tr>
    </tbody>
  </table>

  <div class="net-box">
    <span class="lbl">Net à payer</span>
    <span class="val">${num(payrollItem.netSalary)} ${esc(currencyLabel)}</span>
  </div>

  <div class="signature-area">
    <div>
      <div class="who">Le salarié</div>
      <div class="box"></div>
    </div>
    <div>
      <div class="who">Cachet de l'employeur</div>
      <div class="box"></div>
    </div>
  </div>

  <div class="doc-footer">
    <div class="mention">Ce bulletin de paie est généré par Academia Helm — document à conserver sans limitation de durée. Pour votre sécurité, conservez-le précieusement.</div>
    ${qrDataUrl ? `<div class="qr-wrap"><span class="cap">Vérification d'authenticité<br/>(scan du code)</span><img src="${qrDataUrl}" alt="vérification" /></div>` : ''}
  </div>
</body>
</html>
    `;
  }

  /**
   * ⭐ 161 — QR code de vérification du bulletin : la référence (ID interne /
   * n° de quittance) reste LISIBLE UNIQUEMENT au scan — jamais affichée en
   * clair sur le document (exigence promoteur). Best-effort : null si la
   * librairie qrcode est indisponible (le bulletin reste complet sans QR).
   */
  private async buildQrDataUrl(
    payrollItemId: string,
    receiptNumber: string | null,
    periodLabel: string,
    net: number,
  ): Promise<string | null> {
    try {
      const QRCode: any = await import('qrcode');
      const payload = JSON.stringify({
        app: 'academia-helm',
        doc: 'BULLETIN_DE_PAIE',
        ref: receiptNumber || payrollItemId,
        periode: periodLabel,
        net,
      });
      return await QRCode.toDataURL(payload, {
        margin: 1,
        width: 132,
        errorCorrectionLevel: 'M',
        color: { dark: '#1f2937', light: '#ffffff' },
      });
    } catch {
      return null;
    }
  }

  /**
   * Convertit le HTML en PDF
   *
   * ⭐ 161 — respect strict des limites d'en-tête/pied de page (retour
   * promoteur) : le PDF est émis avec des MARGES réservées et des gabarits
   * d'en-tête/pied répétés sur CHAQUE page — le contenu ne descend jamais
   * dans le pied de page et ne remonte jamais dans l'en-tête de la page
   * suivante ; les lignes de tableau ne sont jamais coupées en deux.
   */
  private async renderPdfFromHtml(html: string, pageOpts: {
    schoolName: string;
    periodLabel: string;
  }): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: [
          `<div style="width:100%;padding:6px 14px 0;display:flex;justify-content:space-between;align-items:flex-end;">`,
          `<span style="font-size:7.5px;color:#475569;font-weight:700;">${esc(pageOpts.schoolName)}</span>`,
          `<span style="font-size:7.5px;color:#94a3b8;">Bulletin de paie · ${esc(pageOpts.periodLabel)}</span>`,
          `</div>`,
          `<div style="width:100%;border-bottom:1px solid #e2e8f0;margin-top:3px;"></div>`,
        ].join(''),
        footerTemplate: [
          `<div style="width:100%;padding:0 14px 6px;display:flex;justify-content:space-between;">`,
          `<span style="font-size:7.5px;color:#94a3b8;">Ce bulletin est généré par Academia Helm — conservez-le précieusement.</span>`,
          `<span style="font-size:7.5px;color:#94a3b8;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>`,
          `</div>`,
        ].join(''),
        margin: { top: '20mm', bottom: '16mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Sauvegarde le PDF sur le cloud storage (R2/S3) avec fallback local
   */
  private async savePdf(
    tenantId: string,
    payrollId: string,
    staffId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const fileName = `payslip-${staffId}-${Date.now()}.pdf`;
    const storageKey = `pay-slips/${tenantId}/${payrollId}/${fileName}`;

    try {
      // Upload to cloud storage (R2/S3/Vercel Blob) for persistence across redeployments
      const result = await this.storageService.uploadBuffer(pdfBuffer, storageKey, 'application/pdf');
      return result;
    } catch (cloudError) {
      // Fallback to local filesystem if cloud upload fails
      this.logger.warn(`Cloud upload failed, falling back to local filesystem: ${cloudError.message}`);
      const uploadsDir = path.join(process.cwd(), 'uploads', 'pay-slips', tenantId, payrollId);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      return `/uploads/pay-slips/${tenantId}/${payrollId}/${fileName}`;
    }
  }

  /**
   * Récupère le PDF d'un bulletin de paie via le SalarySlip
   */
  async getPaySlipPdf(payrollItemId: string, tenantId: string): Promise<Buffer | null> {
    const salarySlip = await this.prisma.salarySlip.findUnique({
      where: { payrollItemId },
    });

    if (!salarySlip || !salarySlip.filePath) return null;

    // Try cloud storage first (R2/S3)
    try {
      if (this.storageService.getStorageType() === 'r2' || this.storageService.getStorageType() === 's3') {
        return await this.storageService.downloadFile(salarySlip.filePath);
      }
    } catch {
      this.logger.warn(`Cloud download failed for ${salarySlip.filePath}, trying local fallback`);
    }

    // Vercel Blob (already a URL)
    if (salarySlip.filePath.startsWith('https://')) {
      return null;
    }

    // Local filesystem fallback
    const absolutePath = path.join(process.cwd(), salarySlip.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('PDF file not found on filesystem');
    }

    return fs.readFileSync(absolutePath);
  }
}
