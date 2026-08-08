"use client";

/**
 * ============================================================================
 * useSyncWorker — Hook pour démarrer le worker de synchronisation
 * ============================================================================
 *
 * À utiliser une seule fois au niveau racine de l'app (dans PilotageLayout
 * ou AppLayout).
 *
 * Démarre le worker au mount, l'arrête au unmount.
 * Le worker ne tourne QUE dans l'app desktop (Tauri) — no-op sur le web.
 * ============================================================================
 */

import { useEffect } from 'react';
import { startSyncWorker, stopSyncWorker } from '@/lib/offline/sync-worker';
import { isDesktopApp } from '@/lib/offline/offline-sync';

export function useSyncWorker(): void {
  useEffect(() => {
    if (!isDesktopApp()) return;

    startSyncWorker();

    return () => {
      stopSyncWorker();
    };
  }, []);
}
