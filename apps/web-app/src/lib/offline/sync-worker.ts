/**
 * ============================================================================
 * SYNC WORKER — Synchronisation descendante Neon → Local (toutes les 60s)
 * ============================================================================
 *
 * Service qui tourne en arrière-plan dans l'app desktop/mobile.
 *
 * Fonctionnalités :
 *   1. Au démarrage → première sync complète (récupère TOUT)
 *   2. Toutes les 60 secondes → sync delta (récupère les changements)
 *   3. Bouton "Synchroniser" manuel (déclenche une sync immédiate)
 *   4. Au retour de connexion → sync immédiate + push de la queue
 *
 * Non intrusif : ce service ne modifie AUCUN CRUD existant.
 * Il appelle juste GET /api/sync/delta et met à jour le cache SQLite/Hive.
 *
 * ⚠️ Neon = source de vérité. Ce service ne fait que LIRE depuis Neon
 *    et écrire dans le cache local. Aucune écriture vers Neon (sauf queue).
 * ============================================================================
 */

import { isDesktopApp, isOnlineNow, syncPendingQueue } from './offline-sync';

// ── Configuration ──
const SYNC_INTERVAL_MS = 60 * 1000; // 60 secondes
const SYNC_API_ENDPOINT = '/api/sync/delta';

// ── État global ──
let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let lastSyncToken: string | null = null;
let lastSyncAt: Date | null = null;

const syncStatusListeners = new Set<(status: SyncStatus) => void>();

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  lastSyncToken: string | null;
  error: string | null;
  pendingCount: number; // nombre d'écritures en attente (offline)
}

function getSyncStatus(): SyncStatus {
  return {
    isSyncing,
    lastSyncAt,
    lastSyncToken,
    error: null,
    pendingCount: 0, // TODO: lire depuis SQLite
  };
}

function notifyStatusChange() {
  const status = getSyncStatus();
  syncStatusListeners.forEach((cb) => cb(status));
}

/** S'abonner aux changements de statut de sync (pour le bouton "Synchroniser") */
export function onSyncStatusChange(cb: (status: SyncStatus) => void): () => void {
  syncStatusListeners.add(cb);
  cb(getSyncStatus()); // notification immédiate
  return () => syncStatusListeners.delete(cb);
}

// ── Stockage du syncToken ──

async function getLastSyncToken(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  try {
    // @ts-ignore — Tauri SQL plugin
    const result = await window.__TAURI_SQL__.select(
      `SELECT value FROM sync_meta WHERE key = 'last_sync_token'`,
    );
    return result?.[0]?.value || null;
  } catch {
    return null;
  }
}

async function saveSyncToken(token: string): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    // @ts-ignore
    await window.__TAURI_SQL__.execute(
      `INSERT OR REPLACE INTO sync_meta (key, value, updated_at)
       VALUES ('last_sync_token', $1, datetime('now'))`,
      [token],
    );
    lastSyncToken = token;
  } catch (error) {
    console.warn('[sync] saveSyncToken failed:', error);
  }
}

// ── Mise à jour du cache local avec les deltas ──

/**
 * Met à jour le cache SQLite local avec les entités reçues depuis Neon.
 * Pour chaque type d'entité, on fait un INSERT OR REPLACE.
 */
async function updateLocalCache(entities: Record<string, any[]>): Promise<void> {
  if (!isDesktopApp()) return;

  const entityTypeToTable: Record<string, string> = {
    students: 'cached_students',
    classes: 'cached_classes',
    studentAccounts: 'cached_student_accounts',
    financeTransactions: 'cached_transactions',
    reportCards: 'cached_report_cards',
    cahierJournalEntries: 'cached_cahier_journal',
    // TODO: ajouter les autres tables de cache
  };

  for (const [entityType, items] of Object.entries(entities)) {
    if (!items || items.length === 0) continue;

    const tableName = entityTypeToTable[entityType];
    if (!tableName) {
      // Type d'entité non mis en cache — on l'ignore (pas d'erreur)
      continue;
    }

    for (const item of items) {
      try {
        const id = item.id;
        if (!id) continue;

        const dataJson = JSON.stringify(item);
        const tenantId = item.tenantId || '';

        // @ts-ignore
        await window.__TAURI_SQL__.execute(
          `INSERT OR REPLACE INTO ${tableName} (id, tenant_id, data_json, cached_at)
           VALUES ($1, $2, $3, datetime('now'))`,
          [id, tenantId, dataJson],
        );
      } catch (error) {
        console.warn(`[sync] updateLocalCache failed for ${entityType}/${item.id}:`, error);
      }
    }
  }
}

