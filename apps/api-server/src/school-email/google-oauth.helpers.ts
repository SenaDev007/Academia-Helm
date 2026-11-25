/**
 * ============================================================================
 * 📧 TÂCHE 183 — PHASE 2 : AIDES GOOGLE OAUTH2 (logique pure, testable)
 * ============================================================================
 *
 * Cahier des charges « Gmail de chaque école » — section 8 (Phase 2) :
 *   - Google OAuth2 avec PKCE (S256), code d'autorisation.
 *   - Portée MINIMALE : gmail.send (+ userinfo.email pour lire le compte
 *     connecté). Aucun accès en lecture/effacement des messages.
 *   - Envoi via l'API Gmail REST (messages/send) — pas de SMTP : la portée
 *     gmail.send ne fonctionne PAS sur le SMTP XOAUTH2 de Google (qui exige
 *     la portée complète https://mail.google.com/). L'API REST respecte le
 *     principe de moindre privilège du CDC et l'écran de consentement
 *     n'affiche que « Envoyer des e-mails en votre nom ».
 *   - invalid_grant → connexion « Expirée » (reconnexion nécessaire).
 *   - Migration en un clic depuis un SMTP actif (même onglet, même bouton).
 *
 * Contient : PKCE, construction de l'URL d'autorisation, classification des
 * erreurs de l'API Gmail (429/5xx → relance, 401 → auth, invalid_grant →
 * expiration), messages d'erreur sûs (jamais de jeton).
 * ============================================================================
 */

import { createHash, randomBytes } from 'crypto';

// ─── Points de terminaison Google (constants, testables) ───────────────────

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Portée d'envoi Gmail — la plus fine possible (CDC section 8). */
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
/** Lecture de l'adresse du compte connecté (impose From = compte authentifié). */
export const GOOGLE_USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

/** URL d'envoi de l'API Gmail — `me` = compte du jeton d'accès. */
export const GMAIL_API_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/** Sonde légère (users.getProfile) — sert UNIQUEMENT à détecter l'API Gmail
 *  désactivée au moment de la connexion (l'erreur classique console.cloud :
 *  « Gmail API has not been used in project X before or it is disabled »). */
export const GMAIL_API_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';

/** Chemin du callback (préfixe /api de l'api-server). */
export const GOOGLE_CALLBACK_PATH = '/api/school-email/google/callback';

// ─── Encodage base64url (RFC 4648 §5, sans remplissage) ────────────────────

export function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// ─── PKCE (RFC 7636, méthode S256) ─────────────────────────────────────────

/**
 * Verifier PKCE : 64 octets aléatoires en base64url (86 caractères —
 * dans la plage 43-128 exigée par Google).
 */
export function generateCodeVerifier(): string {
  return base64Url(randomBytes(64));
}

/** Challenge S256 = BASE64URL(SHA256(verifier)), sans remplissage. */
export function pkceChallengeS256(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier, 'ascii').digest());
}

/** État anti-CSRF : 32 octets aléatoires en hexadécimal (single usage). */
export function generateOauthState(): string {
  return randomBytes(32).toString('hex');
}

// ─── URL d'autorisation ─────────────────────────────────────────────────────

export interface GoogleAuthUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  /** Pré-sélectionne le compte Google de l'école dans l'écran de consentement. */
  loginHint?: string;
}

/**
 * Construit l'URL de consentement Google :
 * - access_type=offline + prompt=consent → un refresh token est TOUJOURS
 *   réémis (même si l'école avait déjà autorisé l'application) ;
 * - include_granted_scopes → pas de re-consentement aux autres portées.
 */
