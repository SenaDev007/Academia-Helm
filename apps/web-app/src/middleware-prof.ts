/**
 * Middleware Helm Enseignant — Protection des routes /prof/*
 *
 * Portail du mini-SaaS enseignant autonome :
 *   - Routes marketing (publiques) : landing /prof, /prof/login, /prof/register
 *   - Routes connectées (session obligatoire + portalType TEACHER) :
 *     /prof/dashboard, /prof/pedagogie, /prof/travaux, /prof/examens,
 *     /prof/planification, /prof/parametres, /prof/eleves
 *
 * La session est le même cookie academia_session que le reste de Helm
 * (pattern patronat) — l'isolation du portail vient du préfixe /prof et de
 * la vérification du portalType.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'academia_session';

/**
 * Headers anti-cache Cloudflare — indispensable pour le streaming Next.js.
 */
function withAntiCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Accel-Buffering', 'no');
  return response;
}

interface ProfSessionUser {
  id: string;
  role?: string;
  tenantId?: string;
  teacherId?: string;
  portalType?: string;
}

function getProfUserFromCookie(request: NextRequest): ProfSessionUser | null {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const session = JSON.parse(sessionCookie) as {
      user?: { id?: string; role?: string; tenantId?: string; teacherId?: string; portal?: string };
      portalType?: string;
      expiresAt?: string;
    };
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null;
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      role: session.user.role,
      tenantId: session.user.tenantId,
      teacherId: session.user.teacherId,
      portalType: session.portalType || session.user.portal,
    };
  } catch {
    return null;
  }
}

// ── Routes marketing (publiques) ─────────────────────────────────────
const marketingExactRoutes = new Set(['/prof']);

const marketingPrefixRoutes = ['/prof/login', '/prof/register'];

// ── Routes connectées (session + portalType TEACHER) ─────────────────
const protectedPrefixRoutes = [
  '/prof/dashboard',
  '/prof/pedagogie',
  '/prof/travaux',
  '/prof/examens',
  '/prof/planification',
  '/prof/parametres',
  '/prof/eleves',
  '/prof/emploi-du-temps',
];

export async function profMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Landing (correspondance exacte) et pages marketing publiques
  if (
    marketingExactRoutes.has(pathname) ||
    marketingPrefixRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return withAntiCacheHeaders(NextResponse.next());
  }

  // 2. Routes protégées : session obligatoire + portalType TEACHER
  if (protectedPrefixRoutes.some((route) => pathname.startsWith(route))) {
    const user = getProfUserFromCookie(request);
    if (!user) {
      const loginUrl = new URL('/prof/login', request.nextUrl.origin);
      loginUrl.searchParams.set('redirect', pathname);
      return withAntiCacheHeaders(NextResponse.redirect(loginUrl));
    }

    // ⭐ Le portail prof n'accepte que les sessions enseignant (le backend
    //    garantit de son côté que le tenant est bien type TEACHER).
    const portal = (user.portalType || '').toUpperCase();
    const role = (user.role || '').toUpperCase();
    const isTeacherPortal =
      portal === 'TEACHER' ||
      ['TEACHER', 'ENSEIGNANT', 'PROFESSEUR', 'INSTITUTEUR'].includes(role);

    if (!isTeacherPortal) {
      const loginUrl = new URL('/prof/login', request.nextUrl.origin);
      loginUrl.searchParams.set('error', 'portal');
      return withAntiCacheHeaders(NextResponse.redirect(loginUrl));
    }

    const response = withAntiCacheHeaders(NextResponse.next({ request: { headers: request.headers } }));
    if (user.id) response.headers.set('X-User-ID', user.id);
    if (user.tenantId) response.headers.set('X-Tenant-ID', user.tenantId);
    if (user.teacherId) response.headers.set('X-Teacher-ID', user.teacherId);
    return response;
  }

  return withAntiCacheHeaders(NextResponse.next());
}
