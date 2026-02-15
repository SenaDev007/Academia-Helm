/**
 * Middleware Patronat - Protection des routes
 *
 * Vérifie l'authentification (cookies API) et les permissions
 * pour les routes /patronat/* (sauf marketing).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessRoute } from '@/lib/patronat/permissions';
import type { PatronatRole } from '@/lib/patronat/permissions';

const SESSION_COOKIE = 'academia_session';

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

// Routes marketing (publiques)
const marketingRoutes = [
  '/patronat-examens',
  '/patronat/register',
  '/patronat/login',
  '/patronat/checkout',
];

// Routes protégées
const protectedRoutes = [
  '/patronat/dashboard',
  '/patronat/schools',
  '/patronat/exams',
  '/patronat/candidates',
  '/patronat/centers',
  '/patronat/documents',
  '/patronat/question-bank',
  '/patronat/reports',
  '/patronat/orion',
  '/patronat/settings',
];

export async function patronatMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (marketingRoutes.some(route => pathname.startsWith(route) || pathname === route)) {
    return NextResponse.next();
  }

  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const user = getPatronatUserFromCookie(request);
    if (!user) {
      const loginUrl = new URL('/patronat/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Rôle : depuis la session ou défaut PATRONAT_ADMIN (TODO: DB patronat_users)
    const userRole: PatronatRole = (user.role as PatronatRole) || 'PATRONAT_ADMIN';

    if (!canAccessRoute(userRole, pathname)) {
      return NextResponse.json(
        { error: 'Accès refusé. Permissions insuffisantes.' },
        { status: 403 }
      );
    }

    const response = NextResponse.next({ request: { headers: request.headers } });
    response.headers.set('X-User-ID', user.id);
    response.headers.set('X-User-Role', userRole);
    return response;
  }

  return NextResponse.next();
}

