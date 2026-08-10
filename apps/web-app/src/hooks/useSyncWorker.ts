"use client";

/**
 * ============================================================================
 * useSyncWorker — Hook pour démarrer le worker de synchronisation
 * ============================================================================
 *
 * À utiliser une seule fois au niveau racine de l'app (dans PilotageLayout
 * ou AppLayout).
 *
 * ⭐ RÉACTIVÉ sur TOUS les environnements (web + desktop) :
 *    - Sur desktop (Tauri) : sync SQLite ↔ Neon via le bridge Tauri
 *    - Sur web : sync IndexedDB ↔ Neon via le sync-engine.service.ts
 *
 * Démarre le worker au mount, l'arrête au unmount.
 * ============================================================================
 */

import { useEffect } from 'react';
import { startSyncWorker, stopSyncWorker } from '@/lib/offline/sync-worker';

export function useSyncWorker(): void {
  useEffect(() => {
    // ⭐ Démarrer le worker sur TOUS les environnements (web + desktop)
    startSyncWorker();

    return () => {
      stopSyncWorker();
    };
  }, []);
}
