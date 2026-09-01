/**
 * ============================================================================
 * SHOP RECEIPT SERVICE — Génération PDF de reçus pour ShopSale (vente boutique)
 * ============================================================================
 *
 * Génère un PDF de reçu pour chaque vente boutique (ShopSale) :
 *   - Numéro de vente : VTE-2026-00001 (généré par ShopService.createSale)
 *   - Date/heure automatiques (récupérées de la vente)
 *   - PDF via PuppeteerPoolService (HTML inline → PDF A4)
 *   - Stockage : uploads/receipts/shop/{tenantId}/{yearId}/sale-{num}.pdf
 *   - Mise à jour de ShopSale.notes avec URL (optionnel)
 *   - Notifications fire-and-forget : email (PDF en PJ) + Helm Connect
 *
 * Pattern identique à ReceiptFinanceService mais adapté pour ShopSale
 * (pas de FinanceTransaction, pas de breakdowns, juste articles + total).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';

@Injectable()
export class ShopReceiptService {
  private readonly logger = new Logger(ShopReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Pipeline complet de génération de reçu PDF pour une ShopSale.
   * 1. Récupère la vente + items + student + seller
   * 2. Génère le HTML du reçu (style institutionnel, A4)
   * 3. Convertit en PDF via Puppeteer
   * 4. Stocke le fichier
   * 5. Retourne le chemin + buffer pour notifications
   */
  async generateForSale(
    saleId: string,
    tenantId: string,
  ): Promise<{ filePath: string; receiptUrl: string; pdfBuffer: Buffer }> {
    // 1. Charger la vente avec toutes les infos nécessaires
    const sale = await this.prisma.shopSale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, code: true, imageUrl: true },
            },
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
          },
        },
        seller: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!sale) {
      throw new Error(`Vente ${saleId} introuvable`);
    }

    // Récupérer la classe de l'élève pour cette année
    let className = '—';
    if (sale.studentId && sale.academicYearId) {
      try {
        const enrollment = await this.prisma.studentEnrollment.findFirst({
          where: { studentId: sale.studentId, academicYearId: sale.academicYearId },
          include: { class: { select: { name: true, code: true } } },
        });
        className = enrollment?.class?.name || '—';
      } catch {
        // Non bloquant
      }
    }

    // 2. Récupérer le branding de l'école + logo
    const branding = await this.getTenantBranding(tenantId);

    // 3. Générer le token de vérification (pour QR code)
    const verificationToken = this.generateVerificationToken(sale.id, sale.saleNumber);

    // 4. Générer le QR code en data URL
    const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
    const verifyUrl = `${publicUrl}/api/shop/receipt/verify?token=${verificationToken}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });

    // 5. Construire le HTML du reçu
    const html = this.buildReceiptHTML({
      sale,
      branding,
      qrCodeDataUrl,
      verificationToken,
      className,
    });

    // 6. Convertir en PDF via Puppeteer
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

      // 7. Stocker le fichier
      const yearDir = sale.academicYearId;
      const dir = path.join(process.cwd(), 'uploads', 'receipts', 'shop', tenantId, yearDir);
      fs.mkdirSync(dir, { recursive: true });
      const fileName = `sale-${sale.saleNumber.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buf);

      // 8. URL publique (servie par /api/modules-complementaires/shop/sales/:id/receipt.pdf)
      const receiptUrl = `${publicUrl}/api/modules-complementaires/shop/sales/${sale.id}/receipt.pdf`;

      this.logger.log(`Reçu boutique généré: ${sale.saleNumber} → ${filePath}`);

      return { filePath, receiptUrl, pdfBuffer: buf };
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Génère un token de vérification simple pour le QR code.
   * Format : base64(saleId:saleNumber:timestamp)
   */
  private generateVerificationToken(saleId: string, saleNumber: string): string {
    const payload = `${saleId}:${saleNumber}:${Date.now()}`;
    return Buffer.from(payload).toString('base64url');
  }

  /**
   * Récupère le branding de l'école (nom, logo, slogan, contacts).
   */
  private async getTenantBranding(tenantId: string): Promise<{
    schoolName: string;
    schoolAcronym?: string;
    schoolAddress?: string;
    schoolPhone?: string;
    schoolEmail?: string;
    schoolSlogan?: string;
    logoUrl?: string;
  }> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { version: 'desc' },
      });
      if (profile) {
        const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
        // Logo : si profile.logoUrl est un chemin relatif (ex: uploads/...), on le
        // préfixe avec l'URL publique pour le rendre accessible depuis Puppeteer.
        let logoUrl = (profile as any).logoUrl || undefined;
        if (logoUrl && !logoUrl.startsWith('http')) {
          logoUrl = `${publicUrl}/${logoUrl.replace(/^\/+/, '')}`;
        }
        return {
          schoolName: profile.schoolName || 'Établissement',
          schoolAcronym: (profile as any).schoolAcronym || undefined,
          schoolAddress: profile.address || undefined,
          schoolPhone: profile.phonePrimary || undefined,
          schoolEmail: profile.email || undefined,
          schoolSlogan: (profile as any).devise || undefined,
          logoUrl,
        };
      }
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed: ${err.message}`);
    }
    // Fallback : tenant.name
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return { schoolName: tenant?.name || 'Établissement' };
  }

  /**
   * Construit le HTML du reçu (style institutionnel, A4).
   */
  private buildReceiptHTML(params: {
    sale: any;
    branding: any;
    qrCodeDataUrl: string;
    verificationToken: string;
    className?: string;
  }): string {
    const { sale, branding, qrCodeDataUrl, verificationToken, className } = params;
    const student = sale.student;
    const studentName = student
      ? `${student.lastName} ${student.firstName}`
      : sale.customerName || 'Client';
    const matricule = student?.matricule || '—';
    const studentClass = className || '—';
    const dateOp = new Date(sale.saleDate).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const heureOp = new Date(sale.saleDate).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Lignes des articles
    const itemsRows = (sale.items || [])
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">
            ${item.product?.name || 'Article supprimé'}
            ${item.product?.code ? `<span style="font-size: 9px; color: #94a3b8; margin-left: 6px;">(${item.product.code})</span>` : ''}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.unitPrice).toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${Number(item.totalPrice).toLocaleString('fr-FR')} FCFA</td>
        </tr>`,
      )
      .join('');

    const methodLabels: Record<string, string> = {
      CASH: 'Espèces',
      cash: 'Espèces',
      FEDAPAY: 'FedaPay',
      fedapay: 'FedaPay',
      WALLET: 'Portefeuille',
      wallet: 'Portefeuille',
      CARD: 'Carte bancaire',
      card: 'Carte bancaire',
      MOBILE_MONEY: 'Mobile Money',
    };
    const methodLabel = methodLabels[sale.paymentMode] || sale.paymentMode || '—';

    // ⭐ Mapping des statuts de paiement en français
    const PAYMENT_STATUS_LABELS: Record<string, string> = {
      PAID: 'Payé',
      PENDING: 'En attente',
      CANCELLED: 'Annulé',
      REFUNDED: 'Remboursé',
      UNPAID: 'Impayé',
    };

    const sellerName = sale.seller
      ? `${sale.seller.firstName} ${sale.seller.lastName}`.trim()
      : '—';

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
  <title>Reçu ${sale.saleNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f59e0b; padding-bottom: 16px; margin-bottom: 20px; }
    .school-block { flex: 1; }
    .school-name { font-size: 20px; font-weight: 700; color: #1e293b; }
    .school-info { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
    .receipt-meta { text-align: right; }
    .receipt-title { font-size: 18px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-number { font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 4px; font-family: 'Courier New', monospace; }
    .receipt-date { font-size: 11px; color: #64748b; margin-top: 2px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px; }
    .info-item { display: flex; }
    .info-label { color: #64748b; min-width: 110px; }
    .info-value { font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #fef3c7; padding: 8px; text-align: left; font-weight: 600; color: #92400e; border-bottom: 2px solid #f59e0b; }
    .total-row { background: #fffbeb; font-weight: 700; }
    .total-row td { padding: 10px 8px; border-top: 2px solid #f59e0b; font-size: 14px; }
    .total-row .amount { color: #f59e0b; text-align: right; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    .qr-block { text-align: center; }
    .qr-block img { width: 90px; height: 90px; }
    .qr-label { font-size: 9px; color: #64748b; margin-top: 4px; }
    .stamp { text-align: right; font-size: 11px; color: #64748b; }
    .stamp-line { margin-top: 24px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
    .verification-info { margin-top: 16px; padding: 8px; background: #fffbeb; border-radius: 4px; font-size: 9px; color: #64748b; text-align: center; }
    .content { position: relative; z-index: 1; }
    .academia-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #94a3b8; text-align: center; }
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
          ${branding.schoolSlogan ? '<br>« ' + branding.schoolSlogan + ' »' : ''}
        </div>
      </div>
    </div>
    <div class="receipt-meta">
      <div class="receipt-title">Reçu de vente</div>
      <div class="receipt-number">N° ${sale.saleNumber}</div>
      <div class="receipt-date">${dateOp} à ${heureOp}</div>
    </div>
  </div>

  ${sale.customerType === 'STUDENT' && student ? `
  <div class="section">
    <div class="section-title">Client — Élève</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nom :</span><span class="info-value">${studentName}</span></div>
      <div class="info-item"><span class="info-label">Matricule :</span><span class="info-value">${matricule}</span></div>
      <div class="info-item"><span class="info-label">Classe :</span><span class="info-value">${studentClass}</span></div>
    </div>
  </div>
  ` : `
  <div class="section">
    <div class="section-title">Client</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nom :</span><span class="info-value">${studentName}</span></div>
      <div class="info-item"><span class="info-label">Type :</span><span class="info-value">${sale.customerType === 'WALK_IN' ? 'Client de passage' : sale.customerType}</span></div>
    </div>
  </div>
  `}

  <div class="section">
    <div class="section-title">Détail des articles</div>
    <table>
      <thead>
        <tr>
          <th>Article</th>
          <th style="text-align: center;">Qté</th>
          <th style="text-align: right;">Prix unitaire</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || `<tr><td colspan="4" style="padding: 8px; text-align: center; color: #94a3b8;">Aucun article</td></tr>`}
        <tr class="total-row">
          <td colspan="3">TOTAL</td>
          <td class="amount">${Number(sale.totalAmount).toLocaleString('fr-FR')} FCFA</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Mode de paiement :</span><span class="info-value">${methodLabel}</span></div>
      <div class="info-item"><span class="info-label">Vendeur :</span><span class="info-value">${sellerName}</span></div>
      <div class="info-item"><span class="info-label">Sous-total :</span><span class="info-value">${Number(sale.subTotal).toLocaleString('fr-FR')} FCFA</span></div>
      ${Number(sale.taxAmount) > 0 ? `<div class="info-item"><span class="info-label">TVA :</span><span class="info-value">${Number(sale.taxAmount).toLocaleString('fr-FR')} FCFA</span></div>` : ''}
      ${Number(sale.discountAmount) > 0 ? `<div class="info-item"><span class="info-label">Remise :</span><span class="info-value">-${Number(sale.discountAmount).toLocaleString('fr-FR')} FCFA</span></div>` : ''}
      <div class="info-item"><span class="info-label">Statut :</span><span class="info-value" style="color: #16a34a;">${PAYMENT_STATUS_LABELS[sale.paymentStatus] || 'Payé'}</span></div>
    </div>
  </div>

  <div class="footer">
    <div class="qr-block">
      <img src="${qrCodeDataUrl}" alt="QR code de vérification" />
      <div class="qr-label">Scannez pour vérifier</div>
    </div>
    <div class="stamp">
      <div>Signature du vendeur</div>
      <div class="stamp-line">&nbsp;</div>
    </div>
  </div>

  <div class="verification-info">
    Reçu généré électroniquement · Vérification en ligne via QR code
  </div>

  <div class="academia-footer">
    Document généré par Academia Helm — Plateforme de pilotage éducatif
  </div>
  </div>
</body>
</html>`;
  }
}
