/**
 * ============================================================================
 * Admin Auth Service — Service d'authentification dédié au back-office
 * ============================================================================
 *
 * Architecture :
 *   - Système d'authentification SÉPARÉ de celui des tenants Academia Helm
 *   - 2 méthodes : Google OAuth + Email/mot de passe (avec 2FA OTP email)
 *   - 2FA : OTP 6 chiffres envoyé par email après validation du 1er facteur
 *   - Session : cookie dédié `academia_admin_session` (distinct du tenant)
 *   - Vérification : liste blanche d'emails admin dans env var ADMIN_EMAILS
 *
 * Flow Google OAuth :
 *   1. POST /api/admin-auth/google/init → renvoie URL Google OAuth (state CSRF)
 *   2. Google redirige vers /admin-login?code=...&state=...
 *   3. POST /api/admin-auth/google/callback { code, state } → envoie OTP email
 *   4. POST /api/admin-auth/verify-otp { email, otp, sessionToken } → cookie session
 *
 * Flow email/password :
 *   1. POST /api/admin-auth/login { email, password } → vérifie + envoie OTP email
 *   2. POST /api/admin-auth/verify-otp { email, otp, sessionToken } → cookie session
 *
 * Sécurité :
 *   - Liste blanche d'emails (env var ADMIN_EMAILS, séparés par virgules)
 *   - OTP 6 chiffres, validité 10 min, max 5 tentatives
 *   - Cookie httpOnly, secure, sameSite=strict, durée 12h
 *   - State CSRF pour Google OAuth
 * ============================================================================
 */

import crypto from 'crypto';

// ─── Constantes ─────────────────────────────────────────────────────────────

const ADMIN_SESSION_COOKIE = 'academia_admin_session';
const ADMIN_PENDING_COOKIE = 'academia_admin_pending';
const OTP_VALIDITY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_DURATION_HOURS = 12;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  /** Prénom (extrait de `name`) — requis par le type User de @/types. */
  firstName: string;
  /** Nom (extrait de `name`) — requis par le type User de @/types. */
  lastName: string;
  picture?: string;
  role: 'PLATFORM_SUPER_ADMIN' | 'PLATFORM_OWNER';
}

export interface AdminSession {
  user: AdminUser;
  issuedAt: string;
  expiresAt: string;
  /** Signature HMAC pour empêcher la falsification côté client. */
  signature: string;
}

