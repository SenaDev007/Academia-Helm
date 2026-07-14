/**
 * ============================================================================
 * TEMPLATES HTML DES EMAILS TRANSACTIONNELS PAIEMENT FEDAPAY
 * ============================================================================
 *
 * ⭐ Utilise le MÊME template que le module RH (renderEmail, renderHeader,
 *    renderFooter de recruitment-email-templates.ts) pour garantir une
 *    cohérence visuelle parfaite entre tous les emails Academia Helm.
 *
 * Le branding est Academia Helm (email système — pas le logo de l'école
 * tenante, car ces emails sont envoyés pendant l'onboarding avant que le
 * tenant n'existe).
 *
 * Les adresses d'expéditeur et liens publics sont fournis par l'appelant
 * (variables d'environnement).
 * ============================================================================
 */

import {
  renderEmail,
  renderBadge,
  escHtml,
  type TenantBranding,
} from '../hr/recruitment-email-templates';

export type PaymentEmailLinks = {
  /** URL du site (accueil), ex. https://academiahelm.com */
  siteUrl: string;
  /** URL complète du portail (ex. https://academiahelm.com/portal) */
  portalUrl: string;
  /** URL page inscription / retry (ex. https://academiahelm.com/signup) */
  signupUrl: string;
  /** Adresse support pour liens mailto: (sans préfixe mailto:) */
  supportEmail: string;
};

/** Expéditeurs + liens issus des variables d'environnement (Railway/Fly.io). */
export type PaymentTransactionalEmailConfig = PaymentEmailLinks & {
  noreplyFrom: string;
  supportFrom: string;
};

/**
 * Branding Academia Helm pour les emails transactionnels de paiement.
 * Utilise le logo officiel Academia Helm (pas le logo école — c'est un
 * email système envoyé pendant l'onboarding, avant que le tenant n'existe).
 */
function getAcademiaHelmBranding(): TenantBranding {
  return {
    schoolName: 'Academia Helm',
    schoolLogo: 'https://www.academiahelm.com/images/logo-Academia%20Hub.png',
    schoolAddress: 'Parakou, Bénin — Afrique de l\'Ouest',
    schoolPhone: '+229 01 41 36 08 03',
    schoolEmail: 'support@academia-helm.com',
  };
}

/**
 * Formate un montant en FCFA avec séparateur de milliers.
 */
function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

