/**
 * ============================================================================
 * INVOICE SERVICE — Génération et envoi de factures par email
 * ============================================================================
 *
 * FeexPay n'envoie PAS de factures emails automatiquement aux clients
 * (contrairement à Stripe Billing). Ce service comble ce manque en :
 *
 *   1. Générant un numéro de facture unique (format: AH-YYYY-MM-NNNNN)
 *   2. Créant un enregistrement Invoice en DB
 *   3. Générant un HTML de facture professionnel (palette Academia Helm)
 *   4. Envoyant l'email via EmailService (Resend)
 *
 * Déclenchement :
 *   - Après paiement onboarding réussi (initialSubscription)
 *   - Après renouvellement d'abonnement (renewal)
 *   - Après activation option bilingue (bilingual activation)
 *   - Après paiement de frais de scolarité (school fees)
 *
 * Modèle DB : HelmInvoice (déjà existant dans le schéma Prisma)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';

export interface InvoiceData {
  tenantId: string;
  tenantName: string;
  tenantSubdomain?: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  amount: number; // En FCFA
  description: string;
  type: 'INITIAL_SUBSCRIPTION' | 'RENEWAL' | 'BILINGUAL_ACTIVATION' | 'REACTIVATION' | 'SCHOOL_FEE' | 'MANUAL_PAYMENT';
  paymentReference?: string;
  paymentMethod?: 'MOBILE_MONEY' | 'CARD' | 'MANUAL';
  paymentOperator?: string; // MTN, MOOV, CELTIIS, CORIS, CARD
  plan?: string; // SEED, GROW, LEAD, NETWORK
  billingCycle?: 'MONTHLY' | 'YEARLY';
  bilingualEnabled?: boolean;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  emailSent?: boolean;
  error?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Génère un numéro de facture unique au format AH-YYYY-MM-NNNNN.
   */
  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Compter les factures du mois pour incrémenter
    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd = new Date(year, now.getMonth() + 1, 1);
    const count = await this.prisma.helmInvoice.count({
      where: {
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });

    const sequence = String(count + 1).padStart(5, '0');
    return `AH-${year}-${month}-${sequence}`;
  }

  /**
   * Crée une facture en DB et envoie l'email au client.
   *
   * @returns { invoiceId, invoiceNumber, emailSent }
   */
  async createAndSendInvoice(data: InvoiceData): Promise<InvoiceResult> {
    try {
      const invoiceNumber = await this.generateInvoiceNumber();

      // 1. Créer l'enregistrement Invoice en DB
      const invoice = await this.prisma.helmInvoice.create({
        data: {
          tenantId: data.tenantId,
          invoiceNumber,
          amount: data.amount,
          currency: 'XOF',
          status: 'PAID',
          type: data.type as any,
          description: data.description,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          customerPhone: data.customerPhone || null,
          paymentReference: data.paymentReference || null,
          paymentMethod: data.paymentMethod || null,
          paymentOperator: data.paymentOperator || null,
          plan: data.plan || null,
          billingCycle: data.billingCycle || null,
          bilingualEnabled: data.bilingualEnabled || false,
          issuedAt: new Date(),
          paidAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice ${invoiceNumber} created for tenant ${data.tenantId} (amount=${data.amount})`);

      // 2. Générer le HTML de la facture
      const htmlContent = this.generateInvoiceHtml({
        ...data,
        invoiceNumber,
        invoiceId: invoice.id,
        issuedAt: new Date(),
      });

      // 3. Envoyer l'email
      const subject = `Facture ${invoiceNumber} — Academia Helm`;
      let emailSent = false;
      try {
        await this.emailService.sendEmail({
          to: data.customerEmail,
          subject,
          html: htmlContent,
          fromName: 'Academia Helm — Facturation',
        });
        emailSent = true;
        this.logger.log(`✅ Invoice ${invoiceNumber} email sent to ${data.customerEmail}`);
      } catch (emailErr: any) {
        this.logger.error(`Failed to send invoice email: ${emailErr.message}`);
        // Ne pas échouer toute la facture si l'email échoue
      }

      return {
        success: true,
        invoiceId: invoice.id,
        invoiceNumber,
        emailSent,
      };
    } catch (err: any) {
      this.logger.error(`createAndSendInvoice failed: ${err.message}`, err.stack);
      return { success: false, error: err.message };
    }
  }

  /**
   * Génère le HTML de la facture (palette Academia Helm : navy + gold).
   */
  private generateInvoiceHtml(data: InvoiceData & { invoiceNumber: string; invoiceId: string; issuedAt: Date }): string {
    const amountFormatted = new Intl.NumberFormat('fr-FR').format(data.amount);
    const dateStr = data.issuedAt.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const typeLabels: Record<string, string> = {
      INITIAL_SUBSCRIPTION: 'Souscription initiale',
      RENEWAL: 'Renouvellement d\'abonnement',
      BILINGUAL_ACTIVATION: 'Activation option bilingue',
      REACTIVATION: 'Réactivation de compte',
      SCHOOL_FEE: 'Frais de scolarité',
      MANUAL_PAYMENT: 'Paiement manuel',
    };

    const planLabels: Record<string, string> = {
      SEED: 'Helm Seed',
      GROW: 'Helm Grow',
      LEAD: 'Helm Lead',
      NETWORK: 'Helm Network',
    };

    const planLabel = data.plan ? planLabels[data.plan] || data.plan : '';
    const cycleLabel = data.billingCycle === 'YEARLY' ? 'Annuel' : data.billingCycle === 'MONTHLY' ? 'Mensuel' : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${data.invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">

    <!-- Header navy + accent gold -->
    <div style="background:linear-gradient(135deg,#0A2A5E 0%,#0D3B85 100%);padding:32px 40px;color:#ffffff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:22px;font-weight:700;letter-spacing:-0.3px;">Academia Helm</div>
          <div style="font-size:13px;color:#F2C94C;margin-top:4px;font-weight:500;">Plateforme de pilotage éducatif</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.7);">Facture</div>
          <div style="font-size:18px;font-weight:700;margin-top:2px;">${data.invoiceNumber}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${dateStr}</div>
        </div>
      </div>
    </div>

    <!-- Corps -->
    <div style="padding:32px 40px;">

      <!-- Statut PAYÉ -->
      <div style="display:inline-block;background:#dcfce7;color:#166534;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;margin-bottom:24px;border:1px solid #86efac;">
        ✓ Payé
      </div>

      <!-- Émetteur + Destinataire -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px;">Émetteur</div>
          <div style="font-size:14px;font-weight:600;color:#0A2A5E;">Academia Helm</div>
          <div style="font-size:13px;color:#475569;line-height:1.5;margin-top:4px;">
            contact@academiahelm.com<br>
            Cotonou, Bénin
          </div>
        </div>
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px;">Destinataire</div>
          <div style="font-size:14px;font-weight:600;color:#0A2A5E;">${this.escapeHtml(data.customerName)}</div>
          <div style="font-size:13px;color:#475569;line-height:1.5;margin-top:4px;">
            ${this.escapeHtml(data.customerEmail)}<br>
            ${data.customerPhone ? this.escapeHtml(data.customerPhone) + '<br>' : ''}
            ${this.escapeHtml(data.tenantName)}
          </div>
        </div>
      </div>

      <!-- Détails du paiement -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="text-align:left;padding:12px 16px;font-size:12px;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Description</th>
            <th style="text-align:right;padding:12px 16px;font-size:12px;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:16px;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:14px;font-weight:600;color:#0f172a;">${typeLabels[data.type] || data.type}</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">
                ${this.escapeHtml(data.description)}
              </div>
              ${planLabel ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">Plan : <strong>${planLabel}</strong>${cycleLabel ? ` • Cycle : ${cycleLabel}` : ''}</div>` : ''}
              ${data.bilingualEnabled ? '<div style="font-size:12px;color:#64748b;">Option bilingue (FR + EN) incluse</div>' : ''}
            </td>
            <td style="padding:16px;text-align:right;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:16px;font-weight:700;color:#0A2A5E;">${amountFormatted} FCFA</div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:16px;text-align:right;font-size:14px;font-weight:600;color:#0f172a;">Total payé</td>
            <td style="padding:16px;text-align:right;font-size:18px;font-weight:700;color:#0A2A5E;border-top:2px solid #0A2A5E;">${amountFormatted} FCFA</td>
          </tr>
        </tfoot>
      </table>

      <!-- Infos paiement -->
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;font-size:13px;color:#475569;line-height:1.6;">
        <strong style="color:#0A2A5E;">Détails du paiement</strong><br>
        Méthode : ${data.paymentMethod === 'MOBILE_MONEY' ? 'Mobile Money' : data.paymentMethod === 'CARD' ? 'Carte bancaire' : 'Manuel'}
        ${data.paymentOperator ? ` (${data.paymentOperator})` : ''}<br>
        ${data.paymentReference ? `Référence : <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;">${this.escapeHtml(data.paymentReference)}</code><br>` : ''}
        Date : ${dateStr}
      </div>

      <!-- Message de remerciement -->
      <div style="text-align:center;padding:24px;background:linear-gradient(135deg,#0A2A5E 0%,#0D3B85 100%);border-radius:8px;color:#ffffff;">
        <div style="font-size:16px;font-weight:600;margin-bottom:8px;">Merci pour votre confiance !</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.5;">
          Votre établissement <strong>${this.escapeHtml(data.tenantName)}</strong> est désormais accompagné par Academia Helm.<br>
          ${data.tenantSubdomain ? `Accédez à votre espace : <a href="https://${data.tenantSubdomain}.academiahelm.com" style="color:#F2C94C;text-decoration:underline;">${data.tenantSubdomain}.academiahelm.com</a>` : ''}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.5;">
      Academia Helm — Plateforme de pilotage éducatif<br>
      Cette facture est envoyée automatiquement après confirmation de votre paiement.<br>
      Pour toute question : <a href="mailto:contact@academiahelm.com" style="color:#0A2A5E;">contact@academiahelm.com</a>
    </div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