interface PendingSession {
  email: string;
  name: string;
  picture?: string;
  otpHash: string;
  otpExpiresAt: string;
  attempts: number;
  /** Token court pour relier la requête verify-otp au pending. */
  pendingToken: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} is required for admin auth`);
  return v;
}

function getAdminEmailsWhitelist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getJwtSecret(): string {
  // Réutilise JWT_SECRET du backend si disponible, sinon fallback.
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'dev-admin-secret-change-me';
}

function hmacSign(payload: string): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(payload).digest('hex');
}

function generateOtp(): string {
  // 6 chiffres — utilise crypto pour qualité cryptographique.
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

// ─── Session management ─────────────────────────────────────────────────────

/**
 * Sépare un nom complet en firstName / lastName.
 * - "Jean Dupont" → { firstName: "Jean", lastName: "Dupont" }
 * - "Jean" → { firstName: "Jean", lastName: "" }
 * - "" → { firstName: "", lastName: "" }
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Crée une session admin à partir d'infos Google (qui ne fournissent que `name`).
 * `firstName` et `lastName` sont extraits automatiquement de `name`.
 */
export function createAdminSessionFromGoogle(params: {
  id: string;
  email: string;
  name: string;
  picture?: string;
}): AdminSession {
  const { firstName, lastName } = splitName(params.name);
  const user: AdminUser = {
    id: params.id,
    email: params.email,
    name: params.name,
    firstName,
    lastName,
    picture: params.picture,
    role: 'PLATFORM_SUPER_ADMIN',
  };
  return createAdminSession(user);
}

export function createAdminSession(user: AdminUser): AdminSession {
  // S'assurer que firstName/lastName sont toujours peuplés (même si l'appelant
  // ne les a pas fournis — on les extrait de `name` par sécurité).
  if (!user.firstName && !user.lastName && user.name) {
    const { firstName, lastName } = splitName(user.name);
    user = { ...user, firstName, lastName };
  }
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const payload = JSON.stringify({
    user,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  const signature = hmacSign(payload);
  return {
    user,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    signature,
  };
}

export function verifyAdminSession(session: unknown): AdminSession | null {
  if (!session || typeof session !== 'object') return null;
  const s = session as Partial<AdminSession>;
  if (!s.user || !s.signature || !s.expiresAt) return null;
  // Vérifier l'expiration
  if (new Date(s.expiresAt) < new Date()) return null;
  // Recalculer la signature attendue
  const payload = JSON.stringify({
    user: s.user,
    issuedAt: s.issuedAt,
    expiresAt: s.expiresAt,
  });
  const expected = hmacSign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(s.signature, 'hex'))) {
    return null;
  }
  // Vérifier que l'email est toujours dans la whitelist
  const whitelist = getAdminEmailsWhitelist();
  if (!whitelist.has(s.user.email.toLowerCase())) return null;
  return s as AdminSession;
}

// ─── Pending session (attente OTP) ──────────────────────────────────────────

const pendingStore = new Map<string, PendingSession>();

// Nettoyage périodique des pending expirés (toutes les 5 min)
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

export function createPendingSession(params: {
  email: string;
  name: string;
  picture?: string;
}): { pendingToken: string; otp: string } {
  // Nettoyer un éventuel pending précédent pour cet email
  for (const [key, val] of pendingStore.entries()) {
    if (val.email.toLowerCase() === params.email.toLowerCase()) {
      pendingStore.delete(key);
    }
  }
  const otp = generateOtp();
  const pendingToken = generateToken();
  const pending: PendingSession = {
    email: params.email.toLowerCase(),
    name: params.name,
    picture: params.picture,
    otpHash: hashOtp(otp),
    otpExpiresAt: new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    pendingToken,
  };
  pendingStore.set(pendingToken, pending);
  return { pendingToken, otp };
}

export function verifyOtp(
  pendingToken: string,
  otp: string,
): { ok: true; pending: PendingSession } | { ok: false; reason: string } {
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
    return { ok: false, reason: `Code OTP incorrect (${OTP_MAX_ATTEMPTS - pending.attempts} tentative(s) restante(s)).` };
  }
  // OTP valide — on supprime le pending
  pendingStore.delete(pendingToken);
  return { ok: true, pending };
}

// ─── Whitelist ──────────────────────────────────────────────────────────────

export function isEmailAdminWhitelisted(email: string): boolean {
  return getAdminEmailsWhitelist().has(email.toLowerCase());
}

// ─── Google OAuth helpers ───────────────────────────────────────────────────

export function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
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

export async function exchangeGoogleCode(code: string): Promise<{
  email: string;
  name: string;
  picture?: string;
} | null> {
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
    // Décoder le JWT id_token (pas besoin de vérifier la signature côté client —
    // Google l'a déjà fait, et on a obtenu le token via code exchange confidentiel).
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

// ─── Email OTP sender (Resend) ──────────────────────────────────────────────

/**
 * Envoie l'OTP par email via Resend.
 *
 * - Expéditeur : Academia Helm <noreply@academiahelm.com>
 *   (configurable via ADMIN_EMAIL_FROM)
 * - Template HTML professionnel (palette navy + or) — voir email-templates.ts
 * - En dev sans RESEND_API_KEY : log dans la console
 * - En prod : utilise Resend (clé déjà configurée sur Vercel + Railway)
 *
 * @returns true si envoyé avec succès, false sinon
 */
export async function sendOtpEmail(
  email: string,
  otp: string,
  name?: string,
): Promise<boolean> {
  // Import dynamique pour éviter de casser le build si Resend n'est pas installé
  // et pour ne pas le charger si on est en dev sans clé.
  const resendApiKey = process.env.RESEND_API_KEY;

  // En dev sans clé Resend → log dans la console
  if (process.env.NODE_ENV === 'development' && !resendApiKey) {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  [ADMIN OTP] — Mode développement (pas de Resend)');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Destinataire : ${email.padEnd(34)}║`);
    console.log(`║  Code OTP     : ${otp.padEnd(34)}║`);
    console.log('╚════════════════════════════════════════════════╝\n');
    return true;
  }

  if (!resendApiKey) {
    console.error(
      'RESEND_API_KEY manquant — impossible d\'envoyer l\'email OTP. ' +
        'Configurez la variable ou passez en NODE_ENV=development.',
    );
    return false;
  }

  // Import dynamique du SDK Resend (déjà dans apps/web-app/package.json)
  // Turbopack ne supporte pas require() — utiliser await import()
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
    const resendModule = await import('resend');
    // Note : le SDK Resend expose `Resend` comme export nommé ET comme default.
    // On utilise un cast `any` pour éviter les problèmes de parsing TypeScript
    // avec `new () => unknown` dans une union (parenthésage obligatoire).
    const mod = resendModule as unknown as Record<string, unknown>;
    const ResendCtor = (mod.Resend || mod.default) as
      | (new (apiKey: string) => unknown)
      | undefined;
    if (!ResendCtor) throw new Error('Resend constructor not found');
    Resend = ResendCtor as typeof Resend;
  } catch (err) {
    console.error('Module "resend" non disponible :', err);
    return false;
  }

  // Construction du contenu email — import statique du template (même dossier)
  const { renderOtpEmailHtml, renderOtpEmailText } = await import('./email-templates');
  const html = renderOtpEmailHtml({ name, otp, validityMinutes: OTP_VALIDITY_MINUTES });
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
      subject: 'Votre code de vérification — Academia Helm Back-office',
      html,
      text,
      reply_to: replyTo,
    });

    if (result.error) {
      console.error('Resend a retourné une erreur :', result.error);
      return false;
    }

    console.log(`[ADMIN OTP] Email envoyé à ${email} — ID Resend: ${result.id || 'N/A'}`);
    return true;
  } catch (err) {
    console.error('Erreur lors de l\'envoi de l\'email OTP via Resend :', err);
    return false;
  }
}

