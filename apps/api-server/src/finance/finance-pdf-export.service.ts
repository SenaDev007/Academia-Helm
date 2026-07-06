/**
 * ============================================================================
 * FINANCE PDF EXPORT SERVICE — Génération PDF via Puppeteer (HTML → PDF)
 * ============================================================================
 *
 * Reproduit exactement le design du module élève (class-list-pdf.service.ts) :
 *   - En-tête officielle République du Bénin avec drapeau, ministère, logo
 *   - Séparateurs design (ligne + losange + ligne)
 *   - Tableau stylé avec en-tête bleu marine
 *   - Pied de page avec date de génération
 *
 * Utilise PuppeteerPoolService pour rendre du HTML en PDF A4.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { Response } from 'express';

@Injectable()
export class FinancePdfExportService {
  private readonly logger = new Logger(FinancePdfExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Récupère le branding du tenant (logo, nom, contact).
   */
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
          slogan: true,
        },
      });

      const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
        || 'https://academia-helm-api.fly.dev';
      const logoUrl = profile?.logoUrl
        ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
        : null;

      if (profile?.schoolName) {
        return {
          schoolName: profile.schoolName,
          schoolLogoUrl: logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          schoolSlogan: profile.slogan,
        };
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return { schoolName: tenant?.name || 'Établissement', schoolLogoUrl: logoUrl };
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed: ${err.message}`);
      return { schoolName: 'Établissement' };
    }
  }

  /**
   * Drapeau du Bénin en SVG inline (pour HTML).
   */
  private get beninFlagSvg(): string {
    return `<svg width="50" height="34" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="17" height="34" fill="#00613C"/>
      <rect x="17" y="0" width="33" height="17" fill="#FCD116"/>
      <rect x="17" y="17" width="33" height="17" fill="#E8112D"/>
    </svg>`;
  }

  /**
   * Génère l'en-tête HTML officielle (commun à tous les documents).
   */
  private buildHeaderHtml(branding: any, ministry: string, documentTitle: string, subtitle?: string): string {
    const contactInfo = [
      branding.schoolSlogan ? `« ${branding.schoolSlogan} »` : null,
      branding.schoolAddress,
      branding.schoolPhone ? `Tél : ${branding.schoolPhone}` : null,
      branding.schoolEmail ? `Email : ${branding.schoolEmail}` : null,
    ].filter(Boolean).join(' · ');

    const logoBlock = branding.schoolLogoUrl
      ? `<img src="${branding.schoolLogoUrl}" alt="Logo" style="max-width:60px;max-height:60px;object-fit:contain;" />`
      : '';

    return `
      <div class="header">
        <table class="header-table">
          <tr>
            <td class="header-left">${this.beninFlagSvg}</td>
            <td class="header-center">
              <div class="republique">République du Bénin</div>
              <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
              <div class="ministere">${ministry}</div>
              <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
              <div class="school-name">${branding.schoolName || 'Établissement'}</div>
              ${contactInfo ? `<div class="school-info">${contactInfo}</div>` : ''}
            </td>
            <td class="header-right">${logoBlock}</td>
          </tr>
        </table>
      </div>
      <div class="document-title">${documentTitle}</div>
      ${subtitle ? `<div class="document-subtitle">${subtitle}</div>` : ''}
    `;
  }

  /**
   * CSS commun pour tous les documents PDF.
   */
  private getCommonCss(): string {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; font-size: 13px; }

      /* En-tête officiel */
      .header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 3px double #0D1F6E; }
      .header-table { width: 100%; border-collapse: collapse; }
      .header-table td { vertical-align: middle; padding: 4px 8px; }
      .header-left { text-align: center; width: 18%; }
      .header-center { text-align: center; width: 64%; }
      .header-right { text-align: center; width: 18%; }
      .republique { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .divider { margin: 6px auto; width: 55%; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .divider-line { flex: 1; height: 1px; background: #0D1F6E; }
      .divider-diamond { width: 6px; height: 6px; background: #0D1F6E; transform: rotate(45deg); flex-shrink: 0; }
      .ministere { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.4; }
      .school-name { font-size: 15px; font-weight: bold; text-transform: uppercase; margin-top: 6px; line-height: 1.3; }
      .school-info { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.4; }

      /* Titre du document */
      .document-title { text-align: center; font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 25px 0 10px; color: #0D1F6E; text-decoration: underline; text-underline-offset: 4px; }
      .document-subtitle { text-align: center; font-size: 12px; color: #555; margin-bottom: 20px; }

      /* Tableau */
      table.data { width: 100%; border-collapse: collapse; margin-top: 5px; }
      table.data th { background: #0D1F6E; color: #fff; padding: 8px; border: 1px solid #0D1F6E; font-size: 12px; text-transform: uppercase; }
      table.data td { font-size: 12px; padding: 6px 8px; border: 1px solid #ddd; }
      table.data tr:nth-child(even) { background: #f8fafc; }

      /* Ligne total */
      .total-row td { background: #fef3c7 !important; font-weight: bold; color: #92400E; border: 2px solid #92400E !important; }

      /* Statut colors */
      .status-solde { background: #d1fae5; color: #065f46; font-weight: bold; }
      .status-partiel { background: #fef3c7; color: #92400e; font-weight: bold; }
      .status-impaye { background: #fee2e2; color: #991b1b; font-weight: bold; }

      /* Montant */
      .amount { color: #065f46; font-weight: bold; text-align: right; }
      .amount-in { color: #065f46; font-weight: bold; }
      .amount-out { color: #991b1b; font-weight: bold; }

      /* Footer */
      .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
    `;
  }

  /**
   * Convertit le HTML en PDF via Puppeteer et envoie la réponse.
   */
  private async generatePdf(html: string, res: Response, filename: string) {
    const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${this.getCommonCss()}</style></head><body>${html}<div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></body></html>`;

    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });

      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Génère le PDF des encaissements.
   */
  async exportTransactionsPdf(
    tenantId: string,
    academicYearId: string,
    dateFrom?: string,
    dateTo?: string,
    res?: Response,
  ) {
    const branding = await this.getTenantBranding(tenantId);
    const ministry = "Ministère des Enseignements Maternel et Primaire";

    // Récupérer les transactions
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        tenantId,
        academicYearId,
        ...(dateFrom || dateTo ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59') } : {}),
          },
        } : {}),
      },
      include: {
        studentAccount: {
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const subtitle = [
      dateFrom && dateTo ? `Période : ${new Date(dateFrom).toLocaleDateString('fr-FR')} → ${new Date(dateTo).toLocaleDateString('fr-FR')}` : null,
    ].filter(Boolean).join(' · ');

    const rows = transactions.map(t => `
      <tr>
        <td style="text-align:center;">${new Date(t.createdAt).toLocaleDateString('fr-FR')} ${new Date(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="text-align:center;font-family:monospace;">${t.receiptNumber || '—'}</td>
        <td style="text-align:center;">${t.studentAccount?.student?.matricule || '—'}</td>
        <td>${t.studentAccount?.student ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}` : '—'}</td>
        <td class="amount">${Number(t.amount).toLocaleString('fr-FR')}</td>
        <td style="text-align:center;">${t.paymentMethod}</td>
        <td style="text-align:center;">${t.reference || '—'}</td>
      </tr>
    `).join('');

    const html = `
      ${this.buildHeaderHtml(branding, ministry, 'Historique des encaissements', subtitle)}
      <table class="data">
        <thead>
          <tr>
            <th style="width:14%;">Date</th>
            <th style="width:14%;">Reçu</th>
            <th style="width:10%;">Matricule</th>
            <th>Élève</th>
            <th style="width:12%;text-align:right;">Montant (FCFA)</th>
            <th style="width:10%;">Méthode</th>
            <th style="width:12%;">Référence</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">Aucune transaction</td></tr>'}
          <tr class="total-row">
            <td colspan="4" style="text-align:right;">TOTAL</td>
            <td class="amount">${totalAmount.toLocaleString('fr-FR')}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    `;

    await this.generatePdf(html, res, 'encaissements.pdf');
  }

  /**
   * Génère le PDF des comptes élèves.
   */
  async exportStudentAccountsPdf(
    tenantId: string,
    academicYearId: string,
    res?: Response,
  ) {
    const branding = await this.getTenantBranding(tenantId);
    const ministry = "Ministère des Enseignements Maternel et Primaire";

    const accounts = await this.prisma.studentAccount.findMany({
      where: { tenantId, academicYearId },
      include: {
        student: {
          select: {
            firstName: true, lastName: true, studentCode: true,
            schoolLevel: { select: { name: true } },
            studentEnrollments: { include: { class: { select: { name: true } } }, take: 1 },
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const totalDue = accounts.reduce((s, a) => s + Number(a.totalDue ?? 0), 0);
    const totalPaid = accounts.reduce((s, a) => s + Number(a.totalPaid ?? 0), 0);
    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);

    const rows = accounts.map(a => {
      const balance = Number(a.balance ?? 0);
      const paid = Number(a.totalPaid ?? 0);
      let statusClass = 'status-impaye';
      let statusLabel = 'Impayé';
      if (balance <= 0) { statusClass = 'status-solde'; statusLabel = 'Soldé'; }
      else if (paid > 0) { statusClass = 'status-partiel'; statusLabel = 'Partiel'; }

      return `
        <tr>
          <td style="text-align:center;font-family:monospace;">${a.student?.studentCode || '—'}</td>
          <td>${a.student?.lastName || '—'}</td>
          <td>${a.student?.firstName || '—'}</td>
          <td style="text-align:center;">${a.student?.studentEnrollments?.[0]?.class?.name || '—'}</td>
          <td style="text-align:center;">${a.student?.schoolLevel?.name || '—'}</td>
          <td class="amount">${Number(a.balance ?? 0).toLocaleString('fr-FR')}</td>
          <td class="amount">${Number(a.totalPaid ?? 0).toLocaleString('fr-FR')}</td>
          <td class="amount">${Number(a.totalDue ?? 0).toLocaleString('fr-FR')}</td>
          <td style="text-align:center;" class="${statusClass}">${statusLabel}</td>
        </tr>
      `;
    }).join('');

    const html = `
      ${this.buildHeaderHtml(branding, ministry, 'Comptes élèves')}
      <table class="data">
        <thead>
          <tr>
            <th style="width:10%;">Matricule</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th style="width:10%;">Classe</th>
            <th style="width:8%;">Niveau</th>
            <th style="width:12%;text-align:right;">Solde dû</th>
            <th style="width:12%;text-align:right;">Payé</th>
            <th style="width:12%;text-align:right;">À payer</th>
            <th style="width:8%;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#999;">Aucun compte élève</td></tr>'}
          <tr class="total-row">
            <td colspan="5" style="text-align:right;">TOTAL</td>
            <td class="amount">${totalBalance.toLocaleString('fr-FR')}</td>
            <td class="amount">${totalPaid.toLocaleString('fr-FR')}</td>
            <td class="amount">${totalDue.toLocaleString('fr-FR')}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;

    await this.generatePdf(html, res, 'comptes-eleves.pdf');
  }

  /**
   * Génère le PDF d'une caisse spécifique.
   */
  async exportCashRegisterPdf(
    tenantId: string,
    registerId: string,
    res?: Response,
  ) {
    const branding = await this.getTenantBranding(tenantId);
    const ministry = "Ministère des Enseignements Maternel et Primaire";

    const register = await this.prisma.cashRegister.findFirst({
      where: { id: registerId, tenantId },
    });
    if (!register) throw new Error('Caisse non trouvée');

    const transactions = await this.prisma.financeTransaction.findMany({
      where: { cashRegisterId: registerId, tenantId },
      include: {
        studentAccount: {
          include: { student: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const transfers = await this.prisma.$queryRawUnsafe(`
      SELECT t.*, fr.code as "fromCode", tr.code as "toCode"
      FROM "cash_register_transfers" t
      LEFT JOIN cash_registers fr ON t."fromCashRegisterId" = fr.id
      LEFT JOIN cash_registers tr ON t."toCashRegisterId" = tr.id
      WHERE t."tenantId" = $1 AND (t."fromCashRegisterId" = $2 OR t."toCashRegisterId" = $2)
      ORDER BY t."createdAt" DESC LIMIT 100
    `, tenantId, registerId);

    const totalIn = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const transfersIn = (transfers as any[]).filter(t => t.toCashRegisterId === registerId).reduce((s, t) => s + Number(t.amount), 0);
    const transfersOut = (transfers as any[]).filter(t => t.fromCashRegisterId === registerId).reduce((s, t) => s + Number(t.amount), 0);

    const txRows = transactions.map(t => `
      <tr>
        <td style="text-align:center;">${new Date(t.createdAt).toLocaleDateString('fr-FR')} ${new Date(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="text-align:center;font-family:monospace;">${t.receiptNumber || '—'}</td>
        <td>${t.studentAccount?.student ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}` : '—'}</td>
        <td class="amount">${Number(t.amount).toLocaleString('fr-FR')}</td>
        <td style="text-align:center;">${t.paymentMethod}</td>
        <td style="text-align:center;">${t.reference || '—'}</td>
      </tr>
    `).join('');

    const trRows = (transfers as any[]).map(t => {
      const isIn = t.toCashRegisterId === registerId;
      return `
        <tr>
          <td style="text-align:center;">${new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
          <td style="text-align:center;" class="${isIn ? 'amount-in' : 'amount-out'}">${isIn ? 'ENTRANT' : 'SORTANT'}</td>
          <td style="text-align:center;">${t.fromCode || '—'}</td>
          <td style="text-align:center;">${t.toCode || '—'}</td>
          <td class="${isIn ? 'amount-in' : 'amount-out'}" style="text-align:right;">${Number(t.amount).toLocaleString('fr-FR')}</td>
          <td>${t.note || '—'}</td>
        </tr>
      `;
    }).join('');

    const html = `
      ${this.buildHeaderHtml(branding, ministry, `Caisse : ${register.code} — ${register.name}`, `Solde courant : ${Number(register.currentBalance).toLocaleString('fr-FR')} FCFA`)}
      <h3 style="margin:15px 0 5px;color:#0D1F6E;font-size:14px;">Section 1 — Encaissements (paiements élèves)</h3>
      <table class="data">
        <thead><tr><th style="width:15%;">Date</th><th style="width:15%;">Reçu</th><th>Élève</th><th style="width:12%;text-align:right;">Montant (FCFA)</th><th style="width:10%;">Méthode</th><th style="width:12%;">Référence</th></tr></thead>
        <tbody>
          ${txRows || '<tr><td colspan="6" style="text-align:center;padding:15px;color:#999;">Aucune transaction</td></tr>'}
          <tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL ENCAISSEMENTS</td><td class="amount">${totalIn.toLocaleString('fr-FR')}</td><td colspan="2"></td></tr>
        </tbody>
      </table>
      <h3 style="margin:20px 0 5px;color:#0D1F6E;font-size:14px;">Section 2 — Transferts inter-caisses</h3>
      <table class="data">
        <thead><tr><th style="width:15%;">Date</th><th style="width:10%;">Type</th><th style="width:12%;">Source</th><th style="width:12%;">Cible</th><th style="width:12%;text-align:right;">Montant</th><th>Note</th></tr></thead>
        <tbody>
          ${trRows || '<tr><td colspan="6" style="text-align:center;padding:15px;color:#999;">Aucun transfert</td></tr>'}
          <tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL ENTRANT</td><td class="amount-in" style="text-align:right;">${transfersIn.toLocaleString('fr-FR')}</td><td></td></tr>
          <tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL SORTANT</td><td class="amount-out" style="text-align:right;">${transfersOut.toLocaleString('fr-FR')}</td><td></td></tr>
          <tr class="total-row"><td colspan="4" style="text-align:right;">SOLDE NET</td><td class="amount" style="text-align:right;">${(totalIn + transfersIn - transfersOut).toLocaleString('fr-FR')}</td><td></td></tr>
        </tbody>
      </table>
    `;

    await this.generatePdf(html, res, `caisse-${register.code}.pdf`);
  }

  /**
   * Génère le PDF global de toutes les caisses.
   */
  async exportAllCashRegistersPdf(
    tenantId: string,
    res?: Response,
  ) {
    const branding = await this.getTenantBranding(tenantId);
    const ministry = "Ministère des Enseignements Maternel et Primaire";

    const registers = await this.prisma.cashRegister.findMany({
      where: { tenantId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { code: 'asc' },
    });

    const transfers = await this.prisma.$queryRawUnsafe(`
      SELECT t.*, fr.code as "fromCode", tr.code as "toCode"
      FROM "cash_register_transfers" t
      LEFT JOIN cash_registers fr ON t."fromCashRegisterId" = fr.id
      LEFT JOIN cash_registers tr ON t."toCashRegisterId" = tr.id
      WHERE t."tenantId" = $1
      ORDER BY t."createdAt" DESC LIMIT 200
    `, tenantId);

    const totalBalance = registers.reduce((s, r) => s + Number(r.currentBalance ?? 0), 0);
    const totalTransfers = (transfers as any[]).reduce((s, t) => s + Number(t.amount), 0);

    const regRows = registers.map(r => `
      <tr>
        <td style="text-align:center;font-weight:bold;">${r.code}</td>
        <td>${r.name}</td>
        <td style="text-align:center;">${r.location || '—'}</td>
        <td class="amount">${Number(r.openingBalance ?? 0).toLocaleString('fr-FR')}</td>
        <td class="amount">${Number(r.currentBalance ?? 0).toLocaleString('fr-FR')}</td>
        <td style="text-align:center;">${r._count?.transactions || 0}</td>
        <td style="text-align:center;">${r.isOpen ? 'Ouverte' : (r.isActive ? 'Fermée' : 'Archivée')}</td>
      </tr>
    `).join('');

    const trRows = (transfers as any[]).map(t => `
      <tr>
        <td style="text-align:center;">${new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
        <td style="text-align:center;">${t.fromCode || '—'}</td>
        <td style="text-align:center;">${t.toCode || '—'}</td>
        <td class="amount">${Number(t.amount).toLocaleString('fr-FR')}</td>
        <td>${t.note || '—'}</td>
      </tr>
    `).join('');

    const html = `
      ${this.buildHeaderHtml(branding, ministry, 'Vue globale — Toutes les caisses')}
      <table class="data">
        <thead><tr><th style="width:8%;">Code</th><th>Nom</th><th style="width:15%;">Emplacement</th><th style="width:12%;text-align:right;">Solde ouverture</th><th style="width:12%;text-align:right;">Solde courant</th><th style="width:8%;">Nb tx</th><th style="width:10%;">Statut</th></tr></thead>
        <tbody>
          ${regRows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">Aucune caisse</td></tr>'}
          <tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL</td><td class="amount">${totalBalance.toLocaleString('fr-FR')}</td><td colspan="2"></td></tr>
        </tbody>
      </table>
      <h3 style="margin:20px 0 5px;color:#0D1F6E;font-size:14px;">Transferts inter-caisses</h3>
      <table class="data">
        <thead><tr><th style="width:15%;">Date</th><th style="width:15%;">Source</th><th style="width:15%;">Cible</th><th style="width:12%;text-align:right;">Montant (FCFA)</th><th>Note</th></tr></thead>
        <tbody>
          ${trRows || '<tr><td colspan="5" style="text-align:center;padding:15px;color:#999;">Aucun transfert</td></tr>'}
          <tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td><td class="amount">${totalTransfers.toLocaleString('fr-FR')}</td><td></td></tr>
        </tbody>
      </table>
    `;

    await this.generatePdf(html, res, 'multi-caisses-global.pdf');
  }
}
