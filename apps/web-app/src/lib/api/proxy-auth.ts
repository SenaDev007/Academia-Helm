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

/**
 * Récupère le token JWT et le tenant pour les appels au backend.
 * Priorité : header Authorization > cookie academia_token (via next/headers) > getServerToken() > session.token.
 */
export async function getProxyAuthHeaders(request: NextRequest): Promise<ProxyAuthHeaders> {
  const authHeader = request.headers.get('Authorization');
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(TOKEN_COOKIE)?.value?.trim();
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

  const tenantId =
    session?.tenant?.id ??
    request.headers.get('x-tenant-id') ??
    request.nextUrl?.searchParams?.get('tenant_id');
  if (tenantId && typeof tenantId === 'string') {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
}
