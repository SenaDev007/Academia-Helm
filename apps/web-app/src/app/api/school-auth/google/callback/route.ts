/**
 * ============================================================================
 * GET/POST /api/school-auth/google/callback
 * ============================================================================
 *
 * Flow SCHOOL — Portail École
 *
 * ─── GET (chemin principal, server-side callback) ───────────────────────────
 *
 * Google redirige ici après consentement :
 *     https://academiahelm.com/api/school-auth/google/callback?code=...&state=...
 *
 * La route GET fait TOUT côté serveur :
 *   1. Vérifie le state CSRF (vs cookie school_oauth_state)
 *   2. Décode le state pour récupérer tenantId / tenantSlug / schoolName
 *   3. Échange le code Google contre un id_token (exchangeGoogleCode)
 *   4. Vérifie l'utilisateur côté backend NestJS (checkSchoolUserExists)
 *   5. Crée la session pending + génère l'OTP (createSchoolPendingSession)
 *   6. Envoie l'OTP par email (sendSchoolOtpEmail)
 *   7. Pose le cookie `academia_school_google_pending` (Domain=.academiahelm.com)
 *   8. Redirige (302) vers `/login?otp_pending=1&email=...&token=...&tenant=...`
 *
 * Le navigateur suit naturellement la redirection 302 — aucun fetch côté
 * client, pas de risque de collision JSON/HTML, et les cookies posés avec
 * Domain=.academiahelm.com survivent à la 307 Vercel (academiahelm.com →
 * www.academiahelm.com).
 *
 * En cas d'erreur, on redirige vers `/login?google_error=<msg>&tenant=...`
 * pour que la LoginPage puisse afficher le message d'erreur.
 *
 * ─── POST (compatibilité legacy) ────────────────────────────────────────────
 *
 * Conservé pour ne pas casser d'éventuels clients anciens. Même logique que
 * le GET mais avec { code, state } dans le body et réponse JSON.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkSchoolUserExists,
  createSchoolPendingSession,
  exchangeGoogleCode,
  serializeSchoolPendingCookie,
  sendSchoolOtpEmail,
} from '@/lib/auth/school-google-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Helpers partagés ─────────────────────────────────────────────────────

interface DecodedState {
  tenantId: string;
  tenantSlug: string;
  schoolName: string;
}

/**
 * Décode le state CSRF (base64url JSON) pour récupérer le contexte tenant.
 * Le state a été posé par /api/school-auth/google/init sous la forme :
 *   { f: 'school', t: tenantId, s: tenantSlug, sn: schoolName, n: nonce }
 */
function decodeState(state: string): DecodedState | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf-8'),
    ) as { t?: string; s?: string; sn?: string; f?: string };
    if (!decoded.t) return null;
    return {
      tenantId: decoded.t,
      tenantSlug: decoded.s || decoded.t,
      schoolName: decoded.sn || '',
    };
  } catch {
    return null;
  }
}

/**
 * Construit l'URL de redirection vers /login avec les query params.
 * En cas d'erreur, on passe `google_error` à la place de `otp_pending`.
 *
 * On fait une URL relative (juste `/login?...`) : le navigateur résoudra
 * contre l'origine courant (academiahelm.com). Vercel peut 307-redirect vers
 * www.academiahelm.com — les cookies Domain=.academiahelm.com suivront.
 *
 * On ajoute `portal=school` pour que la LoginPage affiche directement le
 * modal OTP (la condition de rendu est `portalType === 'school'`).
 */
function buildLoginRedirectUrl(params: {
  otpPending?: boolean;
  email?: string;
  token?: string;
  tenant?: string;
  error?: string;
}): string {
  const url = new URL('/login', 'http://placeholder');
  if (params.otpPending) {
    url.searchParams.set('otp_pending', '1');
    url.searchParams.set('portal', 'school');
  }
  if (params.email) url.searchParams.set('email', params.email);
  if (params.token) url.searchParams.set('token', params.token);
  if (params.tenant) url.searchParams.set('tenant', params.tenant);
  if (params.error) url.searchParams.set('google_error', params.error);
  // On ne renvoie que path + query (URL relative)
  return `${url.pathname}${url.search}`;
}

