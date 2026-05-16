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
 * Hook pour obtenir l'état de synchronisation
 */
export function useSyncStatus() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    // Écouter les événements de synchronisation
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => setIsSyncing(false);

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

