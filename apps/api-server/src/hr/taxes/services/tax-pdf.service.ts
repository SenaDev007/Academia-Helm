/**
 * ============================================================================
 * TAX PDF SERVICE — Génération PDF des formulaires officiels
 * ============================================================================
 * Génère les PDF officiels pour IST, AIB, CNSS, fiches de paie,
 * états financiers, et notes annexes.
 * ============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
import { StorageService } from '../../../common/services/storage.service';
import { TaxSettingsService } from './tax-settings.service';

@Injectable()
export class TaxPdfService {
  private readonly logger = new Logger(TaxPdfService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private puppeteerPool: PuppeteerPoolService,
    private storageService: StorageService,
    private taxSettingsService: TaxSettingsService,
  ) {}

  /**
   * Génère le PDF de la déclaration IST (format officiel République du Bénin / DGI).
   */
  async generateIstPdf(declarationId: string): Promise<Buffer> {
    const decl = await this.prisma.taxDeclaration.findUnique({ where: { id: declarationId } });
    if (!decl) throw new Error('Déclaration introuvable');

    const data = decl.data as any;
    const header = await this.getReportHeader(decl.tenantId, decl.academicYearId);

    const html = this.buildIstHtml({
      ifu: header?.numeroIF || '',
      denomination: header?.denominationSociale || '',
      activite: header?.activiteDesignation || '',
      adresse: header?.adresse || '',
      period: decl.period,
      nbSalaries: data.staffCount || 0,
      brutSalaires: data.totalGrossSalary || 0,
      irpp: data.irpp || 0,
      vps: data.vps || 0,
      vpsRate: data.vpsRate || 4,
      totalIST: data.totalIST || 0,
    });

    return this.renderPdf(html);
  }

  /**
   * Génère le PDF de la déclaration CNSS (format officiel).
   */
  async generateCnssPdf(declarationId: string): Promise<Buffer> {
    const decl = await this.prisma.taxDeclaration.findUnique({ where: { id: declarationId } });
    if (!decl) throw new Error('Déclaration introuvable');

    const data = decl.data as any;
    const header = await this.getReportHeader(decl.tenantId, decl.academicYearId);

    const html = this.buildCnssHtml({
      raisonSociale: header?.denominationSociale || '',
      employeurNum: header?.numeroCCSS || '',
      period: decl.period,
      totalSalary: data.totalSalary || 0,
      rates: data.rates || {},
      cotisations: {
        familiales: data.cotisationsFamiliales || 0,
        risques: data.risquesPro || 0,
        vieillesse: data.assuranceVieillesse || 0,
        patronale: data.partPatronale || 0,
        ouvriere: data.partOuvriere || 0,
      },
      total: data.totalCotisations || 0,
      staffDetails: data.staffDetails || [],
    });

    return this.renderPdf(html);
  }

  /**
   * Génère le PDF de la déclaration AIB (bordereau officiel).
   */
  async generateAibPdf(declarationId: string): Promise<Buffer> {
    const decl = await this.prisma.taxDeclaration.findUnique({ where: { id: declarationId } });
    if (!decl) throw new Error('Déclaration introuvable');

    const data = decl.data as any;
    const header = await this.getReportHeader(decl.tenantId, decl.academicYearId);

    const html = this.buildAibHtml({
      raisonSociale: header?.denominationSociale || '',
      activite: header?.activiteDesignation || '',
      adresse: header?.adresse || '',
      telephone: header?.numeroTelephone || '',
      ifu: header?.numeroIF || '',
      period: decl.period,
      baseAchats: data.baseAchats || 0,
      basePrestations: data.basePrestations || 0,
      aibAchats: data.aibAchats || 0,
      aibPrestations: data.aibPrestations || 0,
      rates: data.rates || {},
      total: data.totalAIB || 0,
    });

    return this.renderPdf(html);
  }

  /**
   * Génère le PDF d'une fiche de paie individuelle.
   */
  async generatePayslipPdf(payslipId: string): Promise<Buffer> {
    const payslip = await this.prisma.taxPayslip.findUnique({
      where: { id: payslipId },
      include: {
        staff: { select: { firstName: true, lastName: true, position: true, email: true, cnssNumber: true, phone: true } },
      },
    });
    if (!payslip) throw new Error('Fiche de paie introuvable');

    const header = await this.getReportHeader(payslip.tenantId, payslip.academicYearId);

    // Récupérer le logo de l'école
    const ss = await this.prisma.schoolSettings.findFirst({
      where: { tenantId: payslip.tenantId },
      select: { logoUrl: true },
    }).catch(() => null);
    let schoolLogo = ss?.logoUrl || '';
    try { if (schoolLogo) schoolLogo = await this.storageService.resolveFileUrl(schoolLogo); } catch {}

    const html = this.buildPayslipHtml({
      schoolName: header?.denominationSociale || '',
      schoolLogo,
      staffName: `${payslip.staff.firstName} ${payslip.staff.lastName}`,
      staffPosition: payslip.staff.position || '',
      cnssNumber: payslip.staff.cnssNumber || '',
      period: payslip.period,
      rubriques: {
        salaireBase: Number(payslip.salaireBase),
        moinsPerces: Number(payslip.moinsPercesArriere),
        gratifications: Number(payslip.gratificationsEtrennes),
        indemnites: Number(payslip.indemnites),
        primeSalissures: Number(payslip.primeSalissures),
        salaireBrut: Number(payslip.salaireBrut),
        cnssOuvriere: Number(payslip.cnssOuvriere),
        itsNet: Number(payslip.itsNet),
        avanceAcompte: Number(payslip.avanceAcompte),
        opposition: Number(payslip.opposition),
        taxesRadioTele: Number(payslip.taxesRadioTele),
        totalRetenues: Number(payslip.totalRetenues),
        netAPayer: Number(payslip.netAPayer),
      },
    });

    return this.renderPdf(html);
  }

  /**
   * Génère le PDF d'un état financier (Bilan, CR, TFT).
   */
  async generateFinancialStatementPdf(tenantId: string, academicYearId: string, type: string): Promise<Buffer> {
    const lines = await this.prisma.financialStatement.findMany({
      where: { tenantId, academicYearId, type },
      orderBy: { sortOrder: 'asc' },
    });
    const header = await this.getReportHeader(tenantId, academicYearId);

    const titles: Record<string, string> = {
      BILAN_ACTIF: 'BILAN — ACTIF',
      BILAN_PASSIF: 'BILAN — PASSIF',
      COMPTE_RESULTAT: 'COMPTE DE RÉSULTAT',
      TFT: 'TABLEAU DES FLUX DE TRÉSORERIE',
    };

    const html = this.buildFinancialStatementHtml({
      title: titles[type] || type,
      denomination: header?.denominationSociale || '',
      ifu: header?.numeroIF || '',
      exercice: header?.exerciceClosLe || '',
      lines: lines.map(l => ({
        code: l.lineCode,
        label: l.lineLabel,
        note: l.note || '',
        amountN: Number(l.amountN || 0),
        amountN1: Number(l.amountN1 || 0),
        isBold: l.isSubtotal || l.isTotal,
      })),
    });

    return this.renderPdf(html);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async getReportHeader(tenantId: string, academicYearId: string) {
    return this.prisma.financialReportHeader.findFirst({ where: { tenantId, academicYearId } });
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  private fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' FCFA';
  }

  // ─── Templates HTML ─────────────────────────────────────────────────────

  private buildIstHtml(d: any): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #0b2f73;padding-bottom:10px}
.header h1{font-size:14px;color:#0b2f73}.header h2{font-size:12px;margin-top:4px}
.section{margin-bottom:15px}.section h3{background:#0b2f73;color:#fff;padding:4px 8px;font-size:11px;margin-bottom:8px}
.row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #ddd}
.row .label{font-weight:bold}.row .value{font-family:monospace}
.total{background:#f0f2f5;padding:6px;font-weight:bold;font-size:14px;text-align:right}
</style></head><body>
<div class="header"><h1>RÉPUBLIQUE DU BÉNIN</h1><h2>DIRECTION GÉNÉRALE DES IMPÔTS ET DES DOMAINES</h2><h2>IMPÔTS SUR SALAIRES</h2></div>
<div class="section"><h3>I — IDENTIFICATION</h3>
<div class="row"><span class="label">N° IFU:</span><span class="value">${d.ifu}</span></div>
<div class="row"><span class="label">Nom/Raison sociale:</span><span>${d.denomination}</span></div>
<div class="row"><span class="label">Activité:</span><span>${d.activite}</span></div>
<div class="row"><span class="label">Adresse:</span><span>${d.adresse}</span></div>
<div class="row"><span class="label">Période:</span><span>${d.period}</span></div>
</div>
<div class="section"><h3>II — LIQUIDATION DES IMPÔTS SUR SALAIRES</h3>
<div class="row"><span class="label">1. Nombre de salariés:</span><span class="value">${d.nbSalaries}</span></div>
<div class="row"><span class="label">2. Montant brut des salaires:</span><span class="value">${this.fmt(d.brutSalaires)}</span></div>
<div class="row"><span class="label">3. Montant de l'IRPP:</span><span class="value">${this.fmt(d.irpp)}</span></div>
<div class="row"><span class="label">4. Montant du V.P.S. (Ligne 2 × ${d.vpsRate}%):</span><span class="value">${this.fmt(d.vps)}</span></div>
<div class="total">5. Total des impôts sur salaires: ${this.fmt(d.totalIST)}</div>
</div>
</body></html>`;
  }

  private buildCnssHtml(d: any): string {
    const rows = (d.staffDetails || []).map((s: any, i: number) => `
<tr><td>${i+1}</td><td>${s.cnssNumber || ''}</td><td>${s.name}</td><td colspan="3">${this.fmt(s.grossSalary)}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
.header{text-align:center;margin-bottom:15px;border-bottom:2px solid #0b2f73;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #ddd;padding:4px;text-align:left}
th{background:#0b2f73;color:#fff;font-size:10px}
.total{background:#f0f2f5;padding:6px;font-weight:bold;font-size:13px;text-align:right}
</style></head><body>
<div class="header"><h2>CAISSE DE SÉCURITÉ SOCIALE — DÉCLARATION NOMINATIVE TRIMESTRIELLE</h2></div>
<p><strong>Employeur:</strong> ${d.raisonSociale} — N° ${d.employeurNum} — Trimestre: ${d.period}</p>
<table><thead><tr><th>N°</th><th>N° Immat.</th><th>Nom et Prénoms</th><th colspan="3">Salaire brut trimestriel</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6" style="text-align:center">Aucun personnel</td></tr>'}</tbody></table>
<table>
<tr><td>Total salaire S</td><td style="text-align:right;font-weight:bold">${this.fmt(d.totalSalary)}</td></tr>
<tr><td>Cotisations familiales (S × ${d.rates.familiales || 9}%)</td><td style="text-align:right">${this.fmt(d.cotisations.familiales)}</td></tr>
<tr><td>Risques professionnels (S × ${d.rates.risques || 1}%)</td><td style="text-align:right">${this.fmt(d.cotisations.risques)}</td></tr>
<tr><td>Part patronale (S × ${d.rates.patronale || 6.4}%)</td><td style="text-align:right">${this.fmt(d.cotisations.patronale)}</td></tr>
<tr><td>Part ouvrière (S × ${d.rates.ouvriere || 3.6}%)</td><td style="text-align:right">${this.fmt(d.cotisations.ouvriere)}</td></tr>
</table>
<div class="total">TOTAL DES COTISATIONS: ${this.fmt(d.total)}</div>
</body></html>`;
  }

  private buildAibHtml(d: any): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
.header{text-align:center;margin-bottom:15px;border-bottom:2px solid #0b2f73;padding-bottom:8px}
.section h3{background:#0b2f73;color:#fff;padding:4px 8px;font-size:11px;margin-bottom:8px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:left}
th{background:#f0f2f5}.total{background:#0b2f73;color:#fff;padding:8px;font-weight:bold;font-size:14px;text-align:right}
</style></head><body>
<div class="header"><h2>BORDEREAU DE VERSEMENT DES PRÉLÈVEMENTS AIB</h2><p>RÉPUBLIQUE DU BÉNIN — DGI</p></div>
<div class="section"><h3>I — IDENTIFICATION DU REDEVABLE</h3>
<table><tr><td><strong>Nom/Raison sociale:</strong> ${d.raisonSociale}</td><td><strong>N° IFU:</strong> ${d.ifu}</td></tr>
<tr><td><strong>Activité:</strong> ${d.activite}</td><td><strong>Téléphone:</strong> ${d.telephone}</td></tr>
<tr><td colspan="2"><strong>Adresse:</strong> ${d.adresse}</td></tr>
<tr><td colspan="2"><strong>Période:</strong> ${d.period}</td></tr>
</table></div>
<div class="section"><h3>II — LIQUIDATION DES DROITS</h3>
<table><thead><tr><th>Nature</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead>
<tbody>
<tr><td>Achat de marchandises — AIB ${d.rates.achats || 1}%</td><td style="text-align:right">${this.fmt(d.baseAchats)}</td><td style="text-align:center">${d.rates.achats || 1}%</td><td style="text-align:right">${this.fmt(d.aibAchats)}</td></tr>
<tr><td>Prestation de services — AIB ${d.rates.prestations || 5}%</td><td style="text-align:right">${this.fmt(d.basePrestations)}</td><td style="text-align:center">${d.rates.prestations || 5}%</td><td style="text-align:right">${this.fmt(d.aibPrestations)}</td></tr>
</tbody></table></div>
<div class="total">MONTANT TOTAL À REVERSER: ${this.fmt(d.total)}</div>
</body></html>`;
  }

  private buildPayslipHtml(d: any): string {
    const r = d.rubriques;
    const N = '#0b2f73', B = '#1d4fa5', G = '#f5b335';
    // Format 2 fiches par page (comme le fichier Excel)
    const ficheHtml = `
<div class="fiche">
  <div class="fiche-header">
    ${d.schoolLogo ? `<img src="${d.schoolLogo}" alt="${d.schoolName}" style="max-height:40px;max-width:120px;object-fit:contain;" />` : ''}
    <div class="school-info">
      <h2>${d.schoolName}</h2>
      <p class="period">FICHE DE PAIE — Mois de ${d.period}</p>
    </div>
  </div>
  <div class="employer-ref">
    <table class="ref-table"><tbody>
    <tr><td><strong>NOM:</strong> ${d.staffName}</td><td><strong>FONCTION:</strong> ${d.staffPosition}</td></tr>
    <tr><td><strong>N° CNSS:</strong> ${d.cnssNumber || '—'}</td><td><strong>Mois de:</strong> ${d.period}</td></tr>
    </tbody></table>
  </div>
  <table class="rubriques">
    <thead><tr><th>RUBRIQUES</th><th style="text-align:right">MONTANTS</th></thead>
    <tbody>
    <tr><td>SALAIRE DE BASE</td><td style="text-align:right">${this.fmt(r.salaireBase)}</td></tr>
    <tr><td>Moins perçus / arriéré</td><td style="text-align:right">${this.fmt(r.moinsPerces)}</td></tr>
    <tr><td>Gratifications et étrennes</td><td style="text-align:right">${this.fmt(r.gratifications)}</td></tr>
    <tr><td>Indemnités</td><td style="text-align:right">${this.fmt(r.indemnites)}</td></tr>
    <tr><td>Prime de Salissures</td><td style="text-align:right">${this.fmt(r.primeSalissures)}</td></tr>
    <tr style="font-weight:bold;background:${N};color:#fff;"><td>SALAIRE BRUT</td><td style="text-align:right">${this.fmt(r.salaireBrut)}</td></tr>
    <tr><td colspan="2" style="background:#f8fafc;font-weight:bold;font-size:10px;">RETENUES</td></tr>
    <tr><td style="padding-left:20px;">CNSS (Part ouvrière) 3,6%</td><td style="text-align:right">${this.fmt(r.cnssOuvriere)}</td></tr>
    <tr><td style="padding-left:20px;">ITS net</td><td style="text-align:right">${this.fmt(r.itsNet)}</td></tr>
    <tr><td style="padding-left:20px;">Avance et Acompte</td><td style="text-align:right">${this.fmt(r.avanceAcompte)}</td></tr>
    <tr><td style="padding-left:20px;">Opposition</td><td style="text-align:right">${this.fmt(r.opposition)}</td></tr>
    <tr><td style="padding-left:20px;">Taxes Radio/Télé</td><td style="text-align:right">${this.fmt(r.taxesRadioTele)}</td></tr>
    <tr style="font-weight:bold;"><td>TOTAL RETENUES</td><td style="text-align:right">${this.fmt(r.totalRetenues)}</td></tr>
    <tr style="font-weight:bold;font-size:14px;background:${G}30;"><td>NET À PAYER</td><td style="text-align:right">${this.fmt(r.netAPayer)}</td></tr>
    </tbody>
  </table>
  <div class="signatures">
    <div class="sig-block">
      <p>Arrêté la présente Fiche de Paie à la somme de:</p>
      <p style="font-style:italic;border-bottom:1px solid #ddd;padding:8px 0;margin:8px 0;">${this.fmt(r.netAPayer)}</p>
      <div style="display:flex;justify-content:space-between;margin-top:20px;">
        <div style="text-align:center;"><p style="font-size:10px;font-weight:bold;">Le Directeur</p><p style="border-top:1px solid #333;margin-top:30px;padding-top:4px;font-size:9px;">Signature et cachet</p></div>
        <div style="text-align:center;"><p style="font-size:10px;font-weight:bold;">L'Employé(e)</p><p style="border-top:1px solid #333;margin-top:30px;padding-top:4px;font-size:9px;">Signature</p></div>
      </div>
    </div>
  </div>
</div>`;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;padding:15px;font-size:11px;color:#0f172a}
.fiche{border:2px solid ${N};border-radius:10px;overflow:hidden;margin-bottom:20px;box-shadow:0 2px 8px rgba(11,47,115,.08)}
.fiche-header{background:linear-gradient(135deg,${N} 0%,${B} 100%);padding:12px 16px;display:flex;align-items:center;gap:12px}
.fiche-header h2{color:#fff;font-size:16px}
.fiche-header .period{color:${G};font-size:11px;margin-top:2px}
.school-info{flex:1}
.employer-ref{padding:8px 16px;border-bottom:1px solid #e2e8f0}
.ref-table{width:100%}.ref-table td{padding:2px 0;font-size:11px}
.rubriques{width:100%;border-collapse:collapse}.rubriques th{background:${N};color:#fff;padding:4px 8px;font-size:10px;text-align:left}
.rubriques td{padding:3px 8px;border-bottom:1px solid #f1f5f9;font-size:11px}
.signatures{padding:12px 16px;border-top:1px solid #e2e8f0}
.sig-block p{font-size:10px;color:#475569}
@media print{.fiche{page-break-after:always}.fiche:last-child{page-break-after:auto}}
</style></head><body>
${ficheHtml}
${ficheHtml}
</body></html>`;
  }

  private buildFinancialStatementHtml(d: any): string {
    const rows = d.lines.map((l: any) => `
<tr${l.isBold ? ' style="background:#f0f2f5;font-weight:bold"' : ''}>
<td style="font-family:monospace;font-size:10px;width:40px">${l.code}</td>
<td>${l.label}</td>
<td style="text-align:center;width:40px">${l.note}</td>
<td style="text-align:right;width:120px">${l.amountN ? this.fmt(l.amountN) : ''}</td>
<td style="text-align:right;width:120px">${l.amountN1 ? this.fmt(l.amountN1) : ''}</td>
</tr>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
.header{text-align:center;margin-bottom:15px;border-bottom:2px solid #0b2f73;padding-bottom:8px}
.header h2{color:#0b2f73}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px}
th{background:#0b2f73;color:#fff;font-size:10px}
</style></head><body>
<div class="header"><h2>${d.title}</h2><p>${d.denomination} — IFU: ${d.ifu} — Exercice clos le: ${d.exercice}</p></div>
<table><thead><tr><th>REF</th><th>LIBELLÉ</th><th>Note</th><th style="text-align:right">EXERCICE N</th><th style="text-align:right">EXERCICE N-1</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
  }
}
