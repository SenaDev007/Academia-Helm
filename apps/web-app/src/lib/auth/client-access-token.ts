/**
 * Synchronise JWT + identifiants de session PostgreSQL avec le navigateur.
 * Les cookies httpOnly ne sont pas lisibles en JS : les appels client (pedagogyFetch, sync)
 * utilisent localStorage ; la table `sessions` côté API aligne la vérité serveur.
 */

export type PersistClientSessionInput = {
  accessToken?: string | null;
  refreshToken?: string | null;
  /** Ligne `sessions` (auth web Nest / refresh JWT) */
  serverSessionId?: string | null;
  /** Ligne `portal_sessions` (portail école / enseignant / parent) */
  portalSessionId?: string | null;
  user?: {
    id: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
    [key: string]: unknown;
  };
  tenant?: { id: string; name?: string; slug?: string; [key: string]: unknown } | null;
  expiresAt?: string | null;
};

/**
 * En-tête Authorization pour les fetch client → `/api/*` (proxy Next vers Nest).
 * Les cookies httpOnly ne suffisent pas si la session repose sur localStorage.
 */
export function getClientAuthorizationHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem('accessToken')?.trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Récupère le tenant ID depuis la session locale (localStorage).
 * Utilisé pour envoyer le header X-Tenant-ID explicite dans les fetch client → proxy BFF,
 * garantissant que le backend NestJS peut résoudre le tenant même si les cookies ne sont pas propagés.
 */
export function getClientTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('session')?.trim();
    if (!raw) return null;
    const session = JSON.parse(raw) as { tenantId?: string; tenant?: { id?: string }; user?: { tenantId?: string } };
    return session?.tenantId || session?.tenant?.id || session?.user?.tenantId || null;
  } catch {
    return null;
  }
}

export function persistClientAccessToken(data: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const at = data.accessToken?.trim();
  if (at) localStorage.setItem('accessToken', at);
  const rt = data.refreshToken?.trim();
  if (rt) localStorage.setItem('refreshToken', rt);
}

/**
 * Persiste tokens + miroir `session` (tenantId, ids PostgreSQL) pour sync offline / pas de déphasage.
 */
export function persistClientSession(data: PersistClientSessionInput): void {
  persistClientAccessToken(data);

  if (typeof window === 'undefined') return;

  const sid = data.serverSessionId?.trim();
  if (sid) localStorage.setItem('serverSessionId', sid);
  else localStorage.removeItem('serverSessionId');

  const pid = data.portalSessionId?.trim();
  if (pid) localStorage.setItem('portalSessionId', pid);
  else localStorage.removeItem('portalSessionId');

  const tenantId =
    data.tenant?.id ?? data.user?.tenantId ?? null;
  if (data.user && (tenantId || data.tenant)) {
    localStorage.setItem(
      'session',
      JSON.stringify({
        tenantId,
        userId: data.user.id,
        user: data.user,
        tenant: data.tenant ?? null,
        serverSessionId: sid ?? null,
        portalSessionId: pid ?? null,
        expiresAt: data.expiresAt ?? null,
        syncedAt: new Date().toISOString(),
      }),
    );
  }
}

export function clearClientSessionSync(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('serverSessionId');
  localStorage.removeItem('portalSessionId');
  localStorage.removeItem('session');
}

/**
 * Renouvelle l’access token via le refresh stocké (en ligne uniquement).
 * Utilisé quand le JWT court a expiré mais que l’utilisateur peut rester dans l’app.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const rt = localStorage.getItem('refreshToken')?.trim();
  if (!rt) return false;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken: rt }),
      cache: 'no-store',
    });
    if (!res.ok) return false;

    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken?.trim()) return false;

    localStorage.setItem('accessToken', data.accessToken.trim());
    if (data.refreshToken?.trim()) {
      localStorage.setItem('refreshToken', data.refreshToken.trim());
    }
    return true;
  } catch {
    return false;
  }
}

/** Indique si une session locale permet le mode dégradé (cache / SQLite) sans bootstrap réseau. */
export function hasLocalSessionHints(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem('refreshToken')?.trim() ||
      localStorage.getItem('session')?.trim(),
  );
}

/**
 * Vérifie que la session serveur est disponible via /api/auth/me.
 *
 * Sur mobile (iOS Safari, Chrome Android), les cookies Set-Cookie ne sont
 * pas toujours persistés immédiatement après un fetch(). Un window.location.href
 * effectué trop tôt provoque une page blanche car getServerSession() ne trouve
 * pas le cookie.
 *
 * Cette fonction interroge le BFF proxy pour confirmer que la session est
 * lisible côté serveur avant de procéder à la redirection.
 *
 * @param maxAttempts Nombre maximal de tentatives (défaut 10)
 * @param baseDelay Délai initial entre les tentatives en ms (défaut 200)
 * @returns true si la session est confirmée, false si timeout
 */
export async function waitForServerSession(
  maxAttempts = 10,
  baseDelay = 200,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        // Mobile browsers (iOS Safari, Chrome Android) don't always persist
        // cookies from fetch() immediately. Add a small delay on mobile to
        // ensure the cookie is written to disk before any cross-domain redirect.
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return true;
      }
    } catch {
      // Network error — retry
    }
    // Progressif : 200ms, 300ms, 400ms, 500ms, … (max 1s)
    const delay = Math.min(baseDelay + i * 100, 1000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}
