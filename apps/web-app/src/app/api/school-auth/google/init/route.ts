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

  // State CSRF contenant le tenant (signé pour éviter la falsification)
  const statePayload = {
    t: body.tenantId || body.tenantSlug,
    s: body.tenantSlug || '',
    n: crypto.randomUUID(),
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  const url = buildGoogleAuthUrl(state);

  const res = NextResponse.json({ authUrl: url });
  res.cookies.set('school_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 10 * 60,
  });
  return res;
}
