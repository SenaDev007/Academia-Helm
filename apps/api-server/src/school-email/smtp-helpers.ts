/**
 * ============================================================================
 * 📧 TÂCHE 181 — AIDES SMTP (logique pure, testable sans base ni NestJS)
 * ============================================================================
 *
 * Contient : classification des erreurs SMTP (4xx à relancer vs 5xx/auth
 * définitives), construction du pied de page automatique, normalisation des
 * destinataires, fabrique d'options de transport Nodemailer.
 * ============================================================================
 */

import { createTransport, Transporter } from 'nodemailer';

// ─── Classification des erreurs SMTP (CDC section 5.3) ─────────────────────

export type SmtpErrorKind = 'retryable' | 'fatal_auth' | 'fatal';

/**
 * Règles du cahier des charges :
 *   - Une erreur SMTP 4xx se relance (serveur temporairement indisponible,
 *     boîte pleine, greylisting…).
 *   - Une erreur 5xx ou une erreur d'authentification s'arrête et marque la
 *     connexion en statut Erreur.
 */
export function classifySmtpError(err: unknown): SmtpErrorKind {
  const e = err as any;
  if (!e) return 'retryable';

  // 1. Code de réponse SMTP explicite (Nodemailer : err.responseCode)
  const code: number | undefined =
    typeof e.responseCode === 'number'
      ? e.responseCode
      : typeof e.smtpCode === 'number'
        ? e.smtpCode
        : undefined;

  // 2. Authentification refusée → fatal + connexion en Erreur
  //    (vérifié AVANT le 5xx générique : 535 est un 5xx de type auth)
  const codeStr = String(e.code || '');
  const msg = `${e.message || ''} ${e.response || ''}`.toLowerCase();
  if (
    codeStr === 'EAUTH' ||
    code === 535 ||
    msg.includes('invalid login') ||
    msg.includes('authentication failed') ||
    msg.includes('bad credentials') ||
    msg.includes('username and password not accepted')
  ) {
    return 'fatal_auth';
  }

  // 3. 5xx (autres) → définitif
  if (code !== undefined && code >= 500 && code < 600) {
    // 550, 551, 553, 554… (552 « mailbox full » est parfois temporaire chez
    // Gmail : traité en fatal comme les autres 5xx, conforme au CDC §5.3)
    return 'fatal';
  }

  // 4. 4xx → relance
  if (code !== undefined && code >= 400 && code < 500) {
    // 421, 450, 451, 452… → relance
    return 'retryable';
  }

  // 5. Erreurs réseau / temporaires Nodemailer et Node → relance
  const retryableCodes = [
    'ETIMEDOUT',
    'ECONNECTION',
    'ECONNRESET',
    'ESOCKET',
    'EPIPE',
    'EDNS',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
  ];
  if (retryableCodes.includes(codeStr)) return 'retryable';

  // 6. Message explicite « temporarily » / « try again » → relance
  if (msg.includes('temporar') || msg.includes('try again') || msg.includes('greylist')) {
    return 'retryable';
  }

  // 7. Par défaut : une erreur inconnue consomme une tentative (relance),
  //    mais 3 échecs au total marquent l'échec définitif (géré par la file).
  return 'retryable';
}

/** Message d'erreur court, SÛR (jamais de secret) pour statut/lastError. */
export function safeSmtpErrorMessage(err: unknown): string {
  const e = err as any;
  const parts: string[] = [];
  if (e?.code) parts.push(String(e.code));
  if (e?.responseCode) parts.push(`SMTP ${e.responseCode}`);
  let msg = String(e?.message || 'Erreur SMTP inconnue');
  // ⚠️ CDC §7.2 — ne JAMAIS journaliser un secret : masque les motifs
  // password=xxx / pass: xxx / token=xxx même si le transporteur les incluait.
  msg = msg
    .replace(/\b(pass(?:word)?|pwd|secret|token|auth)\s*[=:]\s*\S+/gi, '$1=[MASQUÉ]')
    .slice(0, 300);
  parts.push(msg);
  return parts.join(' — ');
}

// ─── Pied de page automatique (CDC section 3, règles d'en-têtes) ───────────

export function appendHtmlFooter(html: string, schoolName: string): string {
  const footer = `
<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7280;line-height:1.5">
  ${escapeHtml(schoolName)}<br/>
  Envoyé via Academia Helm
</div>`;
  if (!html || !html.includes('<body')) {
    return `${html || ''}${footer}`;
  }
  // Insère juste avant </body> si présent.
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return `${html}${footer}`;
  return `${html.slice(0, idx)}${footer}${html.slice(idx)}`;
}

