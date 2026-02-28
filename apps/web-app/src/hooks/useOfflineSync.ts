/**
 * useOfflineSync Hook
 * 
 * Hook React pour gérer la synchronisation offline
 * - Détection connexion
 * - Comptage actions en attente
 * - Synchronisation manuelle
 * - État de synchronisation
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from './useOffline';
import { offlineSyncService } from '@/lib/offline/offline-sync.service';
import { outboxService } from '@/lib/offline/outbox.service';
import { syncEngine } from '@/lib/offline/sync-engine.service';
import { useAuth } from './useAuth';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingOperationsCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
  error: string | null;
}

/**
 * Hook pour gérer la synchronisation offline
 * 
 * @example
 * ```tsx
 * const { isOnline, pendingOperationsCount, syncNow } = useOfflineSync();
 * 
 * return (
 *   <div>
 *     {!isOnline && (
 *       <Badge>Mode hors connexion ({pendingOperationsCount} actions en attente)</Badge>
 *     )}
 *     <Button onClick={syncNow} disabled={isSyncing}>
 *       Synchroniser maintenant
 *     </Button>
 *   </div>
 * );
 * ```
 */
export function useOfflineSync(): UseOfflineSyncReturn {
  const isOnline = useOffline();
  const { user } = useAuth();
  const [pendingOperationsCount, setPendingOperationsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Récupère le nombre d'opérations en attente (en ligne ou hors ligne)
   */
  const updatePendingCount = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const pendingEvents = await outboxService.getPendingEvents(user.tenantId);
      setPendingOperationsCount(pendingEvents.length);
    } catch (err: any) {
      console.error('[useOfflineSync] Error fetching pending operations:', err);
      setPendingOperationsCount(0);
    }
  }, [user?.tenantId]);

  /**
   * Synchronise les opérations en attente
   */
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) {
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      // Dispatch événement sync-start
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-start'));
      }

      await offlineSyncService.sync();

      // Mettre à jour le timestamp
      setLastSyncAt(new Date());

      // Mettre à jour le compteur
      await updatePendingCount();

      // Dispatch événement sync-end
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-end', { detail: { success: true } }));
      }
    } catch (err: any) {
      console.error('[useOfflineSync] Sync error:', err);
      setError(err.message || 'Erreur lors de la synchronisation');

      // Dispatch événement sync-end avec erreur
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-end', { detail: { success: false, error: err } }));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, updatePendingCount]);

  // Charger dernière sync depuis sync_state (Historique UX)
  useEffect(() => {
    if (!user?.tenantId) return;
    syncEngine.getSyncState(user.tenantId).then((state) => {
      if (state.lastSyncAt) setLastSyncAt(new Date(state.lastSyncAt));
    });
  }, [user?.tenantId]);

  // Mettre à jour le compteur périodiquement
  useEffect(() => {
    updatePendingCount();

    // Mettre à jour toutes les 10 secondes si offline
    if (!isOnline) {
      const interval = setInterval(updatePendingCount, 10000);
      return () => clearInterval(interval);
    }

    // Mettre à jour immédiatement après sync
    const handleSyncEnd = () => {
      updatePendingCount();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-end', handleSyncEnd);
      return () => {
        window.removeEventListener('sync-end', handleSyncEnd);
      };
    }
  }, [isOnline, updatePendingCount]);

  // Sync automatique à la reconnexion
  useEffect(() => {
    if (isOnline && pendingOperationsCount > 0 && !isSyncing) {
      // Sync automatique 1 seconde après reconnexion
      const timeout = setTimeout(() => {
        syncNow();
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [isOnline, pendingOperationsCount, isSyncing, syncNow]);

  return {
    isOnline,
    pendingOperationsCount,
    isSyncing,
    lastSyncAt,
    syncNow,
    error,
  };
}