// ─── GET handler (chemin principal) ───────────────────────────────────────

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  // ── Paramètres manquants ──
  if (!code || !state) {
    const target = buildLoginRedirectUrl({
      error: "Paramètres Google OAuth manquants. Veuillez réessayer.",
    });
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Vérifier le state CSRF ──
  const cookieState = request.cookies.get('school_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    const target = buildLoginRedirectUrl({
      error:
        "Session Google invalide (state CSRF). Veuillez relancer la connexion Google.",
    });
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Décoder le state ──
  const decoded = decodeState(state);
  if (!decoded) {
    const target = buildLoginRedirectUrl({
      error: "State Google corrompu. Veuillez réessayer.",
      tenant: undefined,
    });
    return NextResponse.redirect(new URL(target, request.url), 302);
  }
  const { tenantId, tenantSlug, schoolName } = decoded;

  // ── Échanger le code Google ──
  const userInfo = await exchangeGoogleCode(code);
  if (!userInfo) {
    const target = buildLoginRedirectUrl({
      error:
        "Échange du code Google échoué. Veuillez réessayer.",
      tenant: tenantSlug,
    });
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Vérifier l'utilisateur côté backend NestJS ──
  const checkResult = await checkSchoolUserExists(userInfo.email, tenantId);
  if (!checkResult.ok) {
    const target = buildLoginRedirectUrl({
      error:
        checkResult.reason ||
        "Votre email Google n'est pas associé à un compte établissement. Contactez votre administration.",
      tenant: tenantSlug,
    });
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Créer la session pending + générer OTP ──
  const { pendingToken, otp } = createSchoolPendingSession({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    tenantId,
    tenantSlug,
    schoolName,
  });

  // ── Envoyer l'OTP par email ──
  const sent = await sendSchoolOtpEmail(
    userInfo.email,
    otp,
    userInfo.name,
    schoolName,
  );
  if (!sent) {
    const target = buildLoginRedirectUrl({
      error:
        "Impossible d'envoyer le code OTP par email. Réessayez plus tard.",
      tenant: tenantSlug,
    });
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Succès : rediriger vers /login avec otp_pending=1 + token ──
  const target = buildLoginRedirectUrl({
    otpPending: true,
    email: userInfo.email,
    token: pendingToken,
    tenant: tenantSlug,
  });
  const res = NextResponse.redirect(new URL(target, request.url), 302);
  // Pose le cookie pending (Domain=.academiahelm.com en prod, SameSite=Lax)
  res.headers.set('Set-Cookie', serializeSchoolPendingCookie(pendingToken));
  // Supprime le cookie state CSRF (utilisé)
  res.cookies.delete('school_oauth_state');
  return res;
}

// ─── POST handler (compatibilité legacy) ──────────────────────────────────

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { code?: string; state?: string };
  if (!body.code || !body.state) {
    return NextResponse.json({ error: 'Code et state requis' }, { status: 400 });
  }

  // Vérifier le state CSRF
  const cookieState = request.cookies.get('school_oauth_state')?.value;
  if (!cookieState || cookieState !== body.state) {
    return NextResponse.json({ error: 'State CSRF invalide' }, { status: 400 });
  }

  // Décoder le state pour récupérer le tenant + schoolName
  const decoded = decodeState(body.state);
  if (!decoded) {
    return NextResponse.json({ error: 'State CSRF corrompu' }, { status: 400 });
  }
  const { tenantId, tenantSlug, schoolName } = decoded;

  // Échanger le code Google
  const userInfo = await exchangeGoogleCode(body.code);
  if (!userInfo) {
    return NextResponse.json(
      { error: "Échange du code Google échoué. Veuillez réessayer." },
      { status: 400 },
    );
  }

  // Vérifier que l'utilisateur existe dans la DB pour ce tenant
  const checkResult = await checkSchoolUserExists(userInfo.email, tenantId);
  if (!checkResult.ok) {
    return NextResponse.json(
      {
        error:
          checkResult.reason ||
          "Votre email Google n'est pas associé à un compte établissement. Contactez votre administration.",
      },
      { status: 403 },
    );
  }

  // Créer la session pending + générer OTP
  const { pendingToken, otp } = createSchoolPendingSession({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    tenantId,
    tenantSlug,
    schoolName,
  });

  // Envoyer l'OTP par email (avec schoolName pour personnalisation)
  const sent = await sendSchoolOtpEmail(userInfo.email, otp, userInfo.name, schoolName);
  if (!sent) {
    return NextResponse.json(
      { error: "Impossible d'envoyer le code OTP par email. Réessayez plus tard." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    pendingToken,
    email: userInfo.email,
    message: 'Code OTP envoyé par email. Vérifiez votre boîte de réception.',
  });
  res.headers.set('Set-Cookie', serializeSchoolPendingCookie(pendingToken));
  res.cookies.delete('school_oauth_state');
  return res;
}
