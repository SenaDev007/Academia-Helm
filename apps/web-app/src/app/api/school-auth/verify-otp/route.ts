/**
 * POST /api/school-auth/verify-otp
 *
 * Vérifie l'OTP et crée une session SCHOOL définitive (cookie academia_session).
 *
 * Body : { pendingToken: string, otp: string }
 * Réponse : { user, tenant, accessToken, expiresAt } + cookie session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifySchoolOtp,
  createSchoolSessionViaGoogle,
  clearSchoolPendingCookie,
} from '@/lib/auth/school-google-auth-server';
import { setServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { pendingToken?: string; otp?: string };
  if (!body.pendingToken || !body.otp) {
    return NextResponse.json(
      { error: 'pendingToken et otp requis' },
      { status: 400 },
    );
  }

  // Vérifier l'OTP
  const result = verifySchoolOtp(body.pendingToken, body.otp.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  // Créer la session via NestJS (endpoint google-login)
  const sessionResult = await createSchoolSessionViaGoogle({
    email: result.pending.email,
    tenantId: result.pending.tenantId,
  });

  if (!sessionResult.ok) {
    return NextResponse.json(
      { error: sessionResult.reason },
      { status: 500 },
    );
  }

  // Construire la session côté Next.js (compatible avec le système existant)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const session = {
    user: {
      id: sessionResult.user.id,
      email: sessionResult.user.email,
      firstName: sessionResult.user.firstName || '',
      lastName: sessionResult.user.lastName || '',
      role: sessionResult.user.role || 'SCHOOL_USER',
      portal: 'SCHOOL',
      tenantId: sessionResult.tenant.id,
      isPlatformOwner: false,
      permissions: [],
      createdAt: new Date().toISOString(),
    },
    tenant: {
      id: sessionResult.tenant.id,
      name: sessionResult.tenant.name,
      slug: sessionResult.tenant.slug,
      subdomain: sessionResult.tenant.subdomain || sessionResult.tenant.slug,
      status: 'active' as const,
      subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    token: sessionResult.accessToken,
    expiresAt,
  };

  await setServerSession(session);

  const res = NextResponse.json({
    success: true,
    user: session.user,
    tenant: session.tenant,
    accessToken: sessionResult.accessToken,
    refreshToken: sessionResult.refreshToken,
    serverSessionId: sessionResult.serverSessionId,
    expiresAt,
    message: 'Authentification réussie.',
  });
  res.headers.append('Set-Cookie', clearSchoolPendingCookie());
  return res;
}