export function appendTextFooter(text: string, schoolName: string): string {
  return `${text || ''}\n\n— ${schoolName}\nEnvoyé via Academia Helm`;
}

// ─── Branding e-mail (retour promoteur 2026-11-26 — logo école en-tête/pied) ─

/** Identité visuelle de l'école appliquée à TOUS ses e-mails. */
export interface SchoolEmailBranding {
  /** Nom affiché (fromName de l'onglet E-mail, sinon fiche école). */
  schoolName: string;
  /**
   * Content-ID du logo embarqué en pièce jointe inline — méthode la plus
   * compatible (Gmail webmail, Outlook, Apple Mail) : le logo s'affiche même
   * si son URL d'origine est protégée ou expirée.
   */
  logoCid?: string;
  /**
   * URL publique du logo — utilisée quand l'embarquement en pièce jointe a
   * échoué (repli <img src="https://…">).
   */
  logoUrl?: string;
  /** Lignes de contact affichées dans le pied de page (adresse, tél, e-mail…). */
  contactLines: string[];
}

/** CID fixe du logo (une seule pièce jointe inline réutilisée header+footer). */
export const SCHOOL_LOGO_CID = 'school-logo@academiahelm';

/** Balise <img> du logo (CID si embarqué, sinon URL publique) — ou null. */
export function schoolLogoImgTag(
  branding: SchoolEmailBranding,
  heightPx: number,
  extraStyle = '',
): string | null {
  const src = branding.logoCid ? `cid:${branding.logoCid}` : branding.logoUrl;
  if (!src) return null;
  return (
    `<img src="${escapeHtml(src)}" alt="Logo" height="${heightPx}" ` +
    `style="vertical-align:middle;height:${heightPx}px;max-height:${heightPx}px;${extraStyle}" />`
  );
}

/**
 * ⭐ Retour promoteur 2026-11-26 — le logo de l'école doit s'afficher dans
 * l'EN-TÊTE et le PIED de chaque e-mail envoyé par l'école (à la place de la
 * seule mention texte). Appliqué au point d'entrée unique (dispatcher) pour
 * couvrir tous les modules (Communication, RH, Finance, Élèves, Pédagogie…).
 *
 * Insertion compatible clients mail : tableaux + styles inline uniquement
 * (pas de flexbox — Outlook), logo en CID quand il a pu être embarqué.
 */
export function wrapHtmlWithBranding(html: string, branding: SchoolEmailBranding): string {
  const name = escapeHtml(branding.schoolName || 'École');
  const contacts = (branding.contactLines || []).filter(Boolean).map(escapeHtml).join(' · ');

  const headerLogo = schoolLogoImgTag(branding, 56, 'margin-right:12px;');
  const header = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-bottom:3px solid #1a2ba6">
  <tr>
    <td style="padding:16px 8px 12px 8px;font-family:Arial,Helvetica,sans-serif">
      ${headerLogo ? `${headerLogo} ` : ''}<span style="font-size:18px;font-weight:bold;color:#111827;vertical-align:middle">${name}</span>
    </td>
  </tr>
</table>`;

  const footerLogo = schoolLogoImgTag(branding, 40);
  const footer = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
  <tr>
    <td align="center" style="padding:18px 8px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif">
      ${footerLogo ? `${footerLogo}<br/>` : ''}<span style="font-size:13px;font-weight:bold;color:#374151">${name}</span><br/>
      ${contacts ? `<span style="font-size:11px;color:#6b7280;line-height:1.6">${contacts}</span><br/>` : ''}
      <span style="font-size:10px;color:#9ca3af">Envoyé via Academia Helm</span>
    </td>
  </tr>
</table>`;

  if (!html) return `${header}${footer}`;
  const lower = html.toLowerCase();
  const bodyOpen = lower.lastIndexOf('<body');
  if (bodyOpen !== -1) {
    // Document complet : en-tête juste après <body …>, pied avant </body>.
    const bodyTagEnd = html.indexOf('>', bodyOpen);
    if (bodyTagEnd !== -1) {
      const afterBody = html.slice(bodyTagEnd + 1);
      const closeIdx = afterBody.toLowerCase().lastIndexOf('</body>');
      const withFooter =
        closeIdx === -1
          ? `${afterBody}${footer}`
          : `${afterBody.slice(0, closeIdx)}${footer}${afterBody.slice(closeIdx)}`;
      return `${html.slice(0, bodyTagEnd + 1)}${header}${withFooter}`;
    }
  }
  return `${header}${html}${footer}`;
}

