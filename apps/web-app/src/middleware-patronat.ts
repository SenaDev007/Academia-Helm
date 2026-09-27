/**
 * Middleware Patronat - Protection des routes Academia Federis
 *
 * Vérifie l'authentification (cookies API) et les permissions
 * pour les routes /patronat/* et /federis/*.
 *
 * Le middleware principal réécrit le sous-domaine academiafederis.academiahelm.com
 * vers /federis/* AVANT de déléguer ici — les deux préfixes sont donc protégés.
 *
 * Routes marketing (publiques) : landing /, /login, /register, /checkout.
 * Routes connectées : dashboard, patronats (national), schools, exams,
 * candidates, centers, documents, question-bank, deliberations, reports,
 * orion, conflicts, settings, bureau.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessRoute } from '@/lib/patronat/permissions';
import type { PatronatRole } from '@/lib/patronat/permissions';

const SESSION_COOKIE = 'academia_session';

/**
 * Ajoute les headers anti-cache Cloudflare à une réponse.
 * Empêche le buffering et la mise en cache des réponses HTML,
 * ce qui est essentiel pour le streaming Next.js / Suspense (loading.tsx).
 */
function withAntiCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Accel-Buffering', 'no');
  return response;
}

function getPatronatUserFromCookie(request: NextRequest): { id: string; role?: string } | null {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const session = JSON.parse(sessionCookie) as { user?: { id?: string; role?: string }; expiresAt?: string };
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null;
    if (session?.user?.id) return { id: session.user.id, role: session.user.role };
    return null;
  } catch {
    return null;
  }
}

// ── Routes marketing (publiques) ─────────────────────────────────────
// ⚠️ Le préfixe '/federis' est la landing page : correspondance EXACTE
//    (sinon il avalerait toutes les sous-routes protégées ci-dessous).
// Note : sur le sous-domaine academiafederis, le middleware principal
// réécrit et RETOURNE avant ce middleware — la protection y est assurée
// par les pages elles-mêmes (getServerSession + redirect).
const marketingExactRoutes = new Set([
  '/federis',
]);

const marketingPrefixRoutes = [
  '/federis/login',
  '/federis/register',
  '/federis/checkout',
  '/patronat/register',
  '/patronat/login',
  '/patronat/checkout',
];

// ── Routes protégées (session + rôle) ───────────────────────────────
const protectedPrefixRoutes = [
  // Sous-domaine academiafederis (réécrit vers /federis/*)
  '/federis/dashboard',
  '/federis/patronats',
  '/federis/schools',
  '/federis/bureau',
  '/federis/exams',
  '/federis/candidates',
  '/federis/centers',
  '/federis/documents',
  '/federis/question-bank',
  '/federis/deliberations',
  '/federis/reports',
  '/federis/orion',
  '/federis/conflicts',
  '/federis/settings',
  // Domaine principal (chemins historiques /patronat/*)
  '/patronat/dashboard',
  '/patronat/patronats',
  '/patronat/schools',
  '/patronat/bureau',
  '/patronat/exams',
  '/patronat/candidates',
  '/patronat/centers',
  '/patronat/documents',
  '/patronat/question-bank',
  '/patronat/deliberations',
  '/patronat/reports',
  '/patronat/orion',
  '/patronat/conflicts',
  '/patronat/settings',
];

export async function patronatMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Landing page (correspondance exacte uniquement) et pages marketing
  if (
    marketingExactRoutes.has(pathname) ||
    marketingPrefixRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return withAntiCacheHeaders(NextResponse.next());
  }

  // 2. Routes protégées : session obligatoire + contrôle par rôle
  if (protectedPrefixRoutes.some((route) => pathname.startsWith(route))) {
    const user = getPatronatUserFromCookie(request);
    if (!user) {
      const loginUrl = new URL('/federis/login', request.nextUrl.origin);
      loginUrl.searchParams.set('redirect', pathname);
      return withAntiCacheHeaders(NextResponse.redirect(loginUrl));
    }

    // Rôle : depuis la session ou défaut PATRONAT_ADMIN (TODO: DB patronat_users)
    const userRole: PatronatRole = (user.role as PatronatRole) || 'PATRONAT_ADMIN';

    if (!canAccessRoute(userRole, pathname)) {
      return NextResponse.json(
        { error: 'Accès refusé. Permissions insuffisantes.' },
        { status: 403 }
      );
    }

    const response = withAntiCacheHeaders(NextResponse.next({ request: { headers: request.headers } }));
    response.headers.set('X-User-ID', user.id);
    response.headers.set('X-User-Role', userRole);
    return response;
  }

  return withAntiCacheHeaders(NextResponse.next());
}
