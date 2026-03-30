/**
 * Headers d'authentification pour les routes API proxy (Next.js → backend).
 * Utilise cookies() de next/headers pour lire le token de façon fiable dans l'App Router.
 */
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getServerToken, getServerSession } from '@/lib/auth/session';

const TOKEN_COOKIE = 'academia_token';
const SESSION_COOKIE = 'academia_session';

export type ProxyAuthHeaders = Record<string, string> & {
  Authorization?: string;
  'x-tenant-id'?: string;
};

/** Retire les espaces et un éventuel double préfixe Bearer. */
function normalizeJwt(raw: string): string {
  let t = raw.trim();
  while (t.toLowerCase().startsWith('bearer ')) {
    t = t.slice(7).trim();
  }
  return t;
}

/** Extrait le token depuis l'en-tête Cookie brut (fallback si cookies() ne le renvoie pas). */
function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return normalizeJwt(decodeURIComponent(match[1].trim()));
  } catch {
    return normalizeJwt(match[1].trim());
  }
}

function parseSessionPayload(jsonStr: string): {
  token: string | null;
  tenantId: string | null;
} {
  try {
    const session = JSON.parse(jsonStr) as {
      token?: string;
      tenant?: { id?: string };
      user?: { tenantId?: string };
    };
    const token = session?.token ? normalizeJwt(session.token) : null;
    const tenantId = session?.tenant?.id ?? session?.user?.tenantId ?? null;
    return { token, tenantId };
  } catch {
    return { token: null, tenantId: null };
  }
}

/**
 * Lit token + tenant depuis academia_session dans le header Cookie brut.
 * Indispensable quand cookies() / getServerSession ne voient pas encore le cookie (App Router) ou si seul le cookie session est présent.
 */
function parseSessionFromCookieHeader(cookieHeader: string | null): {
  token: string | null;
  tenantId: string | null;
} {
  if (!cookieHeader) return { token: null, tenantId: null };
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
  if (!match) return { token: null, tenantId: null };
  try {
    const raw = decodeURIComponent(match[1].trim());
    return parseSessionPayload(raw);
  } catch {
    return { token: null, tenantId: null };
  }
}

/** Reconstruit un en-tête Cookie pour Nest quand `request.headers.get('cookie')` est vide mais `cookies()` contient les httpOnly. */
function buildCookieHeaderFromStore(
  store: Awaited<ReturnType<typeof cookies>>,
): string | null {
  const all = store.getAll();
  if (!all.length) return null;
  return all
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');
}

function bearerFromAuthorizationHeader(authHeader: string | null): string | null {
  if (!authHeader?.trim()) return null;
  const t = normalizeJwt(authHeader);
  return t || null;
}

/**
 * Récupère le token JWT et le tenant pour les appels au backend.
 * Priorité : header Authorization > request.cookies (Route Handler) > next/headers cookies > Cookie header brut > getServerToken() > session.token.
 */
export async function getProxyAuthHeaders(request: NextRequest): Promise<ProxyAuthHeaders> {
  const rawCookieHeader = request.headers.get('cookie');
  const cookieStore = await cookies();
  let parsedSession = parseSessionFromCookieHeader(rawCookieHeader);
  const sessionCookieVal = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionCookieVal) {
    const fromStore = parseSessionPayload(sessionCookieVal);
    parsedSession = {
      token: parsedSession.token ?? fromStore.token,
      tenantId: parsedSession.tenantId ?? fromStore.tenantId,
    };
  }

  const authHeader = request.headers.get('Authorization');
  const requestCookieToken = request.cookies.get(TOKEN_COOKIE)?.value?.trim();
  const cookieToken = normalizeJwt(
    requestCookieToken ??
      cookieStore.get(TOKEN_COOKIE)?.value?.trim() ??
      getTokenFromCookieHeader(rawCookieHeader) ??
      '',
  );
  const sessionToken = await getServerToken();
  const session = await getServerSession();
  const sessionTokenAlt = session?.token ? normalizeJwt(session.token) : '';

  const rawToken =
    bearerFromAuthorizationHeader(authHeader) ||
    (cookieToken || null) ||
    (sessionToken ? normalizeJwt(sessionToken) : null) ||
    (sessionTokenAlt || null) ||
    parsedSession.token ||
    '';

  const token = rawToken ? `Bearer ${rawToken}` : '';

  const headers: ProxyAuthHeaders = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = token;
  }
  // Transmettre le cookie au backend pour que l'API puisse extraire le JWT (fallback si Authorization manquant)
  if (rawCookieHeader) {
    headers['Cookie'] = rawCookieHeader;
  } else {
    const synthetic = buildCookieHeaderFromStore(cookieStore);
    if (synthetic) {
      headers['Cookie'] = synthetic;
    }
  }

  const tidFromSessionObj = session?.tenant?.id;
  const tidFromUser =
    typeof session?.user?.tenantId === 'string' && session.user.tenantId.trim()
      ? session.user.tenantId.trim()
      : undefined;
  const tenantId =
    (tidFromSessionObj && String(tidFromSessionObj).trim()) ||
    tidFromUser ||
    parsedSession.tenantId ||
    request.headers.get('x-tenant-id') ||
    request.nextUrl?.searchParams?.get('tenant_id') ||
    undefined;
  if (tenantId && typeof tenantId === 'string' && tenantId.trim()) {
    headers['x-tenant-id'] = tenantId.trim();
  }

  return headers;
}
