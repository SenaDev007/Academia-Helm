/**
 * POST /api/school-auth/google/callback
 *
 * Échange le code Google, vérifie l'utilisateur côté backend, envoie OTP.
 *
 * Body : { code: string, state: string }
 * Réponse : { pendingToken: string, email: string, message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkSchoolUserExists,
  createSchoolPendingSession,
  exchangeGoogleCode,
  serializeSchoolPendingCookie,
  sendSchoolOtpEmail,
} from '@/lib/auth/school-google-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { code?: string; state?: string };
  if (!body.code || !body.state) {
    return NextResponse.json({ error: 'Code et state requis' }, { status: 400 });
  }

  // Vérifier le state CSRF
  const cookieState = request.cookies.get('school_oauth_state')?.value;
  if (!cookieState || cookieState !== body.state) {
    return NextResponse.json({ error: 'State CSRF invalide' }, { status: 400 });
  }

  // Décoder le state pour récupérer le tenant
  let tenantId: string;
  let tenantSlug: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(body.state, 'base64url').toString('utf-8'),
    ) as { t: string; s: string };
    tenantId = decoded.t;
    tenantSlug = decoded.s || decoded.t;
  } catch {
    return NextResponse.json({ error: 'State CSRF corrompu' }, { status: 400 });
  }

  // Échanger le code Google
  const userInfo = await exchangeGoogleCode(body.code);
  if (!userInfo) {
    return NextResponse.json(
      { error: "Échange du code Google échoué. Veuillez réessayer." },
      { status: 400 },
    );
  }

  // Vérifier que l'utilisateur existe dans la DB pour ce tenant
  const checkResult = await checkSchoolUserExists(userInfo.email, tenantId);
  if (!checkResult.ok) {
    return NextResponse.json(
      {
        error:
          checkResult.reason ||
          "Votre email Google n'est pas associé à un compte établissement. Contactez votre administration.",
      },
      { status: 403 },
    );
  }

  // Créer la session pending + générer OTP
  const { pendingToken, otp } = createSchoolPendingSession({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    tenantId,
    tenantSlug,
  });

  // Envoyer l'OTP par email
  const sent = await sendSchoolOtpEmail(userInfo.email, otp, userInfo.name);
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
  res.headers.set('Set-Cookie', serializeSchoolPendingCookie(pendingToken));
  res.cookies.delete('school_oauth_state');
  return res;
}
