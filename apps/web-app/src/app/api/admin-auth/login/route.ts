/**
 * POST /api/admin-auth/login
 *
 * Login email/password direct (sans OTP/2FA).
 * Vérifie email + password, pose le cookie academia_admin_session directement.
 *
 * Body : { email: string, password: string }
 * Réponse : { success: true } + cookie academia_admin_session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSessionFromGoogle,
  isEmailAdminWhitelisted,
  isPasswordAuthEnabled,
  serializeAdminSessionCookie,
  verifyAdminPassword,
} from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Vérifier la whitelist admin
  if (!isEmailAdminWhitelisted(email)) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
  }

  // Vérifier que l'auth password est activée
  if (!isPasswordAuthEnabled()) {
    return NextResponse.json(
      { error: "L'authentification par mot de passe est désactivée. Utilisez Google Sign-In." },
      { status: 503 },
    );
  }

  // Vérifier le mot de passe
  const valid = await verifyAdminPassword(email, body.password);
  if (!valid) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
  }

  // Connexion directe — créer la session admin sans OTP
  const session = createAdminSessionFromGoogle({
    id: `admin-${email}`,
    email,
    name: email.split('@')[0],
  });

  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', serializeAdminSessionCookie(session));
  return res;
}
