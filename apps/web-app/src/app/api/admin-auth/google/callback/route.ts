/**
 * POST /api/admin-auth/google/callback
 *
 * Échange le code Google contre les infos utilisateur, vérifie la whitelist
 * admin, puis envoie un OTP par email et crée une session pending.
 *
 * Body : { code: string, state: string }
 * Réponse : { pendingToken: string, email: string } — l'utilisateur doit
 *           ensuite appeler /verify-otp avec le code reçu par email.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPendingSession,
  exchangeGoogleCode,
  isEmailAdminWhitelisted,
  sendOtpEmail,
  serializeAdminPendingCookie,
} from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  // Créer la session pending + générer l'OTP
  const { pendingToken, otp } = createPendingSession({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  });

  // Envoyer l'OTP par email
  const sent = await sendOtpEmail(userInfo.email, otp, userInfo.name);
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
  res.headers.set('Set-Cookie', serializeAdminPendingCookie(pendingToken));
  res.cookies.delete('admin_oauth_state');
  return res;
}
