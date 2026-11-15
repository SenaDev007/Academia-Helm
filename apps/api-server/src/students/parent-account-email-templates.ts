/**
 * ============================================================================
 * PARENT ACCOUNT EMAIL TEMPLATE — Identifiants du portail parent (module Élèves)
 * ============================================================================
 *
 * Template HTML pour l'email d'activation du compte parent envoyé lors de
 * l'inscription d'un élève (wizard Inscriptions) ou depuis l'onglet Famille
 * (sous-onglet « Création de compte »).
 *
 * Contenu : URL du portail parent + identifiant de connexion (numéro de
 * téléphone ou email) + MOT DE PASSE SIMPLE — ⭐ nov. 2026 (demande
 * promoteur) : le portail parent se connecte désormais par (téléphone ou
 * email) + mot de passe (petit mot + 2-3 chiffres), cf. portal-auth.service.ts.
 *
 * Pattern aligné sur receipt-email-templates.ts (mêmes primitives visuelles
 * du module RH : renderEmail, renderHeader, renderFooter, renderBadge).
 * ============================================================================
 */

export {
  escHtml,
  renderEmail,
  renderBadge,
} from '../hr/recruitment-email-templates';

import { renderEmail, renderBadge, escHtml } from '../hr/recruitment-email-templates';
import type { TenantBranding } from '../hr/recruitment-email-templates';

export interface ParentAccountEmailData {
  /** Branding du tenant (école) */
  branding: TenantBranding;
  /** Nom du parent */
  parentName?: string;
  /** Nom de l'élève (pour situer le compte) */
  studentName?: string;
  /** URL complète du portail parent (ex: https://ecole.academiahelm.com/login?portal=parent) */
  portalUrl: string;
  /** Identifiant de connexion du parent (numéro de téléphone ou email) */
  identifier: string;
  /** Type d'identifiant — détermine le libellé affiché */
  identifierType: 'PHONE' | 'EMAIL';
  /** ⭐ nov. 2026 — mot de passe simple (ex : soleil42). ⭐ 16/11/2026 fix
   * 1.0.8 : compte PARENT dédié créé si besoin → toujours réel ; null est
   * un filet de sécurité rarissime → « contactez l'administration ». */
  password?: string | null;
}

/**
 * Génère l'email HTML d'activation du compte parent.
 * Retourne { subject, html, text }.
 */
export function renderParentAccountEmail(data: ParentAccountEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const isPhone = data.identifierType === 'PHONE';
  const identifierLabel = isPhone
    ? 'Votre numéro de téléphone'
    : 'Votre adresse email';
  // ⭐ nov. 2026 — mot de passe OBLIGATOIRE au portail parent
  const identifierHint = isPhone
    ? 'Sélectionnez l\u2019onglet « Parent », saisissez votre numéro de téléphone et votre mot de passe.'
    : 'Sélectionnez l\u2019onglet « Parent », saisissez votre adresse email et votre mot de passe.';
  const passwordDisplay = data.password
    ? `<strong style="font-family:monospace;font-size:16px;letter-spacing:1px;">${escHtml(data.password)}</strong>`
    : 'Contactez l\'administration';
  const passwordHint = data.password
    ? 'Conservez ce mot de passe précieusement — il vous sera demandé à chaque connexion.'
    : 'Contactez l\'administration de l\'établissement pour recevoir votre mot de passe.';

  const studentLine = data.studentName
    ? `<p style="margin:0 0 16px;font-size:15px;color:#0f172a;line-height:1.6;">Ce compte est lié à <strong>${escHtml(data.studentName)}</strong>, inscrit(e) dans notre établissement.</p>`
    : '';

  const bodyContent = `
    ${renderBadge('blue', '🔑 Compte parent activé')}

    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;line-height:1.6;">
      ${data.parentName ? `Bonjour <strong>${escHtml(data.parentName)}</strong>,` : 'Bonjour,'}
    </p>

    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;line-height:1.6;">
      Le compte de l'espace parent vient d'être créé. Vous pouvez dès à présent
      suivre la scolarité de votre enfant (notes, bulletins, paiements,
      communications de l'école) sur le portail parent.
    </p>

    ${studentLine}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff6ff;border:2px solid #3b82f6;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="font-size:13px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Vos informations de connexion</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;color:#0f172a;">
            <tr>
              <td style="padding:4px 0;width:190px;color:#64748b;">Adresse du portail :</td>
              <td style="padding:4px 0;">
                <a href="${escHtml(data.portalUrl)}" style="color:#1d4ed8;font-weight:bold;word-break:break-all;">${escHtml(data.portalUrl)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;">${identifierLabel} :</td>
              <td style="padding:4px 0;"><strong style="font-family:monospace;">${escHtml(data.identifier)}</strong></td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;">Mot de passe :</td>
              <td style="padding:4px 0;">${passwordDisplay}</td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;color:#1e40af;line-height:1.5;">${escHtml(identifierHint)} ${escHtml(passwordHint)}</p>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
      En cas de difficulté de connexion, rapprochez-vous de l'administration
      de l'établissement.
    </p>
  `;

  const subject = `Votre compte parent est activé — ${data.branding.schoolName || 'Academia Helm'}`;

  return {
    subject,
    html: renderEmail(data.branding, bodyContent, 'Espace Parent'),
    text: `Votre compte parent est activé. Portail : ${data.portalUrl} — Identifiant : ${data.identifier} (${identifierLabel})${data.password ? ` — Mot de passe : ${data.password}` : ' — Mot de passe : contactez l\'administration'}.`,
  };
}
