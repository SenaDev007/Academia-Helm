/**
 * ============================================================================
 * Email Templates — Academia Helm
 * ============================================================================
 *
 * 2 templates distincts inspirés du style GitHub (simple, centré, épuré) :
 *
 * 1. renderAdminOtpEmail() — Back-office (admin.academiahelm.com)
 *    Destinataire : administrateur plateforme (membre de l'équipe interne)
 *    Ton : institutionnel, sécurité plateforme
 *
 * 2. renderSchoolOtpEmail() — Portail École (academiahelm.com)
 *    Destinataire : personnel de l'établissement (directeur, secrétaire, etc.)
 *    Ton : professionnel, sécurité établissement
 *
 * Palette Academia Helm :
 *   - Navy : #0b2f73 / #1E3A5F
 *   - Or : #f5b335 / #C9A84C
 *   - Fond : #ffffff (blanc, style GitHub)
 *   - Texte : #1e293b / #64748b (gris)
 *
 * Logo : /images/logo-Academia Hub.png (couleurs originales, pas noir/blanc)
 * ============================================================================
 */

interface OtpEmailParams {
  /** Nom du destinataire (ex: "Jean" ou "Jean Dupont"). */
  name?: string;
  /** Code OTP à 6 chiffres. */
  otp: string;
  /** Durée de validité en minutes (défaut: 10). */
  validityMinutes?: number;
}

