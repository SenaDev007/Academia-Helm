/**
 * POST /api/admin-auth/google/callback
 *
 * Échange le code Google, vérifie la whitelist admin,
 * pose le cookie academia_admin_session directement (sans OTP/2FA).
 *
 * Body : { code: string, state: string }
 * Réponse : { success: true } + cookie academia_admin_session
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
