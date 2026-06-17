/**
 * ============================================================================
 * Email Templates — Academia Helm (back-office admin)
 * ============================================================================
 *
 * Templates HTML professionnels pour les emails envoyés par le back-office.
 *
 * Contraintes email HTML :
 *   - Tables pour le layout (pas de flexbox/grid)
 *   - CSS inline (la plupart des clients mail strip les <style>)
 *   - Polices web-safe (Arial, Helvetica)
 *   - Images en URL absolue (HTTPS)
 *   - Largeur max 600px
 *   - Pas de JavaScript
 *
 * Palette Academia Helm :
 *   - Navy : #0b2f73 / #144798 / #1E3A5F
 *   - Or : #f5b335 / #C9A84C / #e4c978
 *   - Fond clair : #f8fafc
 *   - Texte : #1e293b / #475569
 * ============================================================================
 */

interface OtpEmailParams {
  /** Nom du destinataire (ex: "Jean" ou "Jean Dupont"). */
  name?: string;
  /** Code OTP à 6 chiffres. */
  otp: string;
  /** Durée de validité en minutes (défaut: 10). */
  validityMinutes?: number;
  /** URL du logo (absolue). Si non fourni, utilise NEXT_PUBLIC_APP_URL. */
  logoUrl?: string;
}

/** Construit l'URL absolue du logo Academia Helm pour les emails.
 * Utilise le même logo que la navbar du landing page (cohérence visuelle). */
function getLogoUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_LANDING_URL ||
    'https://academiahelm.com';
  // Même logo que la navbar du landing page (cf. apps/web-app/src/lib/brand.ts)
  // Note : l'espace dans le nom de fichier doit être URL-encodé (%20) pour
  // que les clients email puissent le résoudre correctement.
  const logoPath = '/images/logo-Academia%20Hub.png';
  return `${baseUrl.replace(/\/$/, '')}${logoPath}`;
}

/** Formate le code OTP avec espaces pour la lisibilité (8 4 2 1 9 3). */
function formatOtp(otp: string): string {
  return otp
    .split('')
    .join(' ')
    .trim();
}

/**
 * Template HTML de l'email OTP pour le back-office Academia Helm.
 *
 * Structure :
 *   - Header navy gradient avec logo + titre
 *   - Corps : salutation, explication, code OTP dans une box dorée
 *   - Encart expiration (jaune doré)
 *   - Note de sécurité
 *   - Footer navy avec signature Academia Helm
 */
