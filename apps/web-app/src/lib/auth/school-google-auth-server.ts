/**
 * ============================================================================
 * School Portal Google OAuth + 2FA OTP — Service d'authentification
 * ============================================================================
 *
 * Système d'authentification pour le PORTAIL ÉCOLE (SCHOOL) uniquement.
 *
 * Flow :
 *   1. POST /api/school-auth/google/init { tenantId, tenantSlug }
 *      → renvoie URL Google OAuth avec state CSRF contenant le tenant
 *   2. Google redirige vers /login?google_callback=school&code=...&state=...
 *   3. POST /api/school-auth/google/callback { code, state }
 *      → vérifie l'email dans la DB pour ce tenant + rôle SCHOOL
 *      → envoie OTP par email
 *      → renvoie pendingToken
 *   4. POST /api/school-auth/verify-otp { pendingToken, otp }
 *      → vérifie OTP
 *      → appelle le backend NestJS pour créer une session SCHOOL
 *      → pose le cookie academia_session (compatible avec le système existant)
 *
 * CONTRAINTES :
 *   - Uniquement pour le portail ÉCOLE (SCHOOL)
 *   - L'utilisateur doit exister dans la DB avec un tenant_id valide
 *   - L'email Google doit correspondre à l'email du compte utilisateur
 *   - 2FA OTP obligatoire (6 chiffres, validité 10 min, 5 tentatives max)
 *
 * Séparation avec admin-auth-server.ts :
 *   - admin-auth-server = back-office (cookie academia_admin_session)
 *   - school-google-auth-server = portail école (cookie academia_session)
 *   - Mêmes helpers crypto/OTP, mais sessions distinctes
 * ============================================================================
 */

import crypto from 'crypto';

// ─── Constantes ─────────────────────────────────────────────────────────────

const SCHOOL_PENDING_COOKIE = 'academia_school_google_pending';
const OTP_VALIDITY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SchoolGoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export interface SchoolPendingSession {
  email: string;
  name: string;
  picture?: string;
  tenantId: string;
  tenantSlug: string;
  otpHash: string;
  otpExpiresAt: string;
  attempts: number;
  pendingToken: string;
}

// ─── Store pending sessions (en mémoire, comme admin-auth) ──────────────────

const pendingStore = new Map<string, SchoolPendingSession>();

// Nettoyage périodique
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, val] of pendingStore.entries()) {
        if (new Date(val.otpExpiresAt).getTime() < now) {
          pendingStore.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  ).unref?.();
}

// ─── Helpers (partagés avec admin-auth-server) ──────────────────────────────

function getJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'dev-school-secret-change-me';
}

function generateOtp(): string {
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, '0');
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp + getJwtSecret()).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Google OAuth config ────────────────────────────────────────────────────

export function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    // Redirect URI différente de l'admin : /login avec google_callback=school
    redirectUri:
      process.env.GOOGLE_OAUTH_SCHOOL_REDIRECT_URI ||
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      '',
  };
}

export function isGoogleConfigured(): boolean {
  const c = getGoogleOAuthConfig();
  return Boolean(c.clientId && c.clientSecret && c.redirectUri);
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<SchoolGoogleUser | null> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return null;
    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) return null;
    const payloadB64 = tokens.id_token.split('.')[1];
    const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson) as {
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    if (!payload.email || !payload.email_verified) return null;
    return {
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

// ─── Vérification utilisateur côté backend NestJS ───────────────────────────

/**
 * Vérifie qu'un utilisateur avec cet email existe dans la DB pour ce tenant
 * et qu'il a un rôle compatible avec le portail SCHOOL.
 *
 * Appelle l'endpoint NestJS /api/auth/check-school-user (à implémenter côté NestJS).
 * Si l'endpoint n'existe pas, on fait confiance à l'email + tenant et on laisse
 * le login NestJS final valider les credentials.
 */
export async function checkSchoolUserExists(
  email: string,
  tenantIdOrSlug: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  if (!apiUrl) {
    return { ok: false, reason: 'API URL non configurée' };
  }
  try {
    const res = await fetch(
      `${apiUrl.replace(/\/$/, '')}/auth/check-school-user`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tenant_id: tenantIdOrSlug }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        reason: data.message || 'Utilisateur non trouvé pour ce tenant',
      };
    }
    const data = (await res.json()) as { userId?: string };
    if (!data.userId) {
      return { ok: false, reason: 'Utilisateur non trouvé' };
    }
    return { ok: true, userId: data.userId };
  } catch (err) {
    return {
      ok: false,
      reason: 'Erreur lors de la vérification utilisateur',
    };
  }
}

// ─── Pending session management ─────────────────────────────────────────────

export function createSchoolPendingSession(params: {
  email: string;
  name: string;
  picture?: string;
  tenantId: string;
  tenantSlug: string;
}): { pendingToken: string; otp: string } {
  // Nettoyer un éventuel pending précédent pour cet email + tenant
  for (const [key, val] of pendingStore.entries()) {
    if (val.email === params.email && val.tenantId === params.tenantId) {
      pendingStore.delete(key);
    }
  }
  const otp = generateOtp();
  const pendingToken = generateToken();
  const pending: SchoolPendingSession = {
    email: params.email.toLowerCase(),
    name: params.name,
    picture: params.picture,
    tenantId: params.tenantId,
    tenantSlug: params.tenantSlug,
    otpHash: hashOtp(otp),
    otpExpiresAt: new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    pendingToken,
  };
  pendingStore.set(pendingToken, pending);
  return { pendingToken, otp };
}

