/**
 * ============================================================================
 * GET/POST /api/admin-auth/google/callback
 * ============================================================================
 *
 * Flow ADMIN — Back-office Academia Helm
 *
 * ─── GET (chemin principal, server-side callback) ───────────────────────────
 *
 * Google redirige ici après consentement :
 *     https://admin.academiahelm.com/api/admin-auth/google/callback?code=...&state=...
 *
 * La route GET fait TOUT côté serveur :
 *   1. Vérifie le state CSRF (vs cookie admin_oauth_state)
 *   2. Échange le code Google contre un id_token (exchangeGoogleCode)
 *   3. Vérifie l'email dans la whitelist admin (isEmailAdminWhitelisted)
 *   4. Crée la session admin directement (PAS d'OTP pour admin — connexion directe)
 *   5. Pose le cookie `academia_admin_session` (Domain=.academiahelm.com)
 *   6. Redirige (302) vers `/admin` (ou ?redirect=... si fourni)
 *
 * Le navigateur suit naturellement la redirection 302 — aucun fetch côté
 * client, pas de risque de collision JSON/HTML, et les cookies posés avec
 * Domain=.academiahelm.com survivent aux éventuelles 307 Vercel.
 *
 * En cas d'erreur, on redirige vers `/admin-login?google_error=<msg>` pour
 * que la AdminLoginPage puisse afficher le message.
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
  createAdminSessionFromGoogle,
  exchangeGoogleCode,
  isEmailAdminWhitelisted,
  serializeAdminSessionCookie,
} from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── GET handler (chemin principal) ───────────────────────────────────────

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  // ── Paramètres manquants ──
  if (!code || !state) {
    const target = `/admin-login?google_error=${encodeURIComponent(
      'Paramètres Google OAuth manquants. Veuillez réessayer.',
    )}`;
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Vérifier le state CSRF ──
  const cookieState = request.cookies.get('admin_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    const target = `/admin-login?google_error=${encodeURIComponent(
      'Session Google invalide (state CSRF). Veuillez relancer la connexion Google.',
    )}`;
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Échanger le code Google ──
  const userInfo = await exchangeGoogleCode(code);
  if (!userInfo) {
    const target = `/admin-login?google_error=${encodeURIComponent(
      'Échange du code Google échoué. Veuillez réessayer.',
    )}`;
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Vérifier la whitelist admin ──
  if (!isEmailAdminWhitelisted(userInfo.email)) {
    const target = `/admin-login?google_error=${encodeURIComponent(
      "Votre email n'est pas autorisé à accéder au back-office Academia Helm. Contactez l'administrateur technique.",
    )}`;
    return NextResponse.redirect(new URL(target, request.url), 302);
  }

  // ── Connexion directe — créer la session admin sans OTP ──
  const session = createAdminSessionFromGoogle({
    id: `admin-${userInfo.email}`,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  });

  // ── Succès : rediriger vers /admin ──
  // On préserve le paramètre ?redirect=... s'il a été passé par le frontend
  // au moment de l'init (stocké dans le state admin — mais ici on simplifie :
  // on va directement à /admin).
  const target = '/admin';
  const res = NextResponse.redirect(new URL(target, request.url), 302);
  // Pose le cookie de session admin (Domain=.academiahelm.com en prod, SameSite=Lax)
  res.headers.set('Set-Cookie', serializeAdminSessionCookie(session));
  // Supprime le cookie state CSRF (utilisé)
  res.cookies.delete('admin_oauth_state');
  return res;
}

// ─── POST handler (compatibilité legacy) ──────────────────────────────────

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { code?: string; state?: string };
  if (!body.code || !body.state) {
    return NextResponse.json({ error: 'Code et state requis' }, { status: 400 });
  }

  // Vérifier le state CSRF
  const cookieState = request.cookies.get('admin_oauth_state')?.value;
  if (!cookieState || cookieState !== body.state) {
    return NextResponse.json({ error: 'State CSRF invalide' }, { status: 400 });
  }

  // Échanger le code
  const userInfo = await exchangeGoogleCode(body.code);
  if (!userInfo) {
    return NextResponse.json(
      { error: "Échange du code Google échoué. Veuillez réessayer." },
      { status: 400 },
    );
  }

  // Vérifier la whitelist admin
  if (!isEmailAdminWhitelisted(userInfo.email)) {
    return NextResponse.json(
      {
        error:
          "Votre email n'est pas autorisé à accéder au back-office Academia Helm. Contactez l'administrateur technique.",
      },
      { status: 403 },
    );
  }

  // Connexion directe — créer la session admin sans OTP
  const session = createAdminSessionFromGoogle({
    id: `admin-${userInfo.email}`,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  });

  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', serializeAdminSessionCookie(session));
  res.cookies.delete('admin_oauth_state');
  return res;
}
