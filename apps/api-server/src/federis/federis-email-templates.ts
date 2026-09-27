/**
 * ============================================================================
 * TEMPLATES HTML DES EMAILS TRANSACTIONNELS FEDERIS (PAIEMENT FEDAPAY)
 * ============================================================================
 *
 * ⭐ MÊME PATTER QUE ACADEMIA HELM (billing/email-templates.ts) : réutilise
 *    le squelette RH (renderEmail, renderBadge, escHtml de
 *    recruitment-email-templates.ts) pour une cohérence visuelle parfaite
 *    entre tous les emails de la plateforme.
 *
 * Différences Federis :
 *   - Branding « Academia Federis » (email système, avant connexion) ;
 *   - L'email de bienvenue contient le SOUS-DOMAIN du patronat
 *     (patronatnational.academiahelm.com ou patronat{département}.academiahelm.com)
 *     et l'URL de connexion dédiée, comme le fait Helm pour les écoles.
 */

import {
  renderEmail,
  renderBadge,
  escHtml,
  type TenantBranding,
} from '../hr/recruitment-email-templates';

/** Branding Academia Federis pour les emails transactionnels de paiement. */
function getAcademiaFederisBranding(): TenantBranding {
  return {
    schoolName: 'Academia Federis',
    schoolLogo: 'https://www.academiahelm.com/images/logo-Academia%20Hub.png',
    schoolAddress: "Parakou, Bénin — Afrique de l'Ouest",
    schoolPhone: '+229 01 41 36 08 03',
    schoolEmail: 'support@academia-helm.com',
  };
}

/** Formate un montant en FCFA avec séparateur de milliers. */
function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

export const federisEmailTemplates = {
  /**
   * Email de bienvenue envoyé au responsable du patronat après paiement
   * Fedapay confirmé — contient les identifiants de connexion et le
   * sous-domaine dédié du patronat (pattern Helm paymentSuccess).
   */
  paymentSuccess: (data: {
    responsablePrenom: string;
    patronatNom: string;
    /** Nom affichable du plan (ex: « Federis Institution ») */
    plan: string;
    transactionRef: string;
    montant: number;
    /** Email de connexion du responsable */
    email: string;
    /** Sous-domaine du patronat (ex: patronatatlantique) */
    subdomain: string;
    /** Domaine complet (ex: https://patronatatlantique.academiahelm.com) */
    siteUrl: string;
    /** URL de connexion directe (ex: https://patronatatlantique.academiahelm.com/login) */
    loginUrl: string;
    /** Mot de passe en clair si disponible ; sinon renvoyer vers celui de l'inscription */
    motDePasse?: string | null;
  }) => {
    const branding = getAcademiaFederisBranding();

    const bodyContent = `
      ${renderBadge('green', '✅ Paiement confirmé')}

      <h1 style="margin:0 0 12px;font-size:24px;color:#0D1F6E;font-weight:bold;">
        Bienvenue, ${escHtml(data.responsablePrenom)} ! 🎉
      </h1>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
        Votre paiement a été confirmé. Le compte du patronat
        <strong style="color:#0D1F6E;">${escHtml(data.patronatNom)}</strong>
        est désormais actif sur Academia Federis. Votre espace d'organisation
        d'examens privés est prêt et accessible depuis votre propre domaine.
      </p>

      <!-- Carte détails souscription -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;border-radius:12px;border:1px solid #e2e8f0;border-left:4px solid #F5A623;background:#ffffff;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:12px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
              Détails de la souscription
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;width:38%;">Offre</td>
                <td style="padding:8px 0;font-size:15px;font-weight:bold;color:#0D1F6E;">${escHtml(data.plan)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;">Montant payé</td>
                <td style="padding:8px 0;font-size:15px;font-weight:bold;color:#0D1F6E;">${escHtml(formatFCFA(data.montant))}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;">Référence FedaPay</td>
                <td style="padding:8px 0;font-size:13px;font-family:monospace;color:#334155;">${escHtml(data.transactionRef)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Carte identifiants + domaine — fond doré (pattern Helm) -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;border-radius:12px;border:1px solid #d4af37;background:linear-gradient(180deg,#faf3dc 0%,#f5e9c8 100%);">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:14px;font-weight:bold;color:#5c4a0f;margin-bottom:14px;">🔐 Vos identifiants de connexion</div>
            <p style="margin:0 0 10px;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Email</span><br/>
              <span style="font-family:monospace;font-size:15px;">${escHtml(data.email)}</span>
            </p>
            <p style="margin:0 0 10px;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Votre domaine dédié</span><br/>
              <a href="${escHtml(data.siteUrl)}" style="color:#0D1F6E;font-size:13px;font-weight:600;">${escHtml(data.siteUrl)}</a>
            </p>
            <p style="margin:0;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Page de connexion</span><br/>
              <a href="${escHtml(data.loginUrl)}" style="color:#0D1F6E;font-size:12px;font-weight:600;word-break:break-all;">${escHtml(data.loginUrl)}</a>
            </p>
            ${
              data.motDePasse
                ? `<p style="margin:12px 0 0;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Mot de passe</span><br/>
              <span style="font-family:monospace;font-size:16px;font-weight:bold;color:#0c1a33;background:rgba(255,255,255,0.55);padding:6px 10px;border-radius:6px;display:inline-block;border:1px solid #d4af37;">${escHtml(data.motDePasse)}</span>
            </p>
            <p style="margin:10px 0 0;font-size:12px;color:#6b5b12;">⚠️ Changez ce mot de passe dès la première connexion.</p>`
                : `<p style="margin:12px 0 0;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Mot de passe</span><br/>
              <span style="font-size:14px;">Le mot de passe <strong>que vous avez défini</strong> lors de votre inscription.</span>
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#6b5b12;">Oubli ? Utilisez « Mot de passe oublié » sur la page de connexion.</p>`
            }
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:10px;background:#0D1F6E;">
            <a href="${escHtml(data.loginUrl)}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
              Accéder à mon espace patronat →
            </a>
          </td>
        </tr>
      </table>`;

    const html = renderEmail(branding, bodyContent, 'Bienvenue');

    return {
      subject: '✅ Bienvenue sur Academia Federis — Vos accès sont prêts',
      html,
    };
  },
};
