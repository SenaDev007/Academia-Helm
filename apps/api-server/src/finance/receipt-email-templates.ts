/**
 * ============================================================================
 * RECEIPT EMAIL TEMPLATE — Reçu de paiement (module Finance)
 * ============================================================================
 *
 * Template HTML pour l'email de reçu de paiement envoyé au parent.
 * Pattern aligné sur admission-email-templates.ts (mêmes primitives visuelles
 * du module RH : renderEmail, renderHeader, renderFooter, renderBadge).
 *
 * ============================================================================
 */

export {
  escHtml,
  renderEmail,
  renderBadge,
  TenantBranding,
} from '../hr/recruitment-email-templates';

import { renderEmail, renderBadge, escHtml } from '../hr/recruitment-email-templates';
import type { TenantBranding } from '../hr/recruitment-email-templates';

export interface ReceiptEmailData {
  /** Branding du tenant (école) */
  branding: TenantBranding;
  /** Nom du parent */
  parentName?: string;
  /** Nom de l'élève */
  studentName: string;
  /** N° de reçu */
  receiptNumber: string;
  /** Montant payé */
  amount: number;
  /** Mode de paiement (CASH, MOBILE_MONEY, WIRE, FEDAPAY) */
  paymentMethod: string;
  /** Date de l'opération */
  dateLabel: string;
  /** Total dû (après paiement) */
  totalDue?: number;
  /** Total payé (après paiement) */
  totalPaidAfter?: number;
  /** Solde restant à payer (après paiement) */
  balanceAfter?: number;
  /** Note de personnalisation (réduction appliquée) */
  personalizationNote?: string;
  /** Classe de l'élève */
  className?: string;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement bancaire',
  FEDAPAY: 'Fedapay',
};

/**
 * Génère l'email HTML du reçu de paiement.
 * Retourne { subject, html }.
 */
export function renderReceiptEmail(data: ReceiptEmailData): { subject: string; html: string } {
  const subject = `Reçu de paiement - ${data.receiptNumber} - ${data.studentName}`;

  const amountStr = data.amount.toLocaleString('fr-FR');
  const methodLabel = METHOD_LABELS[data.paymentMethod] || data.paymentMethod;

  // Section solde restant
  const balanceSection = data.balanceAfter != null
    ? (data.balanceAfter > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;margin:20px 0;">
          <tr>
            <td style="padding:16px 20px;text-align:center;">
              <div style="font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">💡 Solde restant à payer</div>
              <div style="font-size:22px;font-weight:700;color:#92400e;margin-top:8px;">${data.balanceAfter.toLocaleString('fr-FR')} FCFA</div>
              ${data.totalDue != null && data.totalPaidAfter != null
                ? `<div style="font-size:11px;color:#92400e;margin-top:4px;">Total dû : ${data.totalDue.toLocaleString('fr-FR')} FCFA · Total payé : ${data.totalPaidAfter.toLocaleString('fr-FR')} FCFA</div>`
                : ''}
              <div style="font-size:11px;color:#92400e;margin-top:6px;">Merci de régulariser ce montant auprès de l'établissement.</div>
            </td>
          </tr>
        </table>`
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#d1fae5;border:2px solid #10b981;border-radius:8px;margin:20px 0;">
          <tr>
            <td style="padding:16px 20px;text-align:center;">
              <div style="font-size:13px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">✅ Compte soldé</div>
              <div style="font-size:16px;font-weight:600;color:#065f46;margin-top:6px;">Aucun solde restant à payer</div>
              <div style="font-size:11px;color:#065f46;margin-top:4px;">Tous les frais de l'année ont été réglés. Merci !</div>
            </td>
          </tr>
        </table>`)
    : '';

  const bodyContent = `
    ${renderBadge('green', '🧾 Reçu de paiement')}

    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;line-height:1.6;">
      Bonjour <strong>${escHtml(data.parentName || 'Parent')}</strong>,
    </p>

    <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
      Nous vous confirmons la réception du paiement suivant pour
      <strong>${escHtml(data.studentName)}</strong>.
      Le reçu détaillé est joint à cet email au format PDF.
    </p>

    <!-- Carte récapitulative du paiement -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Détails du paiement</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;width:40%;">N° de reçu :</td>
              <td style="padding:4px 0;font-size:13px;color:#1e40af;font-weight:bold;font-family:monospace;">${escHtml(data.receiptNumber)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Élève :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.studentName)}${data.className && data.className !== '—' ? ` <span style="color:#64748b;font-weight:normal;">(${escHtml(data.className)})</span>` : ''}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Montant payé :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${amountStr} FCFA</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Mode de paiement :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(methodLabel)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Date :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.dateLabel)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Établissement :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.branding.schoolName)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${balanceSection}

    ${data.personalizationNote ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ede9fe;border:1px solid #8b5cf6;border-radius:8px;margin:16px 0;">
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:12px;font-weight:600;color:#5b21b6;margin-bottom:4px;">🎯 Personnalisation de frais</div>
          <div style="font-size:12px;color:#5b21b6;line-height:1.5;">${escHtml(data.personalizationNote)}</div>
        </td>
      </tr>
    </table>` : ''}

    <p style="margin:20px 0 0;font-size:13px;color:#475569;line-height:1.6;">
      Pour toute question concernant ce paiement, vous pouvez nous contacter
      ${data.branding.schoolEmail
        ? `à <a href="mailto:${escHtml(data.branding.schoolEmail)}" style="color:#1e40af;text-decoration:none;">${escHtml(data.branding.schoolEmail)}</a>`
        : 'directement à l\'école'}${data.branding.schoolPhone ? ` ou au ${escHtml(data.branding.schoolPhone)}` : ''}.
    </p>

    <p style="margin:16px 0 0;font-size:13px;color:#475569;line-height:1.6;">
      Cordialement,<br />
      <strong>Service Comptable</strong><br />
      <em>${escHtml(data.branding.schoolName)}</em>
    </p>
  `;

  const html = renderEmail(data.branding, bodyContent, 'Finance');
  return { subject, html };
}
