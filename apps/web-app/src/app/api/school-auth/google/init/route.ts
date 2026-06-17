/**
 * POST /api/school-auth/google/init
 *
 * Initialise le flow Google OAuth pour le portail ÉCOLE.
 *
 * Body : { tenantId?: string, tenantSlug?: string }
 * Réponse : { authUrl: string }
 *
 * Le state CSRF contient le tenant pour qu'au callback on sache pour quel
 * établissement l'utilisateur tente de se connecter.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl, isGoogleConfigured } from '@/lib/auth/school-google-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      {
        error:
          "L'authentification Google n'est pas configurée pour le portail école.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    tenantSlug?: string;
  };

  if (!body.tenantId && !body.tenantSlug) {
    return NextResponse.json(
      { error: 'tenantId ou tenantSlug requis' },
      { status: 400 },
    );
  }

  // State CSRF contenant le tenant + marqueur de flow 'school'
  // Le marqueur 'f: school' permet à la page /admin-login (qui reçoit le
  // callback Google) de distinguer le flow school du flow admin et de
  // router vers /api/school-auth/google/callback au lieu de /api/admin-auth/google/callback.
  const statePayload = {
    f: 'school', // flow marker — 'school' ou absent (admin)
    t: body.tenantId || body.tenantSlug,
    s: body.tenantSlug || '',
    n: crypto.randomUUID(),
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  const url = buildGoogleAuthUrl(state);

  const res = NextResponse.json({ authUrl: url });
  // Cookie dédié au flow school (distinct du cookie admin_oauth_state)
  // ⚠️ domain=.academiahelm.com pour qu'il soit accessible depuis
  // admin.academiahelm.com (où Google redirige le callback).
  // Sans cela, le cookie posé sur academiahelm.com ne serait pas envoyé
  // vers admin.academiahelm.com → "State CSRF invalide".
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'academiahelm.com';
  const cookieDomain = baseDomain.includes('localhost') ? undefined : `.${baseDomain}`;
  res.cookies.set('school_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 10 * 60,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  return res;
}
