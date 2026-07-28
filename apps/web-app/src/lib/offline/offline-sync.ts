/**
 * ============================================================================
 * OFFLINE SYNC SERVICE — Synchronisation SQLite ↔ Neon PostgreSQL
 * ============================================================================
 *
 * Ce service gère la synchronisation entre la base de données locale SQLite
 * (embarquée dans l'app desktop Tauri) et la base distante Neon PostgreSQL.
 *
 * Architecture :
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │              APP DESKTOP (Tauri + WebView2)                   │
 *   │                                                              │
 *   │   Frontend Next.js (JS)  ←→  Tauri SQL Plugin (Rust)          │
 *   │          │                            │                       │
 *   │          │  offlineSync.              │  SQLite local         │
 *   │          │  read/write()              │  (academia_helm.db)   │
 *   │          ▼                            ▼                       │
 *   │   ┌──────────────┐           ┌──────────────┐                │
 *   │   │ Cache tables │  ← sync → │  Sync Queue  │                │
 *   │   │ (read-only)  │           │  (write      │                │
 *   │   │              │           │   pending)   │                │
 *   │   └──────────────┘           └──────┬───────┘                │
 *   │                                      │                        │
 *   └──────────────────────────────────────┼────────────────────────┘
 *                                          │ (quand online)
 *                                          ▼
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │              API NestJS (api.academiahelm.com)                │
 *   │                          │                                   │
 *   │                          ▼                                   │
 *   │                 Neon PostgreSQL                              │
 *   │                 (source de vérité)                            │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Stratégie :
 *   1. ONLINE : toutes les lectures/écritures vont direct à l'API NestJS
 *      → les résultats sont mis en cache dans SQLite (pour usage offline)
 *   2. OFFLINE : lectures depuis SQLite local, écritures dans pending_sync_queue
 *   3. RECONNEXION : push de la queue vers l'API → confirmation → clear queue
 *
 * ⚠️ IMPORTANT :
 *   - SQLite n'est JAMAIS la source de vérité — c'est un cache
 *   - Neon PostgreSQL reste la source unique
 *   - Les conflits sont résolus par "last-write-wins" (sauf cas spécifiques)
 * ============================================================================
 */

// ── Détection de l'environnement Tauri ──

declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_SQL__?: any;
  }
}

/** Vérifie si on est dans l'app desktop Tauri */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

/** Vérifie si on est dans l'app mobile Flutter (webview) */
export function isMobileApp(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-ignore
    !!window.flutter_inappwebview ||
    typeof window !== "undefined" &&
      navigator.userAgent.includes("Flutter")
  );
}

// ── État de la connexion ──

let isOnline = true;
let syncInProgress = false;
const listeners = new Set<(online: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
  isOnline = navigator.onLine;
}

function setOnline(online: boolean) {
  isOnline = online;
  listeners.forEach((cb) => cb(online));

  if (online) {
    // Reconnexion → déclencher la sync
    syncPendingQueue();
  }
}

