/**
 * Templates HTML des emails transactionnels paiement FedaPay.
 * Les adresses d’expéditeur et liens publics sont fournis par l’appelant (variables d’environnement).
 */

function escHtml(s: string | number | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type PaymentEmailLinks = {
  /** URL complète du portail (ex. https://academiahelm.com/portal) */
  portalUrl: string;
  /** URL page inscription / retry (ex. https://academiahelm.com/signup) */
  signupUrl: string;
  /** Adresse support pour liens mailto: (sans préfixe mailto:) */
  supportEmail: string;
};

/** Expéditeurs + liens issus des variables d’environnement (Railway). */
export type PaymentTransactionalEmailConfig = PaymentEmailLinks & {
  noreplyFrom: string;
  supportFrom: string;
};

export const emailTemplates = {
  paymentSuccess: (
    links: PaymentEmailLinks,
    data: {
      promoteurPrenom: string;
      etablissementNom: string;
      plan: string;
      transactionRef: string;
      montant: number;
      loginUrl: string;
      email: string;
      /** Mot de passe en clair si disponible ; sinon le template indique d’utiliser le mot de passe défini à l’inscription */
      motDePasse?: string | null;
    },
  ) => ({
    subject: '✅ Bienvenue sur Academia Helm — Vos accès sont prêts',
    html: `
      <div style="font-family: Arial, sans-serif;
        max-width: 600px; margin: 0 auto;">
        
        <div style="background: #1A3A8F; padding: 30px;
          text-align: center;">
          <h1 style="color: white; margin: 0;">
            Academia Helm
          </h1>
          <p style="color: rgba(255,255,255,0.8);">
            Plateforme de pilotage éducatif
          </p>
        </div>

        <div style="padding: 40px 30px;">
          <h2 style="color: #1A3A8F;">
            Bienvenue, ${escHtml(data.promoteurPrenom)} ! 🎉
          </h2>
          
          <p>Votre paiement a été confirmé avec succès.
          Votre établissement <strong>
          ${escHtml(data.etablissementNom)}</strong> est maintenant
          actif sur Academia Helm.</p>

          <div style="background: #f0f4ff; border-radius:
            12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1A3A8F; margin-top: 0;">
              📋 Détails de votre souscription
            </h3>
            <p><strong>Plan :</strong> ${escHtml(data.plan)}</p>
            <p><strong>Montant payé :</strong>
              ${escHtml(data.montant.toLocaleString('fr-FR'))} FCFA</p>
            <p><strong>Référence :</strong>
              ${escHtml(data.transactionRef)}</p>
          </div>

          <div style="background: #fff3cd; border: 2px
            solid #FFB900; border-radius: 12px;
            padding: 20px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">
              🔐 Vos identifiants de connexion
            </h3>
            <p><strong>URL :</strong>
              <a href="${escHtml(data.loginUrl)}">
              ${escHtml(data.loginUrl)}</a></p>
            <p><strong>Email :</strong> ${escHtml(data.email)}</p>
            ${
              data.motDePasse
                ? `<p><strong>Mot de passe temporaire :</strong>
              <code style="background: #f5f5f5;
              padding: 4px 8px; border-radius: 4px;">
              ${escHtml(data.motDePasse)}</code></p>
            <p style="color: #856404; font-size: 13px;">
              ⚠️ Veuillez changer votre mot de passe
              dès votre première connexion.
            </p>`
                : `<p><strong>Mot de passe :</strong> utilisez <strong>le mot de passe que vous avez défini</strong> lors de votre inscription sur Academia Helm.</p>
            <p style="color: #856404; font-size: 13px;">
              ⚠️ Si vous ne vous en souvenez plus, utilisez la fonction « Mot de passe oublié » sur la page de connexion.
            </p>`
            }
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escHtml(data.loginUrl)}"
              style="background: #1A3A8F; color: white;
              padding: 14px 30px; border-radius: 8px;
              text-decoration: none; font-weight: bold;
              display: inline-block;">
              Accéder à mon portail →
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Besoin d'aide ? Contactez-nous à
            <a href="mailto:${escHtml(links.supportEmail)}">
            ${escHtml(links.supportEmail)}</a>
          </p>
        </div>

        <div style="background: #f5f5f5; padding: 20px;
          text-align: center; color: #999;
          font-size: 12px;">
          © 2026 Academia Helm — YEHI OR Tech, Parakou, Bénin
        </div>
      </div>
    `,
  }),

  paymentFailed: (
    links: PaymentEmailLinks,
    data: {
      promoteurPrenom: string;
      etablissementNom: string;
      transactionRef: string;
      montant: number;
      retryUrl: string;
    },
  ) => ({
    subject: '❌ Paiement non abouti — Academia Helm',
    html: `
      <div style="font-family: Arial, sans-serif;
        max-width: 600px; margin: 0 auto;">
        
        <div style="background: #1A3A8F; padding: 30px;
          text-align: center;">
          <h1 style="color: white; margin: 0;">
            Academia Helm
          </h1>
        </div>

        <div style="padding: 40px 30px;">
          <h2 style="color: #dc3545;">
            Paiement non abouti
          </h2>
          
          <p>Bonjour ${escHtml(data.promoteurPrenom)},</p>
          
          <p>Votre tentative de paiement pour
          l'établissement <strong>
          ${escHtml(data.etablissementNom)}</strong>
          n'a pas pu être traitée.</p>

          <div style="background: #fff5f5; border-radius:
            12px; padding: 20px; margin: 20px 0;">
            <p><strong>Référence :</strong>
              ${escHtml(data.transactionRef)}</p>
            <p><strong>Montant :</strong>
              ${escHtml(data.montant.toLocaleString('fr-FR'))} FCFA</p>
          </div>

          <p>Causes possibles :</p>
          <ul>
            <li>Solde insuffisant</li>
            <li>Transaction refusée par l'opérateur</li>
            <li>Délai de paiement dépassé</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escHtml(data.retryUrl)}"
              style="background: #1A3A8F; color: white;
              padding: 14px 30px; border-radius: 8px;
              text-decoration: none; font-weight: bold;
              display: inline-block;">
              Réessayer le paiement →
            </a>
          </div>

          <p>Si le problème persiste, répondez à cet
          email ou contactez-nous à
          <a href="mailto:${escHtml(links.supportEmail)}">
          ${escHtml(links.supportEmail)}</a></p>
        </div>

        <div style="background: #f5f5f5; padding: 20px;
          text-align: center; color: #999;
          font-size: 12px;">
          © 2026 Academia Helm — YEHI OR Tech
        </div>
      </div>
    `,
  }),

  paymentCanceled: (
    links: PaymentEmailLinks,
    data: {
      promoteurPrenom: string;
      etablissementNom: string;
      retryUrl: string;
    },
  ) => ({
    subject: '🚫 Paiement annulé — Academia Helm',
    html: `
      <div style="font-family: Arial, sans-serif;
        max-width: 600px; margin: 0 auto;">
        
        <div style="background: #1A3A8F; padding: 30px;
          text-align: center;">
          <h1 style="color: white; margin: 0;">
            Academia Helm
          </h1>
        </div>

        <div style="padding: 40px 30px;">
          <h2>Paiement annulé</h2>
          
          <p>Bonjour ${escHtml(data.promoteurPrenom)},</p>
          
          <p>Vous avez annulé le processus de paiement
          pour <strong>${escHtml(data.etablissementNom)}</strong>.
          Votre inscription n'a pas été finalisée.</p>

          <p>Vous pouvez reprendre votre inscription
          à tout moment.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escHtml(data.retryUrl)}"
              style="background: #1A3A8F; color: white;
              padding: 14px 30px; border-radius: 8px;
              text-decoration: none; font-weight: bold;
              display: inline-block;">
              Reprendre mon inscription →
            </a>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 20px;
          text-align: center; color: #999;
          font-size: 12px;">
          © 2026 Academia Helm — YEHI OR Tech
        </div>
      </div>
    `,
  }),
};