// ─── Cookie helpers (exportés pour usage dans route handlers) ───────────────

export const ADMIN_SESSION_COOKIE_NAME = ADMIN_SESSION_COOKIE;
export const ADMIN_PENDING_COOKIE_NAME = ADMIN_PENDING_COOKIE;
export const ADMIN_SESSION_DURATION_HOURS = SESSION_DURATION_HOURS;

export function serializeAdminSessionCookie(session: AdminSession): string {
  const value = JSON.stringify(session);
  const maxAge = SESSION_DURATION_HOURS * 60 * 60;
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function serializeAdminPendingCookie(pendingToken: string): string {
  const maxAge = OTP_VALIDITY_MINUTES * 60;
  return `${ADMIN_PENDING_COOKIE}=${pendingToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function clearAdminPendingCookie(): string {
  return `${ADMIN_PENDING_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// ─── Email/password fallback (optionnel) ────────────────────────────────────

/**
 * Vérifie un mot de passe admin (méthode de secours si Google indisponible).
 *
 * Les mots de passe admin sont stockés hashés (bcrypt) dans la var d'env
 * ADMIN_PASSWORDS au format JSON : { "email@example.com": "$2b$10$..." }
 *
 * En l'absence de cette var, la méthode email/password est désactivée.
 *
 * Note : bcryptjs n'est PAS installé dans apps/web-app (uniquement dans
 * apps/api-server). Cette fonctionnalité est donc désactivée par défaut côté
 * Next.js — l'authentification admin doit se faire via Google OAuth.
 * Pour l'activer, installer bcryptjs dans apps/web-app :
 *   cd apps/web-app && npm install bcryptjs
 */
export async function verifyAdminPassword(_email: string, _password: string): Promise<boolean> {
  const raw = process.env.ADMIN_PASSWORDS;
  if (!raw) return false;
  try {
    const passwords = JSON.parse(raw) as Record<string, string>;
    const hash = passwords[_email.toLowerCase()];
    if (!hash) return false;
    // Import dynamique de bcryptjs — Turbopack ne supporte pas require()
    // Si bcryptjs n'est pas installé, on log une erreur et on renvoie false
    // (l'auth password est optionnelle — Google OAuth est la méthode recommandée)
    try {
      const bcryptModule = await import('bcryptjs');
      const bcrypt = bcryptModule.default || bcryptModule;
      // @ts-expect-error — l'API de bcryptjs est connue
      return await bcrypt.compare(_password, hash);
    } catch {
      console.error(
        'bcryptjs non installé dans apps/web-app — authentification password admin désactivée. ' +
          'Installez-le avec : cd apps/web-app && npm install bcryptjs',
      );
      return false;
    }
  } catch {
    return false;
  }
}

export function isPasswordAuthEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORDS);
}

// ─── Password reset (token JWT signé) ───────────────────────────────────────

const RESET_TOKEN_VALIDITY_MINUTES = 30;

/**
 * Génère un token de réinitialisation de mot de passe admin.
 * Le token est un JWT signé avec ADMIN_JWT_SECRET contenant l'email + expiration.
 */
export function generateResetToken(email: string): string {
  const payload = JSON.stringify({
    email: email.toLowerCase(),
    exp: Date.now() + RESET_TOKEN_VALIDITY_MINUTES * 60 * 1000,
    type: 'admin_reset',
  });
  const signature = hmacSign(payload);
  return Buffer.from(payload).toString('base64url') + '.' + signature;
}

/**
 * Vérifie un token de réinitialisation.
 * @returns l'email si valide, null sinon.
 */
export function verifyResetToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf-8');
    const signature = parts[1];
    const expected = hmacSign(payload);
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return null;
    }
    const data = JSON.parse(payload) as { email?: string; exp?: number; type?: string };
    if (data.type !== 'admin_reset') return null;
    if (!data.email || !data.exp) return null;
    if (Date.now() > data.exp) return null;
    return data.email;
  } catch {
    return null;
  }
}

/**
 * Met à jour le mot de passe admin dans ADMIN_PASSWORDS (env var).
 * Attention : cette fonction ne peut pas modifier l'env var en runtime.
 * Elle hash le nouveau mot de passe et renvoie le hash à stocker.
 *
 * En production, ADMIN_PASSWORDS devrait être stocké en DB plutôt qu'en env var.
 * Pour l'instant, on logge le hash à mettre à jour manuellement.
 */
export async function hashAdminPassword(password: string): Promise<string> {
  try {
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    // @ts-expect-error — l'API de bcryptjs est connue
    return await bcrypt.hash(password, 10);
  } catch {
    console.error('bcryptjs non installé — impossible de hasher le mot de passe');
    return '';
  }
}

export const RESET_TOKEN_VALIDITY = RESET_TOKEN_VALIDITY_MINUTES;