export function buildGoogleAuthUrl(opts: GoogleAuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: `${GMAIL_SEND_SCOPE} ${GOOGLE_USERINFO_EMAIL_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  if (opts.loginHint) params.set('login_hint', opts.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

// ─── Erreurs normalisées ────────────────────────────────────────────────────

/** Erreur HTTP de l'API Gmail (ou du point de terminaison token). */
export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText = '',
  ) {
    super(message);
    this.name = 'GmailApiError';
  }
}

/** Jeton Google révoqué/expiré côté école (invalid_grant) → connexion Expirée. */
export class GoogleAuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthExpiredError';
  }
}

export type GmailErrorKind = 'retryable' | 'fatal_auth' | 'fatal' | 'expired';

/**
 * Classification des erreurs de l'API Gmail (équivaut de classifySmtpError,
 * CDC section 5.3 adapté au REST) :
 *   - invalid_grant (400)            → expired  : connexion Expirée, reconnexion
 *   - 401 / 403 « invalid credentials » après refresh → fatal_auth
 *   - 429 (quota Gmail)              → retryable (relance backoff)
 *   - 5xx (backend Google transitoire)→ retryable — recommandation officielle
 *     Google : réessayer 5xx/429 avec backoff exponentiel
 *   - 400/403/4xx autres             → fatal (argument invalide, From refusé…)
 */
export function classifyGmailApiError(err: unknown): GmailErrorKind {
  if (err instanceof GoogleAuthExpiredError) return 'expired';
  const e = err as any;
  if (!e) return 'retryable';

  const status: number | undefined =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : undefined;
  const body = String(e.bodyText || '');
  const msg = `${e.message || ''} ${body}`.toLowerCase();

  // invalid_grant : refresh token révoqué (mot de passe changé, 6 mois sans
  // usage, retrait dans le Compte Google, client secret tourné…)
  if (status === 400 && body.includes('invalid_grant')) return 'expired';
  if (msg.includes('invalid_grant')) return 'expired';

  // Authentification refusée (401 après refresh unique, 403 invalid credentials)
  if (status === 401) return 'fatal_auth';
  if (status === 403 && (msg.includes('invalid credentials') || msg.includes('auth')))
    return 'fatal_auth';

  // Quota / backend transitoire → relance (guidance Google)
  if (status === 429) return 'retryable';
  if (status !== undefined && status >= 500 && status < 600) return 'retryable';

  // Réseau / temporaires Node → relance
  const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ECONNABORTED'];
  if (typeof e.code === 'string' && retryableCodes.includes(e.code)) return 'retryable';
  if (msg.includes('temporar') || msg.includes('try again') || msg.includes('timeout'))
    return 'retryable';

  // 4xx définitif (400 argument, 403 autre, 404…)
  if (status !== undefined && status >= 400 && status < 500) return 'fatal';

  // Inconnu → consomme une tentative de relance (3 max au total).
  return 'retryable';
}

/**
 * Message d'erreur court et SÛR (jamais de jeton) pour statut/lastError —
 * même politique de masquage que safeSmtpErrorMessage (CDC §7.2).
 */
export function safeGmailErrorMessage(err: unknown): string {
  const e = err as any;
  const parts: string[] = [];
  if (e?.status) parts.push(`Gmail ${e.status}`);
  let msg = String(e?.message || 'Erreur Google inconnue');
  // ⚠️ CDC §7.2 — ne JAMAIS journaliser un jeton : masque les motifs
  // key=value (password=…, token=…, refresh_token=…) ET les valeurs Bearer.
  msg = msg
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [MASQUÉ]')
    .replace(
      /\b(pass(?:word)?|pwd|secret|token|refresh_token|access_token|auth)\s*[=:]\s*\S+/gi,
      '$1=[MASQUÉ]',
    )
    .slice(0, 300);
  parts.push(msg);
  return parts.join(' — ');
}

/**
 * true si le corps d'erreur provient d'une API Gmail désactivée dans le projet
 * Google Cloud (erreur 403 « Gmail API has not been used in project X before or
 * it is disabled »). Distinct d'un refus de portée (« Request had insufficient
 * authentication scopes ») qui ne bloque PAS la connexion.
 */
export function isGmailApiDisabledError(bodyText: string): boolean {
  const t = String(bodyText || '').toLowerCase();
  return t.includes('has not been used in project') || t.includes('it is disabled');
}

/**
 * Extrait la raison d'un refus du point de terminaison token Google
 * (réponses form-encoded OU JSON) — sans jamais inclure le jeton.
 */
export function tokenErrorReason(responseText: string): string {
  const t = String(responseText || '');
  // Gmail API REST : {"error":{"code":403,"message":"…","status":"PERMISSION_DENIED"}}
  // (imbrication objet — le motif "error":"valeur" ne matche pas).
  const gmailMsg = t.match(/"error"\s*:\s*\{[\s\S]*?"message"\s*:\s*"([^"]+)"/);
  if (gmailMsg) {
    const gmailStatus = t.match(/"error"\s*:\s*\{[\s\S]*?"status"\s*:\s*"([^"]+)"/);
    const msg = gmailMsg[1].slice(0, 250);
    return gmailStatus ? `${msg} (${gmailStatus[1]})` : msg;
  }
  // JSON : {"error":"invalid_grant","error_description":"..."}
  const jsonMatch = t.match(/"error"\s*:\s*"([^"]+)"/);
  if (jsonMatch) {
    const desc = t.match(/"error_description"\s*:\s*"([^"]*)"/);
    return desc ? `${jsonMatch[1]} — ${desc[1].slice(0, 200)}` : jsonMatch[1];
  }
  // form-encoded : error=invalid_grant&error_description=...
  try {
    const params = new URLSearchParams(t);
    const error = params.get('error');
    if (error) {
      const desc = params.get('error_description');
      return desc ? `${error} — ${desc.slice(0, 200)}` : error;
    }
  } catch {
    /* ignore */
  }
  return t.slice(0, 200) || 'erreur inconnue';
}
