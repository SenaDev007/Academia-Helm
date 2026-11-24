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
    typeof e.responseCode === 'number' ? e.responseCode : typeof e.smtpCode === 'number' ? e.smtpCode : undefined;

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
    'ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EPIPE', 'EDNS',
    'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH',
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
    return arr.map((s) => String(s || '').trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
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
  attachments?: Array<{ filename: string; content?: string; contentBase64?: boolean; path?: string; contentType?: string }>,
): Array<{ filename: string; content?: Buffer; path?: string; contentType?: string }> | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((a) => {
    const out: { filename: string; content?: Buffer; path?: string; contentType?: string } = { filename: a.filename };
    if (a.content !== undefined) {
      out.content = a.contentBase64 ? Buffer.from(a.content, 'base64') : Buffer.from(a.content, 'utf8');
    } else if (a.path) {
      out.path = a.path;
    }
    if (a.contentType) out.contentType = a.contentType;
    return out;
  });
}