export function renderOtpEmailHtml(params: OtpEmailParams): string {
  const { name, otp, validityMinutes = 10 } = params;
  const logoUrl = params.logoUrl || getLogoUrl();
  const formattedOtp = formatOtp(otp);
  const displayName = name || 'Administrateur';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Code de vérification — Academia Helm</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;">

  <!-- Preheader (invisible mais affiché dans l'aperçu inbox) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;mso-hide:all;">
    Votre code de vérification à 6 chiffres pour accéder au back-office Academia Helm. Ne le partagez avec personne.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Main container 600px -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:600px;box-shadow:0 4px 24px rgba(11,47,115,0.08);">

          <!-- ── HEADER (navy gradient + logo) ── -->
          <tr>
            <td style="background-color:#0b2f73;background-image:linear-gradient(135deg,#0b2f73 0%,#144798 100%);padding:36px 40px 32px;text-align:center;" bgcolor="#0b2f73">
              <img src="${logoUrl}" alt="Academia Helm" width="56" height="56" style="display:block;margin:0 auto 18px;width:56px;height:56px;border-radius:12px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif;">
                Back-office Academia Helm
              </h1>
              <p style="margin:10px 0 0;color:#f5b335;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;">
                Vérification en deux étapes
              </p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="padding:40px 40px 24px;">

              <p style="margin:0 0 16px;color:#1e293b;font-size:16px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                Bonjour <strong style="color:#0b2f73;">${escapeHtml(displayName)}</strong>,
              </p>

              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">
                Vous avez demandé à accéder au back-office Academia Helm. Pour finaliser
                votre authentification et garantir la sécurité de votre compte, veuillez
                saisir le code de vérification ci-dessous sur la page de connexion.
              </p>

              <!-- ── OTP CODE BOX ── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#f8fafc;border:2px dashed #f5b335;border-radius:12px;padding:28px 24px;text-align:center;">
                    <p style="margin:0 0 12px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;">
                      Votre code de vérification
                    </p>
                    <p
                      style="margin:0;color:#0b2f73;font-size:38px;font-weight:800;letter-spacing:10px;font-family:'Courier New',Courier,monospace;user-select:all;-webkit-user-select:all;cursor:pointer;"
                      onclick="navigator.clipboard&amp;&amp;navigator.clipboard.writeText('${otp}')"
                      title="Cliquez pour copier le code"
                    >
                      ${formattedOtp}
                    </p>
                    <p style="margin:10px 0 0;color:#94a3b8;font-size:10px;font-family:Arial,Helvetica,sans-serif;">
                      Cliquez sur le code pour le copier • Code brut : ${otp}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── EXPIRATION NOTICE ── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#fef3c7;border-left:4px solid #f5b335;border-radius:8px;padding:14px 18px;">
                    <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                      <strong>⏱ Ce code expire dans ${validityMinutes} minutes.</strong><br>
                      Pour votre sécurité, ne partagez ce code avec personne — y compris les équipes Academia Helm.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── SECURITY NOTICE ── -->
              <p style="margin:24px 0 0;color:#475569;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                <strong style="color:#1e293b;">🔒 Sécurité &amp; confidentialité</strong><br>
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email
                en toute sécurité — votre compte reste protégé. Academia Helm ne vous demandera
                jamais votre code de vérification par téléphone, email ou chat.
              </p>

            </td>
          </tr>

          <!-- ── DIVIDER ── -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:28px 40px 36px;text-align:center;">
              <p style="margin:0 0 6px;color:#0b2f73;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                Academia Helm
              </p>
              <p style="margin:0 0 16px;color:#64748b;font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                Plateforme de pilotage éducatif nouvelle génération<br>
                <em style="color:#94a3b8;">Prenez le gouvernail de votre institution</em>
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                © ${new Date().getFullYear()} Academia Helm · <a href="https://academiahelm.com" style="color:#94a3b8;text-decoration:none;">academiahelm.com</a><br>
                Email automatique envoyé depuis <a href="mailto:noreply@academiahelm.com" style="color:#94a3b8;text-decoration:none;">noreply@academiahelm.com</a> — merci de ne pas répondre
              </p>
            </td>
          </tr>

        </table>
        <!-- /Main container -->

        <!-- Disclaimer below the card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:600px;">
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                Cet email a été envoyé automatiquement par Academia Helm suite à une
                tentative de connexion au back-office.<br>
                Si vous recevez cet email par erreur, aucune action n'est requise de votre part.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Version texte brut (pour les clients mail qui ne supportent pas HTML). */
export function renderOtpEmailText(params: OtpEmailParams): string {
  const { name, otp, validityMinutes = 10 } = params;
  const displayName = name || 'Administrateur';

  return `ACADEMIA HELM — Vérification en deux étapes

Bonjour ${displayName},

Vous avez demandé à accéder au back-office Academia Helm.
Votre code de vérification est : ${otp}

⏱ Ce code expire dans ${validityMinutes} minutes.

SÉCURITÉ :
- Ne partagez jamais ce code avec qui que ce soit.
- Academia Helm ne vous demandera jamais ce code par téléphone ou email.
- Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

—
Academia Helm
Plateforme de pilotage éducatif nouvelle génération
https://academiahelm.com

Email automatique — merci de ne pas répondre.`;
}

/** Échappe les caractères HTML pour éviter les injections dans le nom. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
