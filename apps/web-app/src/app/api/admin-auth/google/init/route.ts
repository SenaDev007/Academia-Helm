/**
 * POST /api/admin-auth/google/init
 *
 * Initialise le flow Google OAuth : génère un state CSRF et renvoie l'URL
 * d'authentification Google vers laquelle rediriger l'utilisateur.
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { buildGoogleAuthUrl, isGoogleConfigured } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      {
        error:
          "L'authentification Google n'est pas configurée. Contactez l'administrateur technique.",
      },
      { status: 503 },
    );
  }

  // State CSRF — cookie court (10 min) pour vérifier au callback.
  const state = crypto.randomUUID();
  const url = buildGoogleAuthUrl(state);

  const res = NextResponse.json({ authUrl: url });
  // Le cookie doit persister across www et non-www car Vercel redirige
  // admin.academiahelm.com peut aussi être affecté.
  const cookieDomain = process.env.NODE_ENV === 'production' ? '.academiahelm.com' : undefined;
  res.cookies.set('admin_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  return res;
}