// ── Sync principale ──

/**
 * Exécute une synchronisation delta depuis Neon.
 * Appelle GET /api/sync/delta?since=lastSyncToken
 * Met à jour le cache local avec les changements.
 */
export async function performSync(): Promise<{
  success: boolean;
  entitiesSynced: number;
  error?: string;
}> {
  if (!isDesktopApp()) {
    return { success: false, entitiesSynced: 0, error: 'Not in desktop app' };
  }

  if (!isOnlineNow()) {
    return { success: false, entitiesSynced: 0, error: 'Offline' };
  }

  if (isSyncing) {
    return { success: false, entitiesSynced: 0, error: 'Sync already in progress' };
  }

  isSyncing = true;
  notifyStatusChange();

  try {
    // Récupérer le dernier syncToken
    const since = await getLastSyncToken();

    // Appeler l'API
    const url = since
      ? `${SYNC_API_ENDPOINT}?since=${encodeURIComponent(since)}`
      : SYNC_API_ENDPOINT;

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Sync API error: ${response.status}`);
    }

    const data = await response.json();

    // Mettre à jour le cache local
    if (data.entities) {
      await updateLocalCache(data.entities);
    }

    // Sauvegarder le nouveau syncToken
    if (data.syncToken) {
      await saveSyncToken(data.syncToken);
    }

    lastSyncAt = new Date();

    // En parallèle : pousser la queue d'écritures offline (si connexion revenue)
    await syncPendingQueue();

    console.log(
      `[sync] Sync complete — ${data.stats?.totalEntities || 0} entities, token: ${data.syncToken}`,
    );

    notifyStatusChange();
    return {
      success: true,
      entitiesSynced: data.stats?.totalEntities || 0,
    };
  } catch (error: any) {
    console.error('[sync] Sync failed:', error);
    notifyStatusChange();
    return {
      success: false,
      entitiesSynced: 0,
      error: error.message,
    };
  } finally {
    isSyncing = false;
    notifyStatusChange();
  }
}

// ── Démarrage / arrêt du worker ──

/**
 * Démarre le worker de synchronisation.
 * À appeler au démarrage de l'app (dans un useEffect au niveau racine).
 *
 * - Première sync immédiate
 * - Puis toutes les 60 secondes
 * - + au retour de connexion (event 'online')
 */
export function startSyncWorker(): void {
  if (syncInterval) return; // déjà démarré

  console.log('[sync] Starting sync worker (interval: 60s)');

  // ⭐ Sur desktop : sync via Tauri SQLite bridge
  //    Sur web : la sync est gérée par offlineSyncService (offline-sync.service.ts)
  //    qui tourne déjà avec un intervalle de 30s + 5min.
  //    On ne démarre le worker Tauri QUE sur desktop.
  if (isDesktopApp()) {
    // Première sync immédiate (au prochain tick pour éviter de bloquer le démarrage)
    setTimeout(() => performSync(), 2000);

    // Sync périodique toutes les 60s
    syncInterval = setInterval(() => {
      if (isOnlineNow()) {
        performSync();
      }
    }, SYNC_INTERVAL_MS);

    // Sync au retour de connexion
    window.addEventListener('online', () => {
      console.log('[sync] Connection restored — triggering sync');
      performSync();
    });
  } else {
    // ⭐ Sur web : démarrer le offlineSyncService (IndexedDB + outbox + sync-engine)
    //    Ce service tourne déjà mais il ne démarrait pas parce que useSyncWorker
    //    retournait avant. Maintenant que useSyncWorker est activé sur web,
    //    offlineSyncService.start() est appelé ici.
    import('./offline-sync.service').then(({ offlineSyncService }) => {
      offlineSyncService.start();
      console.log('[sync] Web sync service started (IndexedDB + outbox)');
    }).catch((err) => {
      console.warn('[sync] Failed to start web sync service:', err);
    });
  }
}

/**
 * Arrête le worker de synchronisation.
 */
export function stopSyncWorker(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[sync] Sync worker stopped');
  }
}

/**
 * Déclenche une sync manuelle (bouton "Synchroniser").
 * Retourne une promesse qui se résout quand la sync est terminée.
 */
export async function manualSync(): Promise<{
  success: boolean;
  entitiesSynced: number;
  error?: string;
}> {
  console.log('[sync] Manual sync triggered');
  return performSync();
}
