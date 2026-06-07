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
