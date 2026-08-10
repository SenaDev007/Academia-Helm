'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { getQueryClient } from '@/lib/query/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => getQueryClient());

  // ⭐ Écouter l'event 'session-resumed' pour invalider toutes les queries
  //    après un déverrouillage ou un retour d'inactivité.
  //    Sans ça, les données sont stale (anciennes) et l'utilisateur doit
  //    manuellement rafraîchir la page.
  useEffect(() => {
    const handleSessionResumed = () => {
      console.log('[QueryProvider] Session resumed — invalidating all queries (sauf academic-years)');
      // ⭐ Exclure 'academic-years' de l'invalidation pour éviter que le
      //    AcademicYearContext perde l'année scolaire sur une connexion instable.
      //    L'année scolaire est stable — elle ne change pas pendant une session.
      client.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key) || key.length === 0) return true;
          const firstKey = String(key[0]);
          if (firstKey === 'academic-years') return false; // Préserver
          return true;
        },
      });
    };

    // ⭐ Écouter aussi l'event 'sync-end' pour rafraîchir après une sync
    const handleSyncEnd = () => {
      console.log('[QueryProvider] Sync ended — invalidating all queries (sauf academic-years)');
      // ⭐ Même exclusion pour sync-end
      client.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key) || key.length === 0) return true;
          const firstKey = String(key[0]);
          if (firstKey === 'academic-years') return false; // Préserver
          return true;
        },
      });
    };

    window.addEventListener('session-resumed', handleSessionResumed);
    window.addEventListener('sync-end', handleSyncEnd);

    return () => {
      window.removeEventListener('session-resumed', handleSessionResumed);
      window.removeEventListener('sync-end', handleSyncEnd);
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
