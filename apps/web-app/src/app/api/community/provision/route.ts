import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, bffHeaders } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

/* ══════════════════════════════════════════════════════════════════════
   BFF PROVISION — /api/community/provision (v2 : canaux dynamiques écoles)

   « Rejoindre la communauté » pour un utilisateur DÉJÀ connecté à
   Academia Helm (admin ou enseignant d'une école) :
   - Lit le cookie applicatif httpOnly `academia_token` (session app)
   - Appelle POST /community/auth/link-app côté api-server avec le JWT
     applicatif dans l'en-tête dédié x-app-authorization (jamais exposé
     au navigateur)
   - L'api-server provisionne : membre communauté lié + écoles + groupes
     (salon de chaque école, groupe administrateurs, groupe enseignants
     créés automatiquement à la volée)
   - Pose le cookie httpOnly `community_token` — même politique que
     login/register (zéro token côté JS client)

   Route statique : prend la priorité sur le catch-all /api/community/[...path].
   ══════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

const COMMUNITY_COOKIE = 'community_token';
const APP_COOKIE = 'academia_token';
const COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 jours (aligné sur le JWT communauté)

export async function POST(request: NextRequest) {
  const appToken = request.cookies.get(APP_COOKIE)?.value;
  if (!appToken) {
    return NextResponse.json(
      { message: 'Connectez-vous d\u2019abord à votre compte école, puis rejoignez la communauté en un clic.' },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      nestControllerUrl('community/auth/link-app'),
      {
        method: 'POST',
        headers: bffHeaders({ 'x-app-authorization': `Bearer ${appToken}` }),
      },
      30_000,
    );
  } catch {
    return NextResponse.json(
      { message: 'Service communauté momentanément indisponible — réessayez' },
      { status: 502 },
    );
  }

  let data: any = null;
  const text = await upstream.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text.slice(0, 500) };
  }

  if (!upstream.ok || !data?.token) {
    return NextResponse.json(data, { status: upstream.status });
  }

  // ⭐ Cookie httpOnly — le token communauté ne part JAMAIS côté client
  const response = NextResponse.json(
    {
      member: data.member,
      viaAppLink: true,
      schools: data.schools ?? [],
    },
    { status: 200 },
  );
  response.cookies.set(COMMUNITY_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
