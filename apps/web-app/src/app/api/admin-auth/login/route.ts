/**
 * POST /api/admin-auth/login
 *
 * Première étape du login email/password : vérifie email + password, puis
 * envoie un OTP par email.
 *
 * Body : { email: string, password: string }
 * Réponse : { pendingToken: string, email: string, message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPendingSession,
  isEmailAdminWhitelisted,
  isPasswordAuthEnabled,
  sendOtpEmail,
  serializeAdminPendingCookie,
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
    // Sécurité : ne pas révéler si l'email existe ou non — message générique.
    return NextResponse.json(
      { error: 'Identifiants invalides.' },
      { status: 401 },
    );
  }

  // Vérifier que l'auth password est activée
  if (!isPasswordAuthEnabled()) {
    return NextResponse.json(
      {
        error:
          "L'authentification par mot de passe est désactivée. Utilisez Google Sign-In.",
      },
      { status: 503 },
    );
  }

  // Vérifier le mot de passe
  const valid = await verifyAdminPassword(email, body.password);
  if (!valid) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
  }

  // Créer session pending + générer OTP
  const { pendingToken, otp } = createPendingSession({
    email,
    name: email.split('@')[0],
  });

  // Envoyer l'OTP par email
  const sent = await sendOtpEmail(email, otp);
  if (!sent) {
    return NextResponse.json(
      { error: "Impossible d'envoyer le code OTP par email. Réessayez plus tard." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    pendingToken,
    email,
    message: 'Code OTP envoyé par email. Vérifiez votre boîte de réception.',
  });
  res.headers.set('Set-Cookie', serializeAdminPendingCookie(pendingToken));
  return res;
}