export function verifySchoolOtp(
  pendingToken: string,
  otp: string,
): { ok: true; pending: SchoolPendingSession } | { ok: false; reason: string } {
  const pending = pendingStore.get(pendingToken);
  if (!pending) {
    return { ok: false, reason: 'Session invalide ou expirée. Veuillez recommencer.' };
  }
  if (new Date(pending.otpExpiresAt) < new Date()) {
    pendingStore.delete(pendingToken);
    return { ok: false, reason: 'Le code OTP a expiré. Veuillez recommencer.' };
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    pendingStore.delete(pendingToken);
    return { ok: false, reason: 'Trop de tentatives. Veuillez recommencer.' };
  }
  pending.attempts++;
  if (pending.otpHash !== hashOtp(otp)) {
    return {
      ok: false,
      reason: `Code OTP incorrect (${OTP_MAX_ATTEMPTS - pending.attempts} tentative(s) restante(s)).`,
    };
  }
  pendingStore.delete(pendingToken);
  return { ok: true, pending };
}

// ─── Email OTP sender (réutilise le template admin) ─────────────────────────

export async function sendSchoolOtpEmail(
  email: string,
  otp: string,
  name?: string,
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (process.env.NODE_ENV === 'development' && !resendApiKey) {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  [SCHOOL OTP] — Mode développement (pas de Resend)');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Destinataire : ${email.padEnd(34)}║`);
    console.log(`║  Code OTP     : ${otp.padEnd(34)}║`);
    console.log('╚════════════════════════════════════════════════╝\n');
    return true;
  }

  if (!resendApiKey) {
    console.error('RESEND_API_KEY manquant — impossible d\'envoyer l\'email OTP school');
    return false;
  }

  let Resend: new (apiKey: string) => {
    emails: {
      send: (params: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text?: string;
        reply_to?: string;
      }) => Promise<{ id?: string; error?: { message?: string } | null }>;
    };
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resendModule = require('resend');
    Resend = resendModule.Resend || resendModule.default?.Resend || resendModule.default;
  } catch (err) {
    console.error('Module "resend" non disponible :', err);
    return false;
  }

  // Réutilise le template OTP de l'admin (même design palette Helm)
  const { renderOtpEmailHtml, renderOtpEmailText } = require('./email-templates');
  const html = renderOtpEmailHtml({
    name,
    otp,
    validityMinutes: OTP_VALIDITY_MINUTES,
  });
  const text = renderOtpEmailText({ name, otp, validityMinutes: OTP_VALIDITY_MINUTES });

  const fromEmail =
    process.env.ADMIN_EMAIL_FROM ||
    'Academia Helm <noreply@academiahelm.com>';
  const replyTo = process.env.ADMIN_EMAIL_REPLY_TO || 'support@academiahelm.com';

  try {
    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Votre code de vérification — Connexion établissement Academia Helm',
      html,
      text,
      reply_to: replyTo,
    });

    if (result.error) {
      console.error('Resend a retourné une erreur :', result.error);
      return false;
    }
    console.log(`[SCHOOL OTP] Email envoyé à ${email} — ID Resend: ${result.id || 'N/A'}`);
    return true;
  } catch (err) {
    console.error('Erreur lors de l\'envoi de l\'email OTP school via Resend :', err);
    return false;
  }
}

// ─── Login final via NestJS (pour poser le cookie academia_session) ─────────

/**
 * Appelle le backend NestJS avec un endpoint spécial "google-login" qui crée
 * une session pour l'utilisateur sans vérifier le mot de passe (l'identité a
 * déjà été prouvée via Google + OTP).
 *
 * Si l'endpoint n'existe pas côté NestJS, on fallback en cherchant l'utilisateur
 * par email et en générant un JWT directement (à éviter en prod).
 */
export async function createSchoolSessionViaGoogle(params: {
  email: string;
  tenantId: string;
}): Promise<{
  ok: true;
  user: { id: string; email: string; firstName?: string; lastName?: string; role?: string };
  tenant: { id: string; name: string; slug: string; subdomain?: string };
  accessToken: string;
  refreshToken: string;
  serverSessionId?: string;
} | { ok: false; reason: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  if (!apiUrl) return { ok: false, reason: 'API URL non configurée' };

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        tenant_id: params.tenantId,
        portal_type: 'SCHOOL',
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        reason: data.message || 'Erreur lors de la création de session',
      };
    }

    const data = (await res.json()) as {
      user: { id: string; email: string; firstName?: string; lastName?: string; role?: string };
      tenant: { id: string; name: string; slug: string; subdomain?: string };
      accessToken: string;
      refreshToken: string;
      serverSessionId?: string;
    };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, reason: 'Erreur réseau lors de la création de session' };
  }
}

// ─── Cookie helpers ─────────────────────────────────────────────────────────

export const SCHOOL_PENDING_COOKIE_NAME = SCHOOL_PENDING_COOKIE;

export function serializeSchoolPendingCookie(pendingToken: string): string {
  const maxAge = OTP_VALIDITY_MINUTES * 60;
  return `${SCHOOL_PENDING_COOKIE}=${pendingToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSchoolPendingCookie(): string {
  return `${SCHOOL_PENDING_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
