'use client';

/**
 * usePlatformData — Hook générique pour récupérer les données réelles
 * du back-office Academia Helm via les endpoints /api/platform/*.
 *
 * Utilisé par tous les workspaces /app/platform/* pour remplacer les
 * anciennes constantes MOCK_*. Aucune donnée mock n'est plus affichée.
 *
 * Exemple d'usage :
 *   const { data, loading, error, refetch } = usePlatformData<{ tenants: Tenant[] }>('/tenants');
 */

import { useState, useEffect, useCallback } from 'react';

interface UsePlatformDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePlatformData<T = any>(path: string): UsePlatformDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const refetch = useCallback(() => {
    setReloadCounter((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = path.startsWith('/api/')
      ? path
      : `/api/platform${path.startsWith('/') ? '' : '/'}${path}`;

    fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error || body?.message || `Erreur ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Erreur de chargement');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloadCounter]);

  return { data, loading, error, refetch };
}
