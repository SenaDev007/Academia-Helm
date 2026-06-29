/**
 * ============================================================================
 * PEDAGOGY EMAIL TEMPLATES — Notifications aux enseignants
 * ============================================================================
 *
 * Templates HTML pour les notifications envoyées aux enseignants depuis le
 * module Pédagogie (ex: changement d'affectation, rappel disponibilités,
 * announcement personnalisé, etc.).
 *
 * Réutilise les helpers du module RH (renderEmail / renderHeader / renderFooter
 * / renderBadge / escHtml / TenantBranding) pour garder une charte graphique
 * identique à travers toute la plateforme :
 *   ┌──────────────────────────────────────┐
 *   │  HEADER : Logo + Nom école tenante   │  ← personnalisé par tenant
 *   │       + sous-titre « Pédagogie »     │
 *   ├──────────────────────────────────────┤
 *   │  CORPS : Sujet + Message             │  ← variable selon contexte
 *   ├──────────────────────────────────────┤
 *   │  FOOTER : Signature Academia Helm    │  ← commun à tous
 *   └──────────────────────────────────────┘
 *
 * Palette : Navy #0D1F6E, Blue #1d4fa5, Gold #F5A623
 * ============================================================================
 */

import {
  renderEmail,
  renderBadge,
  escHtml,
  TenantBranding,
} from '../hr/recruitment-email-templates';

export interface PedagogyNotificationEmailData {
  /** Branding du tenant (école) — injecté dans header + footer */
  branding: TenantBranding;
  /** Nom complet de l'enseignant (ex: "M. Akpovi Koffi") */
  teacherName: string;
  /** Prénom de l'enseignant (pour la salutation) */
  teacherFirstName: string;
  /** Sujet de l'email (affiché dans l'en-tête du corps) */
  subject: string;
  /** Message au format texte brut — les sauts de ligne sont préservés */
  message: string;
  /** Matricule de l'enseignant (affiché dans le bloc d'infos) */
  matricule?: string;
  /** Niveau scolaire affecté (affiché dans le bloc d'infos) */
  schoolLevelName?: string;
  /** Nom de l'expéditeur (qui a déclenché l'envoi) */
  senderName?: string;
  /** Fonction de l'expéditeur (Directeur, Coordinateur, etc.) */
  senderFunction?: string;
}

/**
 * Email de notification pédagogique envoyé à un enseignant.
 *
 * S'utilise pour :
 *  - Individuel : notification ciblée à un enseignant précis (depuis le bouton
 *    « Notifier » sur la fiche enseignant).
 *  - Groupe : même template, mais envoyé en boucle à plusieurs enseignants
 *    (depuis le bouton « Notifier tous » du toolbar).
 *
 * Le message est échappé HTML pour éviter toute injection, et les sauts de
 * ligne sont convertis en <br /> pour préserver la mise en forme.
 */
export function renderPedagogyNotificationEmail(
  data: PedagogyNotificationEmailData,
): { subject: string; html: string } {
  const subject = `[Pédagogie] ${data.subject}`;

  // Préfixer "M./Mme" si on a juste le prénom (salutation naturelle)
  const greeting = data.teacherFirstName
    ? `Bonjour ${escHtml(data.teacherFirstName)}`
    : `Bonjour ${escHtml(data.teacherName)}`;

  // Convertir le message brut en HTML sûr :
  //  1. escHtml → échappe <, >, &, "
  //  2. Remplacer les sauts de ligne par <br />
  //  3. Préserver les espaces consécutifs via &nbsp;
  const messageHtml = escHtml(data.message)
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '</p><p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.7;">')
    .replace(/\n/g, '<br />');

  // Bloc d'informations enseignant (matricule + niveau + expéditeur)
  const infoRows: string[] = [];
  if (data.matricule) {
    infoRows.push(`
      <tr>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;width:40%;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Matricule</td>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.matricule)}</td>
      </tr>`);
  }
  if (data.schoolLevelName) {
    infoRows.push(`
      <tr>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Niveau affecté</td>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.schoolLevelName)}</td>
      </tr>`);
  }
  if (data.senderName) {
    infoRows.push(`
      <tr>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Émetteur</td>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.senderName)}${data.senderFunction ? ` <span style="color:#64748b;font-weight:400;">— ${escHtml(data.senderFunction)}</span>` : ''}</td>
      </tr>`);
  }

  const infoBlock = infoRows.length > 0
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 20px;overflow:hidden;">
        ${infoRows.join('')}
      </table>`
    : '';

  const bodyContent = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:bold;color:#0D1F6E;margin:0 0 8px;">
        ${escHtml(data.subject)}
      </h1>
      ${renderBadge('blue', '📚 Notification pédagogique')}
    </div>

    <p style="font-size:14px;color:#0f172a;line-height:1.7;margin:0 0 20px;">
      ${greeting},<br /><br />
      Vous recevez ce message de la part de <strong>${escHtml(data.branding.schoolName || 'votre établissement')}</strong>.
    </p>

    ${infoBlock}

    <!-- Message -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 20px;">
      <tr>
        <td style="padding:20px 24px;background:#f8fafc;border-left:4px solid #F5A623;">
          <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;font-weight:bold;">📋 Message</div>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.7;">${messageHtml}</p>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 0;">
      Pour toute question relative à ce message, merci de vous rapprocher de la direction pédagogique ou du service RH de votre établissement.
    </p>

    <p style="font-size:13px;color:#475569;line-height:1.6;margin:12px 0 0;">
      Cordialement,<br />
      <strong>L'équipe pédagogique — ${escHtml(data.branding.schoolName || 'Academia Helm')}</strong>
    </p>
  `;

  return {
    subject,
    html: renderEmail(data.branding, bodyContent),
  };
}