/** Hook pour écouter les changements de statut online/offline */
export function onConnectionChange(cb: (online: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Indique si l'utilisateur est actuellement online */
export function isOnlineNow(): boolean {
  return isOnline;
}

// ── Cache local (SQLite via Tauri SQL Plugin) ──

/**
 * Lit une entité depuis le cache SQLite local.
 * Si on est online, on privilégie l'API distante (source de vérité).
 * Si on est offline, on lit depuis SQLite.
 */
export async function readFromCache<T>(
  entityType: string,
  entityId: string,
): Promise<T | null> {
  if (!isDesktopApp()) return null;

  try {
    // @ts-ignore — Tauri SQL plugin
    const result = await window.__TAURI_SQL__.select(
      `SELECT data_json FROM cached_${entityType} WHERE id = $1`,
      [entityId],
    );
    if (result && result.length > 0) {
      return JSON.parse(result[0].data_json);
    }
    return null;
  } catch (error) {
    console.warn(`[offline] readFromCache failed for ${entityType}/${entityId}:`, error);
    return null;
  }
}

/**
 * Met en cache une entité dans SQLite.
 * Appelé automatiquement après chaque lecture API réussie (quand online).
 */
export async function writeToCache<T>(
  entityType: string,
  entityId: string,
  data: T,
  tenantId: string,
): Promise<void> {
  if (!isDesktopApp()) return;

  try {
    const dataJson = JSON.stringify(data);
    // @ts-ignore — Tauri SQL plugin
    await window.__TAURI_SQL__.execute(
      `INSERT OR REPLACE INTO cached_${entityType} (id, tenant_id, data_json, cached_at)
       VALUES ($1, $2, $3, datetime('now'))`,
      [entityId, tenantId, dataJson],
    );
  } catch (error) {
    console.warn(`[offline] writeToCache failed for ${entityType}/${entityId}:`, error);
  }
}

/**
 * Lit toutes les entités d'un type depuis le cache (pour mode offline).
 */
export async function readAllFromCache<T>(
  entityType: string,
  tenantId: string,
): Promise<T[]> {
  if (!isDesktopApp()) return [];

  try {
    // @ts-ignore — Tauri SQL plugin
    const result = await window.__TAURI_SQL__.select(
      `SELECT data_json FROM cached_${entityType} WHERE tenant_id = $1 ORDER BY cached_at DESC`,
      [tenantId],
    );
    return (result || []).map((row: any) => JSON.parse(row.data_json));
  } catch (error) {
    console.warn(`[offline] readAllFromCache failed for ${entityType}:`, error);
    return [];
  }
}

// ── File d'attente de synchronisation (écritures offline) ──

export interface PendingSyncItem {
  id: string; // UUID généré côté client
  tenantId: string;
  entityType: string; // 'student', 'transaction', 'attendance', etc.
  entityId?: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  endpoint: string; // URL API cible
  method: "POST" | "PATCH" | "DELETE";
  payload?: any;
}

/**
 * Ajoute une écriture à la queue de synchronisation.
 * Appelé quand l'utilisateur fait une action en mode offline.
 */
export async function enqueueSync(
  item: Omit<PendingSyncItem, "id">,
): Promise<void> {
  if (!isDesktopApp()) return;

  const id = generateUUID();
  try {
    // @ts-ignore — Tauri SQL plugin
    await window.__TAURI_SQL__.execute(
      `INSERT INTO pending_sync_queue (id, tenant_id, entity_type, entity_id, operation, endpoint, method, payload_json, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', datetime('now'))`,
      [
        id,
        item.tenantId,
        item.entityType,
        item.entityId || null,
        item.operation,
        item.endpoint,
        item.method,
        item.payload ? JSON.stringify(item.payload) : null,
      ],
    );

    // Mettre à jour le timestamp de dernière action offline
    // @ts-ignore
    await window.__TAURI_SQL__.execute(
      `INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES ('last_offline_action', datetime('now'), datetime('now'))`,
    );
  } catch (error) {
    console.error("[offline] enqueueSync failed:", error);
  }
}

/**
 * Récupère tous les éléments en attente de synchronisation.
 */
export async function getPendingQueue(
  tenantId: string,
): Promise<PendingSyncItem[]> {
  if (!isDesktopApp()) return [];

  try {
    // @ts-ignore — Tauri SQL plugin
    const result = await window.__TAURI_SQL__.select(
      `SELECT id, tenant_id, entity_type, entity_id, operation, endpoint, method, payload_json
       FROM pending_sync_queue
       WHERE tenant_id = $1 AND status = 'PENDING'
       ORDER BY created_at ASC`,
      [tenantId],
    );
    return (result || []).map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      endpoint: row.endpoint,
      method: row.method,
      payload: row.payload_json ? JSON.parse(row.payload_json) : undefined,
    }));
  } catch (error) {
    console.warn("[offline] getPendingQueue failed:", error);
    return [];
  }
}

/**
 * Pousse la queue de synchronisation vers l'API NestJS.
 * Appelé automatiquement quand la connexion est rétablie.
 */