export const emailTemplates = {
  /**
   * Email de bienvenue envoyé au promoteur après paiement confirmé.
   * Utilise le template RH (renderEmail) avec branding Academia Helm.
   */
  paymentSuccess: (
    links: PaymentEmailLinks,
    data: {
      promoteurPrenom: string;
      etablissementNom: string;
      /** ⭐ Nom AFFICHABLE du plan (ex: "Helm Seed") — NE PAS passer le code (SEED/GROW). */
      plan: string;
      transactionRef: string;
      montant: number;
      /** URL de connexion directe au portail école : https://{subdomain}.{domaine}/login?portal=SCHOOL&tenant=...&school_name=... */
      loginUrl: string;
      /** URL du site institutionnel du tenant : https://{subdomain}.{domaine}/ */
      tenantSiteUrl?: string;
      email: string;
      /** Mot de passe en clair si disponible ; sinon le template indique d'utiliser le mot de passe défini à l'inscription */
      motDePasse?: string | null;
    },
  ) => {
    const branding = getAcademiaHelmBranding();

    const bodyContent = `
      ${renderBadge('green', '✅ Paiement confirmé')}

      <h1 style="margin:0 0 12px;font-size:24px;color:#0D1F6E;font-weight:bold;">
        Bienvenue, ${escHtml(data.promoteurPrenom)} ! 🎉
      </h1>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
        Votre paiement a été confirmé. L'établissement
        <strong style="color:#0D1F6E;">${escHtml(data.etablissementNom)}</strong>
        est désormais actif sur Academia Helm. Vous pouvez dès maintenant accéder
        à votre portail de gestion scolaire.
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
                <td style="padding:8px 0;font-size:14px;color:#64748b;width:38%;">Plan</td>
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

      <!-- Carte identifiants — fond doré -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;border-radius:12px;border:1px solid #d4af37;background:linear-gradient(180deg,#faf3dc 0%,#f5e9c8 100%);">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:14px;font-weight:bold;color:#5c4a0f;margin-bottom:14px;">🔐 Vos identifiants de connexion</div>
            <p style="margin:0 0 10px;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Email</span><br/>
              <span style="font-family:monospace;font-size:15px;">${escHtml(data.email)}</span>
            </p>
            ${
              data.tenantSiteUrl
                ? `<p style="margin:0 0 10px;font-size:14px;color:#3d3510;">
              <span style="color:#6b5b12;font-weight:bold;">Site institutionnel</span><br/>
              <a href="${escHtml(data.tenantSiteUrl)}" style="color:#0D1F6E;font-size:13px;font-weight:600;">${escHtml(data.tenantSiteUrl)}</a>
            </p>`
                : ''
            }
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
              Accéder à mon portail →
            </a>
          </td>
        </tr>
      </table>`;

    const html = renderEmail(branding, bodyContent, 'Bienvenue');

    return {
      subject: '✅ Bienvenue sur Academia Helm — Vos accès sont prêts',
      html,
    };
  },

  /**
   * Email envoyé au promoteur en cas d'échec de paiement.
   * Utilise le template RH avec branding Academia Helm.
   */
  paymentFailed: (
    links: PaymentEmailLinks,
    data: {
      promoteurPrenom: string;
      etablissementNom: string;
      transactionRef: string;
      montant: number;
      retryUrl: string;
    },
  ) => {
    const branding = getAcademiaHelmBranding();

    const bodyContent = `
      ${renderBadge('red', '❌ Paiement non abouti')}

      <h1 style="margin:0 0 12px;font-size:24px;color:#0D1F6E;font-weight:bold;">
        Bonjour ${escHtml(data.promoteurPrenom)},
      </h1>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
        Votre tentative de paiement pour l'établissement
        <strong style="color:#0D1F6E;">${escHtml(data.etablissementNom)}</strong>
        n'a pas pu être traitée. Aucun montant n'a été débité de votre compte.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;border-radius:12px;border:1px solid #e2e8f0;border-left:4px solid #dc2626;background:#ffffff;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:12px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
              Détails de la transaction
            </div>
            <p style="margin:0 0 8px;font-size:14px;color:#334155;">
              <strong style="color:#64748b;">Référence :</strong>
              <span style="font-family:monospace;">${escHtml(data.transactionRef)}</span>
            </p>
            <p style="margin:0;font-size:14px;color:#334155;">
              <strong style="color:#64748b;">Montant :</strong>
              ${escHtml(formatFCFA(data.montant))}
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:14px;color:#334155;"><strong>Causes possibles :</strong></p>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#334155;line-height:1.8;">
        <li>Solde insuffisant sur votre compte Mobile Money</li>
        <li>Transaction refusée par l'opérateur</li>
        <li>Délai de paiement dépassé</li>
      </ul>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
        <tr>
          <td align="center" style="border-radius:10px;background:#0D1F6E;">
            <a href="${escHtml(data.retryUrl)}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
              Réessayer le paiement →
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">
        Si le problème persiste, contactez-nous à
        <a href="mailto:${escHtml(links.supportEmail)}" style="color:#0D1F6E;font-weight:600;">${escHtml(links.supportEmail)}</a>
      </p>`;

    const html = renderEmail(branding, bodyContent, 'Paiement');

    return {
      subject: '❌ Paiement non abouti — Academia Helm',
      html,
    };
  },

  /**
   * Email envoyé au promoteur en cas d'annulation de paiement.
   * Utilise le template RH avec branding Academia Helm.
   */
  paymentCanceled: (
    links: PaymentEmailLinks,
    data: {
      promoteurPrenom: string;
      etablissementNom: string;
      retryUrl: string;
    },
  ) => {
    const branding = getAcademiaHelmBranding();

    const bodyContent = `
      ${renderBadge('orange', '🚫 Paiement annulé')}

      <h1 style="margin:0 0 12px;font-size:24px;color:#0D1F6E;font-weight:bold;">
        Bonjour ${escHtml(data.promoteurPrenom)},
      </h1>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
        Vous avez annulé le processus de paiement pour l'établissement
        <strong style="color:#0D1F6E;">${escHtml(data.etablissementNom)}</strong>.
        Votre inscription n'a pas été finalisée.
      </p>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
        Vous pouvez reprendre votre inscription à tout moment. Vos informations
        ont été sauvegardées et vous n'aurez pas à recommencer depuis le début.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:10px;background:#0D1F6E;">
            <a href="${escHtml(data.retryUrl)}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
              Reprendre mon inscription →
            </a>
          </td>
        </tr>
      </table>`;

    const html = renderEmail(branding, bodyContent, 'Paiement');

    return {
      subject: '🚫 Paiement annulé — Academia Helm',
      html,
    };
  },
};
