/**
 * Headers d'authentification pour les routes API proxy (Next.js → backend).
 * Utilise cookies() de next/headers pour lire le token de façon fiable dans l'App Router.
 */
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getServerToken, getServerSession } from '@/lib/auth/session';

const TOKEN_COOKIE = 'academia_token';

export type ProxyAuthHeaders = Record<string, string> & {
  Authorization?: string;
  'x-tenant-id'?: string;
};

/** Extrait le token depuis l'en-tête Cookie brut (fallback si cookies() ne le renvoie pas). */
function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Récupère le token JWT et le tenant pour les appels au backend.
 * Priorité : header Authorization > request.cookies (Route Handler) > next/headers cookies > Cookie header brut > getServerToken() > session.token.
 */
export async function getProxyAuthHeaders(request: NextRequest): Promise<ProxyAuthHeaders> {
  const authHeader = request.headers.get('Authorization');
  const requestCookieToken = request.cookies.get(TOKEN_COOKIE)?.value?.trim();
  const cookieStore = await cookies();
  const cookieToken = requestCookieToken
    ?? cookieStore.get(TOKEN_COOKIE)?.value?.trim()
    ?? getTokenFromCookieHeader(request.headers.get('cookie'));
  const sessionToken = await getServerToken();
  const session = await getServerSession();
  const sessionTokenAlt = session?.token?.trim();

  const rawToken =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) ||
    cookieToken ||
    sessionToken ||
    sessionTokenAlt ||
    '';

  const token = rawToken ? `Bearer ${rawToken}` : '';

  const headers: ProxyAuthHeaders = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = token;
  }
  // Transmettre le cookie au backend pour que l'API puisse extraire le JWT (fallback si Authorization manquant)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  const tenantId =
    session?.tenant?.id ??
    request.headers.get('x-tenant-id') ??
    request.nextUrl?.searchParams?.get('tenant_id');
  if (tenantId && typeof tenantId === 'string') {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
}
