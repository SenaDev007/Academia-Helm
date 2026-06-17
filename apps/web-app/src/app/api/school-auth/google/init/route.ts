/**
 * POST /api/school-auth/google/init
 *
 * Initialise le flow Google OAuth pour le portail ÉCOLE.
 *
 * Body : { tenantId?: string, tenantSlug?: string, schoolName?: string }
 * Réponse : { authUrl: string }
 *
 * Le state CSRF contient le tenant + schoolName pour personnaliser l'email OTP.
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
    schoolName?: string;
  };

  if (!body.tenantId && !body.tenantSlug) {
    return NextResponse.json(
      { error: 'tenantId ou tenantSlug requis' },
      { status: 400 },
    );
  }

  // State CSRF contenant le tenant + schoolName + marqueur de flow 'school'
  const statePayload = {
    f: 'school',
    t: body.tenantId || body.tenantSlug,
    s: body.tenantSlug || '',
    sn: body.schoolName || '', // schoolName pour personnaliser l'email OTP
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
