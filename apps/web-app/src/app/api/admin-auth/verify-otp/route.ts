/**
 * POST /api/admin-auth/verify-otp
 *
 * Deuxième étape : vérifie le code OTP, crée la session admin définitive
 * et pose le cookie `academia_admin_session`.
 *
 * Body : { pendingToken: string, otp: string }
 * Réponse : { user: AdminUser, expiresAt: string } + cookie session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSessionFromGoogle,
  serializeAdminSessionCookie,
  verifyOtp,
  clearAdminPendingCookie,
} from '@/lib/admin/admin-auth-server';

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
  const result = verifyOtp(body.pendingToken, body.otp.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  // Créer la session admin (firstName/lastName extraits automatiquement de name)
  const session = createAdminSessionFromGoogle({
    id: `admin-${result.pending.email}`,
    email: result.pending.email,
    name: result.pending.name,
    picture: result.pending.picture,
  });

  const res = NextResponse.json({
    user: session.user,
    expiresAt: session.expiresAt,
    message: 'Authentification réussie.',
  });
  // Pose le cookie de session + supprime le cookie pending
  res.headers.append('Set-Cookie', serializeAdminSessionCookie(session));
  res.headers.append('Set-Cookie', clearAdminPendingCookie());
  return res;
}
