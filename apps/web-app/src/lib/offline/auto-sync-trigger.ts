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
 *         → max 5 tentatives ; au-delà, les événements RESTENT PENDING
 *           (jamais marqués FAILED sur échec transitoire) — le cycle de
 *           30 s du offlineSyncService prend le relais
 *       → puis runSync() (pull) si temps depuis dernier pull > 5 min
 *
 * ⭐ UX SIMPLISTE (sept. 2026) :
 *   - PUSH : petite PASTILLE discrète en bas-droite, SEULEMENT s'il y a
 *     des modifications locales à envoyer (jamais de modal plein écran).
 *   - PULL delta : 100% SILENCIEUX en arrière-plan — invisible si rien
 *     n'a changé ; s'il a reçu des nouveautés, une mini pastille verte
 *     « N mises à jour » s'affiche 3 s. Les reconnexions de routine
 *     sont donc quasi instantanées et silencieuses.
 *   - CONFLITS : le ConflictResolutionModal reste affiché (décision humaine).
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
// ⭐ Réduit de 10 à 5 : une fois le backoff épuisé (~2 min), on rend la main
//    au cycle de 30 s (qui relance le push régulièrement) au lieu de rester
//    bloqué jusqu'à ~6,5 min dans l'autoSync — c'est ce qui donnait
//    l'impression que « la synchronisation prend un temps fou ».
const MAX_RETRIES = 5;

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
    // ⭐ RÉCUPÉRATION (idempotent) : les événements FAILED pour cause
    //    transitoire (ancien bug — panne serveur comptée comme échec
    //    définitif) repassent PENDING avant chaque tentative, couvrant aussi
    //    le cas « app chargée hors ligne, réseau revenu ensuite ».
    try {
      await outboxService.requeueTransientlyFailedEvents(tenantId);
    } catch { /* non-bloquant */ }

    // ─── 1. PUSH : envoyer l'outbox par lots ───
    //    ⭐ PASTILLE discrète — seulement s'il y a des modifications à envoyer.
    let initialPending = 0;
    try { initialPending = await outboxService.getPendingCount(); } catch {}
    if (initialPending > 0) {
      setSyncModalState({
        isVisible: true,
        isMinimized: true, // pastille non-bloquante (jamais plein écran en routine)
        phase: 'push',
        message: `Envoi de ${initialPending} modification(s)...`,
        pushed: 0,
        pulled: 0,
        current: 0,
        total: initialPending,
      });
    }

    await pushOutboxBatched(tenantId);

    // ─── 2. PULL : si plus de 5 min depuis le dernier pull ───
    const now = Date.now();
    if (now - lastPullTime > MIN_PULL_INTERVAL_MS) {
      console.log('[AutoSync] Starting silent delta pull...');
      // ⭐ 100% SILENCIEUX : pas de progression affichée pendant le pull.
      //    Le delta ne contient que les enregistrements modifiés depuis la
      //    dernière sync — en pratique quelques secondes en arrière-plan.
      const result = await runSync(tenantId, undefined, undefined);
      lastPullTime = Date.now();

      if (result.conflicts > 0) {
        console.warn(`[AutoSync] ${result.conflicts} conflicts detected — showing ConflictResolutionModal`);
      }

      // ⭐ Si des nouveautés ont été reçues → mini pastille verte 3 s
      //    (transparence minimale). Sinon → RIEN à l'écran.
      const pulledCount = Object.values(result.pulled || {}).reduce(
        (a: number, b: any) => a + (b as number), 0,
      ) as number;
      if (pulledCount > 0) {
        setSyncModalState({
          isVisible: true,
          isMinimized: true,
          phase: 'done',
          message: `${pulledCount} mise(s) à jour reçue(s)`,
          pushed: result.pushed,
          pulled: pulledCount,
        });
        setTimeout(() => setSyncModalState({ isVisible: false }), 3000);
      } else {
        // Rien de nouveau : fermer la pastille push éventuelle
        setSyncModalState({ isVisible: false });
      }
    } else {
      // Pas de pull (< 5 min) : fermer la pastille push éventuelle
      setSyncModalState({ isVisible: false });
    }
  } catch (error) {
    console.error('[AutoSync] Failed:', error);
    // ⭐ Fermer la pastille (les événements restants seront retentés au cycle 30 s)
    setSyncModalState({ isVisible: false });
  } finally {
    isAutoSyncing = false;
  }
}

