/**
 * ============================================================================
 * SHOP PDF SERVICE — Génération PDF pour Catalogue / Paiements / Stocks
 * ============================================================================
 *
 * Génère 3 types de PDF pour le module Boutique, avec le même en-tête
 * officiel (République du Bénin + drapeau + ministère + nom école + logo +
 * slogan + contacts) que les listes d'élèves (class-list-pdf.service.ts).
 *
 *   1. Catalogue — liste de tous les produits (nom, code, prix, stock,
 *      catégorie)
 *   2. Historique des paiements — liste des ventes sur une période
 *      (startDate → endDate), avec filtre par date
 *   3. Stocks — liste du stock (produit, quantité, seuil, valeur)
 *
 * Pattern identique à class-list-pdf.service.ts : PuppeteerPoolService +
 * HTML inline → PDF A4.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';

@Injectable()
export class ShopPdfService {
  private readonly logger = new Logger(ShopPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Récupère le branding de l'école (nom, logo, slogan, contacts).
   * Pattern identique à class-list-pdf.service.ts getTenantBranding().
   */
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { version: 'desc' },
      });
      const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
      let logoUrl: string | null = (profile as any)?.logoUrl || null;
      if (logoUrl && !logoUrl.startsWith('http')) {
        logoUrl = `${publicUrl}/${logoUrl.replace(/^\/+/, '')}`;
      }
      return {
        schoolName: profile?.schoolName || 'Établissement',
        schoolLogo: logoUrl,
        schoolAddress: (profile as any)?.address || null,
        schoolPhone: (profile as any)?.phonePrimary || null,
        schoolEmail: (profile as any)?.email || null,
        schoolSlogan: (profile as any)?.devise || null,
      };
    } catch {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      return { schoolName: tenant?.name || 'Établissement', schoolLogo: null, schoolAddress: null, schoolPhone: null, schoolEmail: null, schoolSlogan: null };
    }
  }

  /**
   * Récupère le nom de l'année scolaire.
   */
  private async getAcademicYearName(academicYearId: string): Promise<string> {
    try {
      const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
      return year?.name || '—';
    } catch {
      return '—';
    }
  }

  /**
   * CSS partagé — identique à class-list-pdf.service.ts SHARED_CSS.
   */
  private readonly SHARED_CSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; font-size: 13px; }
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
    .document-title { text-align: center; font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 25px 0 15px; color: #0D1F6E; text-decoration: underline; text-underline-offset: 4px; }
    .info-bar { display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 20px; padding: 0 5px; }
    table.data { width: 100%; border-collapse: collapse; margin-top: 5px; }
    table.data th { background: #0D1F6E; color: #fff; padding: 8px; border: 1px solid #0D1F6E; font-size: 12px; text-transform: uppercase; }
    table.data td { font-size: 12px; padding: 6px 8px; border: 1px solid #ddd; }
    table.data tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
  `;

  /**
   * Construit le header HTML (commun aux 3 PDFs).
   * ⭐ Le ministère s'affiche en fonction du niveau scolaire de l'établissement,
   *    comme dans class-list-pdf.service.ts :
   *    - Maternelle/Primaire → "Ministère des Enseignements Maternel et Primaire"
   *    - Secondaire → "Ministère de l'Enseignement Secondaire, de la Formation
   *      Technique et Professionnelle, de la Reconversion et l'Insertion des Jeunes"
   *    - Mixte (les deux niveaux) → on affiche les deux ministères l'un sous l'autre
   */
  private buildHeader(branding: any, isSecondary: boolean, hasBothLevels: boolean): string {
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;
    const schoolLogoBlock = branding.schoolLogo
      ? `<img src="${branding.schoolLogo}" alt="Logo" style="max-width:60px;max-height:60px;object-fit:contain;" />`
      : `<div style="width:55px;height:55px;border:2px solid #0D1F6E;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;color:#0D1F6E;">${(branding.schoolName || 'EC').substring(0, 2).toUpperCase()}</div>`;
    const contactInfo = [
      branding.schoolSlogan ? `« ${branding.schoolSlogan} »` : null,
      branding.schoolAddress,
      branding.schoolPhone ? `Tél : ${branding.schoolPhone}` : null,
      branding.schoolEmail ? `Email : ${branding.schoolEmail}` : null,
    ].filter(Boolean).join(' · ');

    // ⭐ Déterminer le(s) ministère(s) à afficher selon le niveau scolaire
    const ministryPrimary = `Ministère des Enseignements Maternel et Primaire`;
    const ministrySecondary = `Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et l'Insertion des Jeunes`;
    let ministryHtml: string;
    if (hasBothLevels) {
      // Établissement mixte (primaire + secondaire) → afficher les deux
      ministryHtml = `<div class="ministere">${ministryPrimary}</div>
          <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
          <div class="ministere">${ministrySecondary}</div>`;
    } else {
      ministryHtml = `<div class="ministere">${isSecondary ? ministrySecondary : ministryPrimary}</div>`;
    }

    return `
  <div class="header">
    <table class="header-table">
      <tr>
        <td class="header-left"><img src="${beninFlag}" alt="Drapeau du Bénin" style="width:50px;height:34px;" /></td>
        <td class="header-center">
          <div class="republique">République du Bénin</div>
          <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
          ${ministryHtml}
          <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
          <div class="school-name">${branding.schoolName || 'Établissement'}</div>
          ${contactInfo ? `<div class="school-info">${contactInfo}</div>` : ''}
        </td>
        <td class="header-right">${schoolLogoBlock}</td>
      </tr>
    </table>
  </div>`;
  }

  /**
   * ⭐ Détermine les niveaux scolaires actifs de l'établissement pour
   *    afficher le bon ministère dans l'en-tête. Retourne :
   *    { isSecondary: boolean, hasBothLevels: boolean }
   *    - isSecondary = true si l'établissement a au moins un niveau secondaire
   *    - hasBothLevels = true si l'établissement a à la fois primaire ET secondaire
   */
  private async getSchoolLevelInfo(tenantId: string): Promise<{ isSecondary: boolean; hasBothLevels: boolean }> {
    try {
      const levels = await this.prisma.schoolLevel.findMany({
        where: { tenantId, isActive: true },
        select: { code: true, name: true },
      });
      const hasPrimary = levels.some((l: any) => {
        const code = (l.code || '').toUpperCase();
        return code.includes('MATERNELLE') || code.includes('PRIMAIRE') || code.includes('MAT_PRI');
      });
      const hasSecondary = levels.some((l: any) => {
        const code = (l.code || '').toUpperCase();
        return code.includes('SECONDAIRE') || code.includes('SECOND');
      });
      return {
        isSecondary: hasSecondary && !hasPrimary, // true seulement si secondaire uniquement
        hasBothLevels: hasPrimary && hasSecondary,
      };
    } catch {
      // Fallback : si on ne peut pas déterminer, on utilise le primaire par défaut
      return { isSecondary: false, hasBothLevels: false };
    }
  }

  /**
   * Génère le PDF final via Puppeteer.
   */
  private async generatePdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
        printBackground: true,
      });
      return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  // ─── 1. CATALOGUE ────────────────────────────────────────────────────────

  /**
   * Génère le PDF du catalogue (liste de tous les produits).
   */
  async generateCataloguePdf(
    tenantId: string,
    academicYearId: string,
  ): Promise<Buffer> {
    const [branding, yearName, products, levelInfo] = await Promise.all([
      this.getTenantBranding(tenantId),
      this.getAcademicYearName(academicYearId),
      this.prisma.shopProduct.findMany({
        where: { tenantId, academicYearId, isActive: true },
        include: { stock: true, category: true },
        orderBy: { name: 'asc' },
      }),
      this.getSchoolLevelInfo(tenantId),
    ]);

    const rows = products.map((p: any, i: number) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="font-weight:600;">${p.name || '—'}</td>
        <td style="text-align:center;font-size:10px;">${p.code || '—'}</td>
        <td>${p.category?.name || '—'}</td>
        <td style="text-align:right;">${Number(p.unitPrice).toLocaleString('fr-FR')}</td>
        <td style="text-align:center;">${p.stock?.quantity ?? 0}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Catalogue Boutique</title><style>${this.SHARED_CSS}</style></head><body>
      ${this.buildHeader(branding, levelInfo.isSecondary, levelInfo.hasBothLevels)}
      <div class="document-title">Catalogue Boutique</div>
      <div class="info-bar">
        <span><strong>Année scolaire</strong> : ${yearName}</span>
        <span><strong>Total produits</strong> : ${products.length}</span>
        <span><strong>Date</strong> : ${new Date().toLocaleDateString('fr-FR')}</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th style="width:40px;">N°</th>
            <th>Produit</th>
            <th style="width:80px;">Code</th>
            <th>Catégorie</th>
            <th style="width:100px;text-align:right;">Prix unitaire</th>
            <th style="width:60px;">Stock</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Aucun produit dans le catalogue</td></tr>'}
        </tbody>
      </table>
      <div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')}</div>
    </body></html>`;

    return this.generatePdf(html);
  }

  // ─── 2. HISTORIQUE DES PAIEMENTS ────────────────────────────────────────

  /**
   * Génère le PDF de l'historique des paiements (ventes) sur une période.
   * @param startDate  Date de début (ISO string) — optionnel (si null, toutes les ventes)
   * @param endDate    Date de fin (ISO string) — optionnel
   */
  async generatePaymentsHistoryPdf(
    tenantId: string,
    academicYearId: string,
    startDate?: string | null,
    endDate?: string | null,
  ): Promise<Buffer> {
    const [branding, yearName, levelInfo] = await Promise.all([
      this.getTenantBranding(tenantId),
      this.getAcademicYearName(academicYearId),
      this.getSchoolLevelInfo(tenantId),
    ]);

    const where: any = { tenantId, academicYearId };
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    const sales = await this.prisma.shopSale.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        student: { select: { firstName: true, lastName: true, matricule: true } },
      },
      orderBy: { saleDate: 'desc' },
    });

    const totalAmount = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const methodLabels: Record<string, string> = {
      CASH: 'Espèces', FEDAPAY: 'FedaPay', WALLET: 'Portefeuille', CARD: 'Carte',
      cash: 'Espèces', fedapay: 'FedaPay', wallet: 'Portefeuille', card: 'Carte',
    };

    const rows = sales.map((s: any, i: number) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="font-family:monospace;font-size:10px;">${s.saleNumber}</td>
        <td>${s.customerName || (s.student ? `${s.student.lastName} ${s.student.firstName}` : 'Client')}</td>
        <td style="font-size:10px;">${(s.items || []).map((it: any) => it.product?.name || 'Article').join(', ').substring(0, 80)}</td>
        <td style="text-align:center;">${methodLabels[s.paymentMode] || s.paymentMode || '—'}</td>
        <td style="text-align:right;font-weight:600;">${Number(s.totalAmount).toLocaleString('fr-FR')}</td>
        <td style="text-align:center;font-size:10px;">${new Date(s.saleDate).toLocaleDateString('fr-FR')}</td>
      </tr>
    `).join('');

    const periodeLabel = startDate && endDate
      ? `du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
      : 'Toutes les ventes';

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Historique des Paiements</title><style>${this.SHARED_CSS}</style></head><body>
      ${this.buildHeader(branding, levelInfo.isSecondary, levelInfo.hasBothLevels)}
      <div class="document-title">Historique des Paiements — Boutique</div>
      <div class="info-bar">
        <span><strong>Année scolaire</strong> : ${yearName}</span>
        <span><strong>Période</strong> : ${periodeLabel}</span>
        <span><strong>Total</strong> : ${sales.length} vente(s) — ${totalAmount.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th style="width:40px;">N°</th>
            <th style="width:120px;">Référence</th>
            <th>Client / Élève</th>
            <th>Articles</th>
            <th style="width:80px;">Méthode</th>
            <th style="width:100px;text-align:right;">Montant</th>
            <th style="width:80px;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">Aucune vente sur cette période</td></tr>'}
        </tbody>
      </table>
      <div style="margin-top:20px;text-align:right;font-size:14px;font-weight:bold;color:#0D1F6E;">
        Total encaissé : ${totalAmount.toLocaleString('fr-FR')} FCFA
      </div>
      <div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')}</div>
    </body></html>`;

    return this.generatePdf(html);
  }

  // ─── 3. STOCKS ──────────────────────────────────────────────────────────

  /**
   * Génère le PDF de la liste du stock (produit, quantité, seuil, valeur).
   */
  async generateStocksPdf(
    tenantId: string,
    academicYearId: string,
  ): Promise<Buffer> {
    const [branding, yearName, products, levelInfo] = await Promise.all([
      this.getTenantBranding(tenantId),
      this.getAcademicYearName(academicYearId),
      this.prisma.shopProduct.findMany({
        where: { tenantId, academicYearId, isActive: true },
        include: { stock: true, category: true },
        orderBy: { name: 'asc' },
      }),
      this.getSchoolLevelInfo(tenantId),
    ]);

    const rows = products.map((p: any, i: number) => {
      const qty = p.stock?.quantity ?? 0;
      const unitPrice = Number(p.unitPrice) || 0;
      const value = qty * unitPrice;
      const status = qty <= 0 ? 'Rupture' : qty <= (p.minStock || 0) ? 'Alerte' : 'OK';
      const statusColor = qty <= 0 ? '#dc2626' : qty <= (p.minStock || 0) ? '#f59e0b' : '#16a34a';
      return `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td style="font-weight:600;">${p.name || '—'}</td>
          <td style="text-align:center;font-size:10px;">${p.code || '—'}</td>
          <td style="text-align:center;font-weight:600;">${qty}</td>
          <td style="text-align:center;">${p.minStock || 0}</td>
          <td style="text-align:right;">${unitPrice.toLocaleString('fr-FR')}</td>
          <td style="text-align:right;font-weight:600;">${value.toLocaleString('fr-FR')}</td>
          <td style="text-align:center;color:${statusColor};font-weight:600;">${status}</td>
        </tr>
      `;
    }).join('');

    const totalValue = products.reduce((sum, p: any) => sum + ((p.stock?.quantity ?? 0) * (Number(p.unitPrice) || 0)), 0);
    const ruptureCount = products.filter((p: any) => (p.stock?.quantity ?? 0) <= 0).length;
    const alertCount = products.filter((p: any) => {
      const qty = p.stock?.quantity ?? 0;
      return qty > 0 && qty <= (p.minStock || 0);
    }).length;

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Liste du Stock</title><style>${this.SHARED_CSS}</style></head><body>
      ${this.buildHeader(branding, levelInfo.isSecondary, levelInfo.hasBothLevels)}
      <div class="document-title">Liste du Stock — Boutique</div>
      <div class="info-bar">
        <span><strong>Année scolaire</strong> : ${yearName}</span>
        <span><strong>Total produits</strong> : ${products.length}</span>
        <span><strong>Ruptures</strong> : ${ruptureCount} · <strong>Alertes</strong> : ${alertCount}</span>
        <span><strong>Valeur totale</strong> : ${totalValue.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th style="width:40px;">N°</th>
            <th>Produit</th>
            <th style="width:80px;">Code</th>
            <th style="width:60px;">En stock</th>
            <th style="width:60px;">Seuil</th>
            <th style="width:100px;text-align:right;">Prix unitaire</th>
            <th style="width:100px;text-align:right;">Valeur</th>
            <th style="width:60px;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999;">Aucun produit en stock</td></tr>'}
        </tbody>
      </table>
      <div style="margin-top:20px;text-align:right;font-size:14px;font-weight:bold;color:#0D1F6E;">
        Valeur totale du stock : ${totalValue.toLocaleString('fr-FR')} FCFA
      </div>
      <div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')}</div>
    </body></html>`;

    return this.generatePdf(html);
  }
}
