'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { getQueryClient } from '@/lib/query/query-client';
import { networkDetectionService } from '@/lib/offline/network-detection.service';

/**
 * Prédicat partagé d'invalidation « toutes les queries sauf academic-years »
 * (l'année scolaire est stable pendant une session — la préserver évite que
 * l'AcademicYearContext perde l'année courante sur connexion instable).
 */
function invalidateAllExceptAcademicYears(client: ReturnType<typeof getQueryClient>, reason: string) {
  console.log(`[QueryProvider] ${reason} — invalidating all queries (sauf academic-years)`);
  client.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key.length === 0) return true;
      const firstKey = String(key[0]);
      if (firstKey === 'academic-years') return false; // Préserver
      return true;
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => getQueryClient());

  // ⭐ Écouter l'event 'session-resumed' pour invalider toutes les queries
  //    après un déverrouillage ou un retour d'inactivité.
  //    Sans ça, les données sont stale (anciennes) et l'utilisateur doit
  //    manuellement rafraîchir la page.
  useEffect(() => {
    const handleSessionResumed = () => {
      invalidateAllExceptAcademicYears(client, 'Session resumed');
    };

    // ⭐ Écouter aussi l'event 'sync-end' pour rafraîchir après une sync
    const handleSyncEnd = () => {
      invalidateAllExceptAcademicYears(client, 'Sync ended');
    };

    // ⭐ 2026-09-12 — RETOUR DU RÉSEAU : reprise AUTOMATIQUE des données.
    //    Problème terrain : après une coupure, les fetchers qui avalent les
    //    erreurs réseau (ex. fetchJson du dashboard → null) laissent React
    //    Query en état « succès récent » → refetchOnReconnect ne re-fetch PAS
    //    une query fraîche → l'utilisateur devait cliquer « Actualiser ».
    //    Fix : à la TRANSITION offline→online (événement window 'online' OU
    //    networkDetectionService), on invalide toutes les queries actives
    //    après un délai de stabilisation (1,5 s — réseau 2G/3G) et avec un
    //    anti-double déclenchement (cooldown 8 s).
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastReconnectInvalidation = 0;
    const RECONNECT_DEBOUNCE_MS = 1500;
    const RECONNECT_COOLDOWN_MS = 8000;

    const handleNetworkBack = () => {
      const now = Date.now();
      if (now - lastReconnectInvalidation < RECONNECT_COOLDOWN_MS) return; // anti-double
      lastReconnectInvalidation = now;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        invalidateAllExceptAcademicYears(client, 'Network back online');
      }, RECONNECT_DEBOUNCE_MS);
    };

    window.addEventListener('session-resumed', handleSessionResumed);
    window.addEventListener('sync-end', handleSyncEnd);
    window.addEventListener('online', handleNetworkBack);

    // Transition uniquement (prev !== null) — le 1er callback d'état initial
    // ne doit PAS déclencher d'invalidation au simple montage de la page.
    let wasOnline: boolean | null = null;
    const unsubscribeNetwork = networkDetectionService.onNetworkStatusChange((online) => {
      const previous = wasOnline;
      wasOnline = online;
      if (previous !== null && !previous && online) handleNetworkBack();
    });

    return () => {
      window.removeEventListener('session-resumed', handleSessionResumed);
      window.removeEventListener('sync-end', handleSyncEnd);
      window.removeEventListener('online', handleNetworkBack);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      unsubscribeNetwork();
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