/**
 * Pousse l'outbox par lots de BATCH_SIZE événements.
 * Retry avec backoff exponentiel sur échec.
 *
 * ⭐ FIX (2026-09-21) — deux bugs critiques corrigés :
 * 1. PERTE DE DONNÉES : après MAX_RETRIES échecs, l'ancien code marquait les
 *    événements FAILED (« Max retries exceeded ») → clearStaleEvents les
 *    SUPPRIMAIT ensuite (retryCount >= maxRetries). Une panne serveur de
 *    quelques minutes détruisait donc DÉFINITIVEMENT les modifications de
 *    l'utilisateur. Désormais : un échec réseau/5xx laisse les événements
 *    PENDING — ils sont retentés au cycle de 30 s / au prochain retour du
 *    réseau. Seuls les refus MÉTIER (4xx, gérés dans replayOfflineRequest /
 *    les résultats du push) marquent FAILED.
 * 2. BOUCLE SERRÉE : quand pushOutbox revenait SANS exception mais sans rien
 *    pousser (replay 5xx transitoire → événements restés PENDING), le
 *    while(true) re-consultait la même file et re-martelait le serveur mort
 *    sans AUCUN délai (et isAutoSyncing restait vérouillé à jamais).
 *    Désormais : détection de blocage → on sort proprement.
 */
async function pushOutboxBatched(tenantId: string): Promise<void> {
  let pushed = 0;
  let failed = 0;
  let lastRemaining = -1;

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
    let batchSucceeded = false;
    let batchPushed = 0;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (!networkDetectionService.isConnected()) {
        console.log('[AutoSync] Connection lost during retry — stopping');
        break;
      }

      try {
        const result = await pushOutbox(tenantId);
        pushed += result.pushed;
        batchPushed += result.pushed;
        if (result.errors > 0) {
          failed += result.errors;
          console.warn(`[AutoSync] ${result.errors} errors in batch`);
        }
        if (result.conflicts > 0) {
          console.warn(`[AutoSync] ${result.conflicts} conflicts — will show modal`);
        }
        batchSucceeded = true;
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

    const remaining = await outboxService.getPendingCount(tenantId).catch(() => -1);
    if (remaining === 0) break;

    if (!batchSucceeded) {
      // ⭐ ÉCHEC TRANSITOIRE (serveur injoignable / 5xx) : les événements
      //    RESTENT PENDING — retentés par le cycle de 30 s et le prochain
      //    retour du réseau. ON NE LES MARQUE PAS FAILED : une panne serveur
      //    ne doit JAMAIS détruire les données en attente de l'utilisateur.
      console.warn(
        `[AutoSync] Push transitoirement impossible après ${MAX_RETRIES} tentatives ` +
        `(${remaining} événement(s) restent en file PENDING) — nouvelle tentative au prochain cycle`,
      );
      break;
    }

    // ⭐ DÉTECTION DE BLOCAGE : le lot « a réussi » sans exception mais sans
    //    rien pousser ET la file n'a pas diminué (replay 5xx transitoire →
    //    événements restés PENDING). Sans cette garde : boucle serrée sans
    //    délai qui martèle le serveur et vérouille isAutoSyncing indéfiniment.
    if (batchPushed === 0 && remaining === lastRemaining) {
      console.warn(
        `[AutoSync] Stall détecté (${remaining} événement(s) PENDING inchangés) — ` +
        `sortie de la boucle, nouvelle tentative au cycle de 30 s`,
      );
      break;
    }
    lastRemaining = remaining;
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
    // ⭐ RÉCUPÉRATION d'abord : les événements marqués FAILED par l'ancien bug
    //    (panne serveur comptée comme échec définitif) sont re-mis en file
    //    PENDING — la modification « envoie 0 sur 1 mais rien » de l'utilisateur
    //    repartira ainsi vers Neon dès le premier push de la session.
    outboxService
      .requeueTransientlyFailedEvents(tenantId)
      .catch(() => { /* non-bloquant */ })
      .then(() => outboxService.getPendingCount())
      .then((count) => {
        if (count > 0) {
          console.log(`[AutoSync] ${count} pending events on mount — triggering sync`);
          setTimeout(() => autoSync(tenantId), 2000); // 2s après le mount
        }
      })
      .catch(() => { /* non-bloquant */ });
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