/** Pied de page texte enrichi (coordonnées de l'école — pas de logo en texte brut). */
export function appendTextFooterWithBranding(
  text: string,
  branding: SchoolEmailBranding,
): string {
  const lines = [branding.schoolName, ...(branding.contactLines || []).filter(Boolean)];
  return `${text || ''}\n\n— ${lines.join('\n')}${lines.length ? '\n' : ''}Envoyé via Academia Helm`;
}

// ─── Reply-To : l'école reçoit les réponses (retour promoteur 2026-11-26) ───

/** Adresse jeton du module Communication (log_xxx@replies.… — webhook inbound) ? */
export function isTokenReplyAddress(value?: string | null): boolean {
  return !!value && /^log_[a-f0-9]+@/i.test(value.trim());
}

/**
 * Priorité du champ Reply-To :
 *   1. adresse explicite fournie par le module appelant (ex. replyToOverride
 *      RH : les réponses du candidat vont DIRECTEMENT au recruteur) ;
 *   2. Reply-To configuré dans l'onglet E-mail de l'école ;
 *   3. adresse Gmail de l'école (fromEmail) — les réponses arrivent dans la
 *      boîte de l'école, qui lit ses e-mails directement ;
 *   4. repli : l'adresse jeton (suivi plateforme — nécessite le webhook
 *      inbound ; jamais atteinte quand l'école est configurée).
 *
 * Avant : l'adresse jeton prévalait systématiquement → les réponses des
 * destinataires partaient sur replies.academiahelm.com et l'école ne recevait
 * RIEN. Désormais l'adresse RÉELLE de l'école prime.
 */
export function resolveReplyToHeader(
  payloadReplyTo?: string | null,
  settingsReplyTo?: string | null,
  settingsFromEmail?: string | null,
): string | undefined {
  const clean = (v?: string | null): string => (v ? v.trim() : '');
  const explicit = clean(payloadReplyTo);
  if (explicit && !isTokenReplyAddress(explicit)) return explicit;
  const configured = clean(settingsReplyTo);
  if (configured) return configured;
  const schoolInbox = clean(settingsFromEmail);
  if (schoolInbox) return schoolInbox;
  return explicit || undefined;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Normalisation des destinataires ────────────────────────────────────────

export function normalizeRecipients(
  to?: string | string[] | null,
  cc?: string | string[] | null,
  bcc?: string | string[] | null,
): { to: string[]; cc: string[]; bcc: string[]; total: number } {
  const norm = (v?: string | string[] | null): string[] => {
    if (!v) return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr
      .map((s) =>
        String(s || '')
          .trim()
          .toLowerCase(),
      )
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  };
  const t = norm(to);
  const c = norm(cc);
  const b = norm(bcc);
  return { to: t, cc: c, bcc: b, total: t.length + c.length + b.length };
}

// ─── Transport SMTP (le SEUL endroit du dépôt qui crée un transport) ───────

export interface SmtpTransportConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

/** Fabrique un transporteur SMTP (587 STARTTLS / 465 SSL) avec timeouts courts. */
export function createSmtpTransport(cfg: SmtpTransportConfig): Transporter {
  // NB : pas de `pool` (défaut Nodemailer = sans pool) — pool:false casse
  // la résolution d'overload de createTransport avec @types/nodemailer 7.
  return createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

// ─── Conversion des pièces jointes de la file (base64) vers Nodemailer ─────

export function queueAttachmentsToNodemailer(
  attachments?: Array<{
    filename: string;
    content?: string;
    contentBase64?: boolean;
    path?: string;
    contentType?: string;
  }>,
): Array<{ filename: string; content?: Buffer; path?: string; contentType?: string }> | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((a) => {
    const out: { filename: string; content?: Buffer; path?: string; contentType?: string } = {
      filename: a.filename,
    };
    if (a.content !== undefined) {
      out.content = a.contentBase64
        ? Buffer.from(a.content, 'base64')
        : Buffer.from(a.content, 'utf8');
    } else if (a.path) {
      out.path = a.path;
    }
    if (a.contentType) out.contentType = a.contentType;
    return out;
  });
}
