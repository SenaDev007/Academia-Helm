/**
 * ============================================================================
 * AUTO SYNC TRIGGER — Déclencheur de sync automatique au retour du réseau
 * ============================================================================
 *
 * ⭐ PHILOSOPHIE : pas comme GitHub (push manuel). Ici, c'est de la
 *    réplication continue avec file d'attente. L'enseignant en zone rurale
 *    ne clique pas sur "synchroniser" — ça se fait tout seul, en silence.
 *
 * Flux :
 *   network-detection.service.ts émet 'online'
 *     → debounce 1.5s (évite les flaps de connexion instables)
 *     → si aucun sync en cours (mutex global)
 *       → lance pushOutbox() immédiatement
 *         → batches de 50 événements vers POST /api/sync/push
 *         → retry backoff exponentiel + jitter (2s, 5s, 15s, 45s, 60s)
 *         → max 10 tentatives avant markAsFailed
 *       → puis runSync() (pull) si temps depuis dernier pull > 5 min
 *
 * SLA : 30 secondes entre retour de connexion et fin de sync.
 *   - Petit volume (< 50 events) : ~2-5s ✅
 *   - Volume moyen (50-200 events) : ~10-20s ✅
 *   - Gros volume (200+ events, connexion faible) : peut dépasser 30s ⚠️
 *     Le batch de 50 limite le risque : on pousse par lots, si la connexion
 *     recoupe, les lots déjà poussés sont perdus et le reste reste en file.
 * ============================================================================
 */

'use client';

import { networkDetectionService } from './network-detection.service';
import { outboxService } from './outbox.service';
import { localDb } from './local-db.service';
import { runSync, pushOutbox } from './sync-engine.service';
import { setSyncModalState } from '@/components/offline/SyncModal';

// ─── État global ──────────────────────────────────────────────────────────

let isAutoSyncing = false; // Mutex global — un seul sync à la fois
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPullTime = 0;
const MIN_PULL_INTERVAL_MS = 5 * 60 * 1000; // 5 min entre pulls automatiques
const DEBOUNCE_MS = 1500; // 1.5s pour filtrer les flaps réseau
const BATCH_SIZE = 50; // 50 événements par lot vers /api/sync/push

// ─── Backoff exponentiel + jitter ─────────────────────────────────────────

const BACKOFF_DELAYS = [2000, 5000, 15000, 45000, 60000]; // 2s, 5s, 15s, 45s, 60s
const MAX_RETRIES = 10;

