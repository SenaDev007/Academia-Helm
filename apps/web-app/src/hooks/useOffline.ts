/**
 * useOffline Hook
 * 
 * Hook React pour détecter l'état de la connexion réseau
 */

'use client';

import { useState, useEffect } from 'react';
import { networkDetectionService } from '@/lib/offline/network-detection.service';

/**
 * Hook pour détecter si l'application est en ligne
 */
export function useOffline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleConnectionChange = (online: boolean) => {
      setIsOnline(online);
    };

    networkDetectionService.onConnectionChange(handleConnectionChange);

    return () => {
      networkDetectionService.removeListener(handleConnectionChange);
    };
  }, []);

  return isOnline;
}

/**
 * Récupère le tenantId depuis les cookies ou localStorage
 */
function getTenantId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  if (match) return decodeURIComponent(match[1]);
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.tenantId || parsed.tenant?.id || null;
    }
  } catch {}
  return null;
}

/**
 * Hook pour obtenir l'état de synchronisation
 * AMÉLIORÉ : interroge IndexedDB pour les vraies valeurs de pendingCount et lastSync
 */
export function useSyncStatus() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    // Charger les vraies valeurs depuis IndexedDB
    const loadSyncData = async () => {
      try {
        const tenantId = getTenantId();
        if (!tenantId) return;

        const { localDb } = await import('@/lib/offline/local-db.service');
        
        // Compter les événements en attente
        const events = await localDb.query<{ status: string; tenantId: string }>('outbox_events');
        const count = events.filter(e => e.tenantId === tenantId && e.status === 'PENDING').length;
        setPendingCount(count);

        // Récupérer la dernière date de sync
        const states = await localDb.query<{ tenantId: string; lastSyncTimestamp: string }>('sync_state');
        const state = states.find(s => s.tenantId === tenantId);
        if (state?.lastSyncTimestamp) {
          setLastSync(new Date(state.lastSyncTimestamp));
        }
      } catch (err) {
        // IndexedDB peut ne pas être initialisé — ignorer silencieusement
        console.warn('[useSyncStatus] Failed to load sync data:', err);
      }
    };

    loadSyncData();

    // Écouter les événements de synchronisation
    const handleSyncStart = () => {
      setIsSyncing(true);
    };
    const handleSyncEnd = () => {
      setIsSyncing(false);
      // Recharger les données après chaque sync
      loadSyncData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-start', handleSyncStart);
      window.addEventListener('sync-end', handleSyncEnd);

      return () => {
        window.removeEventListener('sync-start', handleSyncStart);
        window.removeEventListener('sync-end', handleSyncEnd);
      };
    }
    return;
  }, []);

  return {
    isSyncing,
    pendingCount,
    lastSync,
  };
}