/** Construit l'URL absolue du logo Academia Helm (couleurs originales). */
function getLogoUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_LANDING_URL ||
    'https://academiahelm.com';
  const logoPath = '/images/logo-Academia%20Hub.png';
  return `${baseUrl.replace(/\/$/, '')}${logoPath}`;
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

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 : BACK-OFFICE ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export function renderAdminOtpEmailHtml(params: OtpEmailParams): string {
  const { name, otp, validityMinutes = 10 } = params;
  const displayName = name || 'Administrateur';
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Code de vérification — Back-office Academia Helm</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.6;color:#1e293b;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:480px;">

          <!-- Logo centré (couleurs originales) -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${logoUrl}" alt="Academia Helm" width="56" height="56" style="display:block;margin:0 auto;width:56px;height:56px;border-radius:12px;">
            </td>
          </tr>

          <!-- Titre -->
          <tr>
            <td style="padding-bottom:24px;text-align:left;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0b2f73;line-height:1.4;">
                Veuillez vérifier votre identité, ${escapeHtml(displayName)}
              </h1>
            </td>
          </tr>

          <!-- Texte d'introduction -->
          <tr>
            <td style="padding-bottom:20px;text-align:left;">
              <p style="margin:0;font-size:16px;color:#475569;line-height:1.6;">
                Vous avez demand&eacute; &agrave; acc&eacute;der au back-office Academia Helm. Voici votre code de v&eacute;rification :
              </p>
            </td>
          </tr>

          <!-- Code OTP (grand, centré, style GitHub) -->
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#0b2f73;font-family:'SF Mono',Monaco,Consolas,'Courier New',monospace;">
                ${otp}
              </p>
            </td>
          </tr>

          <!-- Validité + sécurité -->
          <tr>
            <td style="padding-bottom:28px;text-align:left;">
              <p style="margin:0 0 8px;font-size:14px;color:#64748b;">
                Ce code est valable ${validityMinutes} minutes et ne peut &ecirc;tre utilis&eacute; qu'une seule fois.
              </p>
              <p style="margin:0;font-size:14px;color:#64748b;">
                Veuillez ne pas partager ce code avec personne : nous ne vous le demanderons jamais par t&eacute;l&eacute;phone ni par courriel.
              </p>
            </td>
          </tr>

          <!-- Séparateur -->
          <tr>
            <td style="padding-bottom:28px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="text-align:left;">
              <p style="margin:0 0 2px;font-size:16px;color:#1e293b;">Merci,</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#0b2f73;">&Eacute;quipe Academia Helm</p>
            </td>
          </tr>

        </table>

        <!-- Footer discret -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:480px;margin-top:32px;">
          <tr>
            <td style="padding-top:20px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;text-align:center;">
                Vous recevez ce courriel car un code de v&eacute;rification a &eacute;t&eacute; demand&eacute; pour acc&eacute;der au back-office Academia Helm.<br>
                Si vous n'&ecirc;tes pas &agrave; l'origine de cette demande, veuillez ignorer ce courriel.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#cbd5e1;text-align:center;">
                &copy; ${new Date().getFullYear()} Academia Helm &middot; <a href="https://academiahelm.com" style="color:#94a3b8;text-decoration:none;">academiahelm.com</a>
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

export function renderAdminOtpEmailText(params: OtpEmailParams): string {
  const { name, otp, validityMinutes = 10 } = params;
  const displayName = name || 'Administrateur';
  return `Veuillez vérifier votre identité, ${displayName}

Vous avez demandé à accéder au back-office Academia Helm. Voici votre code de vérification :

${otp}

Ce code est valable ${validityMinutes} minutes et ne peut être utilisé qu'une seule fois.
Veuillez ne pas partager ce code avec personne : nous ne vous le demanderons jamais par téléphone ni par courriel.

Merci,
Équipe Academia Helm

Vous recevez ce courriel car un code de vérification a été demandé pour accéder au back-office Academia Helm.
Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce courriel.

© ${new Date().getFullYear()} Academia Helm · academiahelm.com`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 : PORTAIL ÉCOLE (personnel de l'établissement)
// ─────────────────────────────────────────────────────────────────────────────

export function renderSchoolOtpEmailHtml(params: OtpEmailParams): string {
  const { name, otp, validityMinutes = 10 } = params;
  const displayName = name || 'cher utilisateur';
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Code de vérification — Connexion établissement</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.6;color:#1e293b;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:480px;">

          <!-- Logo centré (couleurs originales) -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${logoUrl}" alt="Academia Helm" width="56" height="56" style="display:block;margin:0 auto;width:56px;height:56px;border-radius:12px;">
            </td>
          </tr>

          <!-- Titre -->
          <tr>
            <td style="padding-bottom:24px;text-align:left;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0b2f73;line-height:1.4;">
                Veuillez vérifier votre identité, ${escapeHtml(displayName)}
              </h1>
            </td>
          </tr>

          <!-- Texte d'introduction -->
          <tr>
            <td style="padding-bottom:20px;text-align:left;">
              <p style="margin:0;font-size:16px;color:#475569;line-height:1.6;">
                Vous avez demand&eacute; &agrave; vous connecter &agrave; votre &eacute;tablissement sur Academia Helm. Voici votre code de v&eacute;rification :
              </p>
            </td>
          </tr>

          <!-- Code OTP (grand, centré, style GitHub) -->
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#0b2f73;font-family:'SF Mono',Monaco,Consolas,'Courier New',monospace;">
                ${otp}
              </p>
            </td>
          </tr>

          <!-- Validité + sécurité -->
          <tr>
            <td style="padding-bottom:28px;text-align:left;">
              <p style="margin:0 0 8px;font-size:14px;color:#64748b;">
                Ce code est valable ${validityMinutes} minutes et ne peut &ecirc;tre utilis&eacute; qu'une seule fois.
              </p>
              <p style="margin:0;font-size:14px;color:#64748b;">
                Veuillez ne pas partager ce code avec personne : nous ne vous le demanderons jamais par t&eacute;l&eacute;phone ni par courriel.
              </p>
            </td>
          </tr>

          <!-- Séparateur -->
          <tr>
            <td style="padding-bottom:28px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="text-align:left;">
              <p style="margin:0 0 2px;font-size:16px;color:#1e293b;">Cordialement,</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#0b2f73;">Academia Helm</p>
            </td>
          </tr>

        </table>

        <!-- Footer discret -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:480px;margin-top:32px;">
          <tr>
            <td style="padding-top:20px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;text-align:center;">
                Vous recevez ce courriel car un code de v&eacute;rification a &eacute;t&eacute; demand&eacute; pour vous connecter &agrave; votre &eacute;tablissement sur Academia Helm.<br>
                Si vous n'&ecirc;tes pas &agrave; l'origine de cette demande, veuillez ignorer ce courriel.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#cbd5e1;text-align:center;">
                &copy; ${new Date().getFullYear()} Academia Helm &middot; <a href="https://academiahelm.com" style="color:#94a3b8;text-decoration:none;">academiahelm.com</a>
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

export function renderSchoolOtpEmailText(params: OtpEmailParams): string {
  const { name, otp, validityMinutes = 10 } = params;
  const displayName = name || 'cher utilisateur';
  return `Veuillez vérifier votre identité, ${displayName}

Vous avez demandé à vous connecter à votre établissement sur Academia Helm. Voici votre code de vérification :

${otp}

Ce code est valable ${validityMinutes} minutes et ne peut être utilisé qu'une seule fois.
Veuillez ne pas partager ce code avec personne : nous ne vous le demanderons jamais par téléphone ni par courriel.

Cordialement,
Academia Helm

Vous recevez ce courriel car un code de vérification a été demandé pour vous connecter à votre établissement sur Academia Helm.
Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce courriel.

© ${new Date().getFullYear()} Academia Helm · academiahelm.com`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS pour rétrocompatibilité (admin-auth-server.ts utilise renderOtpEmailHtml)
// ─────────────────────────────────────────────────────────────────────────────

export function renderOtpEmailHtml(params: OtpEmailParams): string {
  return renderAdminOtpEmailHtml(params);
}

export function renderOtpEmailText(params: OtpEmailParams): string {
  return renderAdminOtpEmailText(params);
}