function getBackoffDelay(retryCount: number): number {
  if (retryCount < BACKOFF_DELAYS.length) {
    const base = BACKOFF_DELAYS[retryCount];
    // Jitter : ±20% du délai de base pour éviter le thundering herd
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  }
  // Après le 5e retry, toutes les 60s avec jitter
  return Math.round(60000 + 60000 * 0.2 * (Math.random() * 2 - 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Sync principal ───────────────────────────────────────────────────────

/**
 * Déclenche la sync automatique (push + pull) au retour du réseau.
 * Mutex global : si un sync est déjà en cours, on skip.
 */
async function autoSync(tenantId: string): Promise<void> {
  if (isAutoSyncing) {
    console.log('[AutoSync] Already syncing — skipping');
    return;
  }
  if (!networkDetectionService.isConnected()) {
    console.log('[AutoSync] Offline — skipping');
    return;
  }

  isAutoSyncing = true;

  try {
    // ─── 1. PUSH : envoyer l'outbox par lots ───
    await pushOutboxBatched(tenantId);

    // ─── 2. PULL : si plus de 5 min depuis le dernier pull ───
    const now = Date.now();
    if (now - lastPullTime > MIN_PULL_INTERVAL_MS) {
      console.log('[AutoSync] Starting pull...');
      const result = await runSync(tenantId, undefined, (current, total, table, pulled) => {
        setSyncModalState({
          isVisible: true,
          isMinimized: true, // pastille non-bloquante
          phase: 'pull',
          message: `Sync auto: ${current}/${total} — ${table}`,
          current,
          total,
          pulled,
          pushed: 0,
        });
      });
      lastPullTime = Date.now();

      if (result.conflicts > 0) {
        console.warn(`[AutoSync] ${result.conflicts} conflicts detected — showing ConflictResolutionModal`);
      }

      // Fermer le modal minimisé après 3s
      setTimeout(() => {
        setSyncModalState({ isVisible: false });
      }, 3000);
    }
  } catch (error) {
    console.error('[AutoSync] Failed:', error);
  } finally {
    isAutoSyncing = false;
  }
}

/**
 * Pousse l'outbox par lots de BATCH_SIZE événements.
 * Retry avec backoff exponentiel sur échec.
 */
async function pushOutboxBatched(tenantId: string): Promise<void> {
  let pushed = 0;
  let failed = 0;

  while (true) {
    if (!networkDetectionService.isConnected()) {
      console.log('[AutoSync] Connection lost during push — stopping');
      break;
    }

    // Récupérer le prochain lot
    const pending = await outboxService.getPendingEvents(tenantId, BATCH_SIZE);
    if (pending.length === 0) {
      console.log(`[AutoSync] Push complete: ${pushed} pushed, ${failed} failed`);
      break;
    }

    // Tenter le push du lot avec retry
    let success = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (!networkDetectionService.isConnected()) {
        console.log('[AutoSync] Connection lost during retry — stopping');
        break;
      }

      try {
        const result = await pushOutbox(tenantId);
        pushed += result.pushed;
        if (result.errors > 0) {
          failed += result.errors;
          console.warn(`[AutoSync] ${result.errors} errors in batch`);
        }
        if (result.conflicts > 0) {
          console.warn(`[AutoSync] ${result.conflicts} conflicts — will show modal`);
        }
        success = true;
        break;
      } catch (error) {
        console.warn(`[AutoSync] Push attempt ${attempt + 1} failed:`, error);
        if (attempt < MAX_RETRIES - 1) {
          const delay = getBackoffDelay(attempt);
          console.log(`[AutoSync] Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    if (!success) {
      // Marquer les événements restants comme failed
      for (const event of pending) {
        await outboxService.markAsFailed(event.id, 'Max retries exceeded');
      }
      failed += pending.length;
      console.error(`[AutoSync] Batch failed after ${MAX_RETRIES} retries — marked as failed`);
    }
  }

  // Mettre à jour le badge outbox
  const remaining = await outboxService.getPendingCount();
  if (remaining > 0) {
    console.log(`[AutoSync] ${remaining} events still pending`);
  }
}

// ─── Déclencheur sur événement 'online' ───────────────────────────────────

let isInitialized = false;

/**
 * Initialise l'auto-sync trigger. À appeler une fois au montage de l'app
 * (dans layout-client.tsx).
 */
export function initAutoSyncTrigger(tenantId: string | undefined): void {
  if (isInitialized) return;
  if (!tenantId) return;
  if (typeof window === 'undefined') return;

  isInitialized = true;

  // ⭐ Écouter les changements de réseau
  networkDetectionService.onNetworkStatusChange((isOnline) => {
    if (isOnline) {
      // Debounce 1.5s pour filtrer les flaps
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[AutoSync] Network restored — triggering sync');
        autoSync(tenantId);
      }, DEBOUNCE_MS);
    }
  });

  // ⭐ Au montage : si déjà online et qu'il y a des events en attente, sync immédiat
  if (networkDetectionService.isConnected()) {
    outboxService.getPendingCount().then((count) => {
      if (count > 0) {
        console.log(`[AutoSync] ${count} pending events on mount — triggering sync`);
        setTimeout(() => autoSync(tenantId), 2000); // 2s après le mount
      }
    });
  }

  // ⭐ Background Sync API : si l'onglet est fermé, le SW prend le relais
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      // @ts-ignore — SyncManager n'est pas dans tous les TS DOM lib
      registration.sync.register('sync-outbox').catch(() => {
        // Background Sync non supporté (Firefox) — on dépend du trigger online
      });
    });
  }

  console.log('[AutoSync] Initialized for tenant:', tenantId);

  // ⭐ Écouter les messages du Service Worker (Background Sync)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
        console.log('[AutoSync] Background Sync trigger from SW');
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          autoSync(tenantId);
        }, 500); // debounce court (500ms) car le SW l'a déjà debounce
      }
    });
  }
}

// ─── Export pour tests ────────────────────────────────────────────────────

export { autoSync, isAutoSyncing };
