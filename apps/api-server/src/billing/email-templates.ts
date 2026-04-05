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
  /** URL du site (accueil), ex. https://academiahelm.com */
  siteUrl: string;
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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(12,26,51,0.08);">
        <!-- Header bleu marine + accent doré -->
        <tr>
          <td style="background:linear-gradient(160deg,#0c1a33 0%,#152a52 100%);padding:28px 24px 22px;text-align:center;border-bottom:3px solid #c9a227;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;border:2px solid #c9a227;border-radius:10px;text-align:center;vertical-align:middle;background:rgba(201,162,39,0.12);">
                  <span style="font-size:18px;font-weight:bold;color:#f5e6b8;letter-spacing:1px;">AH</span>
                </td>
                <td style="padding-left:14px;text-align:left;vertical-align:middle;">
                  <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">Academia Helm</div>
                  <div style="font-size:13px;color:#c9a227;margin-top:4px;">Plateforme de pilotage éducatif</div>
                </td>
              </tr>
            </table>
            <div style="height:2px;width:72px;background:#c9a227;margin:0 auto;border-radius:1px;"></div>
          </td>
        </tr>
        <!-- Corps -->
        <tr>
          <td style="padding:32px 28px 28px;background:#f8fafc;">
            <!-- Badge statut (table pour clients mail) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td style="padding:8px 14px;border-radius:999px;background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;font-size:13px;font-weight:bold;">
                  ✅ Paiement confirmé
                </td>
              </tr>
            </table>
            <h1 style="margin:0 0 12px;font-size:24px;color:#0c1a33;font-weight:bold;">
              Bienvenue, ${escHtml(data.promoteurPrenom)} ! 🎉
            </h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
              Votre paiement a été confirmé. L’établissement <strong>${escHtml(data.etablissementNom)}</strong> est actif sur Academia Helm.
            </p>
            <!-- Carte détails souscription -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;border-radius:12px;border:1px solid #e2e8f0;border-left:4px solid #c9a227;background:#ffffff;">
              <tr>
                <td style="padding:18px 20px;">
                  <div style="font-size:12px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Détails souscription</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding:8px 0;font-size:14px;color:#64748b;width:38%;">Plan</td>
                      <td style="padding:8px 0;font-size:15px;font-weight:bold;color:#0c1a33;">${escHtml(data.plan)}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;font-size:14px;color:#64748b;">Montant</td>
                      <td style="padding:8px 0;font-size:15px;font-weight:bold;color:#0c1a33;">${escHtml(data.montant.toLocaleString('fr-FR'))} FCFA</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;font-size:14px;color:#64748b;">Référence</td>
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
                  <div style="font-size:14px;font-weight:bold;color:#5c4a0f;margin-bottom:14px;">🔐 Vos identifiants</div>
                  <p style="margin:0 0 10px;font-size:14px;color:#3d3510;">
                    <span style="color:#6b5b12;font-weight:bold;">Email</span><br/>
                    <span style="font-family:monospace;font-size:15px;">${escHtml(data.email)}</span>
                  </p>
                  <p style="margin:0;font-size:14px;color:#3d3510;">
                    <span style="color:#6b5b12;font-weight:bold;">Connexion</span><br/>
                    <a href="${escHtml(data.loginUrl)}" style="color:#0c1a33;font-size:13px;">${escHtml(data.loginUrl)}</a>
                  </p>
                  ${
                    data.motDePasse
                      ? `<p style="margin:12px 0 0;font-size:14px;color:#3d3510;">
                    <span style="color:#6b5b12;font-weight:bold;">MDP</span><br/>
                    <span style="font-family:monospace;font-size:16px;font-weight:bold;color:#0c1a33;background:rgba(255,255,255,0.55);padding:6px 10px;border-radius:6px;display:inline-block;border:1px solid #d4af37;">${escHtml(data.motDePasse)}</span>
                  </p>
                  <p style="margin:10px 0 0;font-size:12px;color:#6b5b12;">⚠️ Changez ce mot de passe dès la première connexion.</p>`
                      : `<p style="margin:12px 0 0;font-size:14px;color:#3d3510;">
                    <span style="color:#6b5b12;font-weight:bold;">MDP</span><br/>
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
                <td align="center" style="border-radius:10px;background:#1e3a6e;">
                  <a href="${escHtml(data.loginUrl)}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
                    Accéder à mon portail →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer sombre -->
        <tr>
          <td style="background:#0c1a33;padding:22px 24px;text-align:center;">
            <div style="font-size:14px;font-weight:bold;color:#e2e8f0;margin-bottom:10px;">L'équipe Academia Helm</div>
            <p style="margin:0 0 12px;font-size:13px;">
              <a href="${escHtml(links.siteUrl)}" style="color:#c9a227;text-decoration:none;">Accueil</a>
              <span style="color:#475569;margin:0 8px;">|</span>
              <a href="${escHtml(links.portalUrl)}" style="color:#c9a227;text-decoration:none;">Portail</a>
              <span style="color:#475569;margin:0 8px;">|</span>
              <a href="mailto:${escHtml(links.supportEmail)}" style="color:#c9a227;text-decoration:none;">Support</a>
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">© 2026 YEHI OR Tech, Parakou, Bénin</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
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