export async function syncPendingQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!isDesktopApp() || !isOnline || syncInProgress) {
    return { synced: 0, failed: 0 };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;

  try {
    // Récupérer le tenantId depuis sync_meta
    // @ts-ignore
    const metaResult = await window.__TAURI_SQL__.select(
      `SELECT value FROM sync_meta WHERE key = 'tenant_id'`,
    );
    const tenantId = metaResult?.[0]?.value;
    if (!tenantId) return { synced: 0, failed: 0 };

    const queue = await getPendingQueue(tenantId);

    for (const item of queue) {
      try {
        // Marquer comme SYNCING
        // @ts-ignore
        await window.__TAURI_SQL__.execute(
          `UPDATE pending_sync_queue SET status = 'SYNCING' WHERE id = $1`,
          [item.id],
        );

        // Envoyer à l'API
        const response = await fetch(item.endpoint, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: item.payload ? JSON.stringify(item.payload) : undefined,
        });

        if (response.ok) {
          // Succès → supprimer de la queue
          // @ts-ignore
          await window.__TAURI_SQL__.execute(
            `DELETE FROM pending_sync_queue WHERE id = $1`,
            [item.id],
          );
          synced++;
        } else {
          // Échec → marquer comme FAILED + incrémenter retry_count
          const errorText = await response.text().catch(() => "");
          // @ts-ignore
          await window.__TAURI_SQL__.execute(
            `UPDATE pending_sync_queue SET status = 'FAILED', retry_count = retry_count + 1, last_error = $2 WHERE id = $1`,
            [item.id, errorText.substring(0, 500)],
          );
          failed++;
        }
      } catch (error: any) {
        // @ts-ignore
        await window.__TAURI_SQL__.execute(
          `UPDATE pending_sync_queue SET status = 'FAILED', retry_count = retry_count + 1, last_error = $2 WHERE id = $1`,
          [item.id, error.message?.substring(0, 500)],
        );
        failed++;
      }
    }

    // Mettre à jour le timestamp de dernière sync
    if (synced > 0) {
      // @ts-ignore
      await window.__TAURI_SQL__.execute(
        `INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES ('last_online_sync', datetime('now'), datetime('now'))`,
      );
    }

    console.log(`[offline] Sync complete: ${synced} synced, ${failed} failed`);
  } finally {
    syncInProgress = false;
  }

  return { synced, failed };
}

/**
 * Indique si des écritures sont en attente de synchronisation.
 */
export async function hasPendingSync(): Promise<boolean> {
  if (!isDesktopApp()) return false;

  try {
    // @ts-ignore
    const result = await window.__TAURI_SQL__.select(
      `SELECT COUNT(*) as count FROM pending_sync_queue WHERE status IN ('PENDING', 'FAILED')`,
    );
    return (result?.[0]?.count || 0) > 0;
  } catch {
    return false;
  }
}

// ── Helper : Wrapper pour les appels API avec fallback offline ──

/**
 * Wrapper qui exécute un appel API quand online, ou met en queue quand offline.
 *
 * @example
 * const result = await offlineAwareCall({
 *   endpoint: '/api/students',
 *   method: 'POST',
 *   payload: { firstName: 'John', ... },
 *   entityType: 'student',
 *   operation: 'CREATE',
 *   tenantId: 'xxx',
 * });
 */
export async function offlineAwareCall<T>(params: {
  endpoint: string;
  method: "POST" | "PATCH" | "DELETE";
  payload?: any;
  entityType: string;
  entityId?: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  tenantId: string;
}): Promise<T | null> {
  // Si online → appel direct + mise en cache du résultat
  if (isOnline) {
    const response = await fetch(params.endpoint, {
      method: params.method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: params.payload ? JSON.stringify(params.payload) : undefined,
    });

    if (response.ok) {
      const data = await response.json();
      // Mettre en cache pour usage offline futur
      if (params.entityId && data) {
        await writeToCache(params.entityType, params.entityId, data, params.tenantId);
      }
      return data;
    }
    throw new Error(`API error: ${response.status}`);
  }

  // Si offline → mettre en queue
  await enqueueSync(params);

  // Retourner une réponse simulée (l'utilisateur sait que c'est en attente)
  return null;
}

// ── Utilitaires ──

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Initialise le service offline.
 * À appeler au démarrage de l'app (dans un useEffect ou _app.tsx).
 */
export async function initOfflineSync(tenantId: string): Promise<void> {
  if (!isDesktopApp()) return;

  try {
    // Stocker le tenantId
    // @ts-ignore
    await window.__TAURI_SQL__.execute(
      `INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES ('tenant_id', $1, datetime('now'))`,
      [tenantId],
    );

    // Si online → sync immédiate de la queue
    if (isOnline) {
      await syncPendingQueue();
    }

    console.log("[offline] Service initialized for tenant:", tenantId);
  } catch (error) {
    console.error("[offline] initOfflineSync failed:", error);
  }
}
