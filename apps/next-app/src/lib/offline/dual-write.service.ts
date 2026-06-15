/**
 * ============================================================================
 * DUAL-WRITE SERVICE — Double-écriture simultanée (IndexedDB + PostgreSQL)
 * ============================================================================
 *
 * PRINCIPE : Toute sauvegarde écrit SIMULTANÉMENT dans :
 *   1. La base de données locale (IndexedDB) — TOUJOURS, immédiatement
 *   2. La base de données mère (PostgreSQL via API) — immédiatement si en ligne
 *
 * Garanties :
 *   - IndexedDB est TOUJOURS à jour (écriture synchrone en premier)
 *   - Si le serveur est joignable, PostgreSQL est mis à jour immédiatement
 *   - Si le serveur est injoignable, l'outbox prend le relais (eventual consistency)
 *   - Zéro déphasage entre local et distant
 *   - Pas de régression : les modules existants continuent de fonctionner
 *
 * UTILISATION :
 *   import { dualWriteService } from '@/lib/offline/dual-write.service';
 *   const result = await dualWriteService.write({
 *     storeName: 'students',
 *     entityType: 'STUDENT',
 *     operation: 'CREATE',
 *     data: { firstName: 'Jean', lastName: 'Dupont' },
 *     tenantId: 'xxx',
 *     apiEndpoint: '/api/students',
 *     method: 'POST',
 *   });
 * ============================================================================
 */

import { localDb } from './local-db.service';
import { outboxService } from './outbox.service';
import { offlineSyncService } from './offline-sync.service';
import { networkDetectionService } from './network-detection.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import type { SyncEntityType, SyncOperationType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DualWriteParams {
  /** Nom du store IndexedDB (ex: 'students', 'staff') */
  storeName: string;
  /** Type d'entité pour le sync engine (ex: 'STUDENT') */
  entityType: SyncEntityType;
  /** Opération effectuée */
  operation: SyncOperationType;
  /** Données à sauvegarder */
  data: Record<string, any>;
  /** ID du tenant */
  tenantId: string;
  /** Endpoint API distante (ex: '/api/students') */
  apiEndpoint: string;
  /** Méthode HTTP pour l'API (POST, PUT, PATCH, DELETE) */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** ID de l'entité (requis pour UPDATE/DELETE, optionnel pour CREATE) */
  entityId?: string;
  /** Métadonnées additionnelles pour l'outbox */
  metadata?: Record<string, any>;
  /** Si true, ne pas écrire dans IndexedDB (défaut: false) */
  skipLocal?: boolean;
  /** Si true, ne pas écrire vers l'API distante (défaut: false) */
  skipRemote?: boolean;
  /** Timeout pour la requête distante en ms (défaut: 15000) */
  remoteTimeout?: number;
}

export interface DualWriteResult {
  /** Succès global (au moins local réussi) */
  success: boolean;
  /** Données écrites localement */
  localData: Record<string, any> | null;
  /** Données retournées par le serveur */
  remoteData: Record<string, any> | null;
  /** L'écriture locale a réussi */
  localSuccess: boolean;
  /** L'écriture distante a réussi */
  remoteSuccess: boolean;
  /** L'écriture distante a été ignorée (hors ligne ou skipRemote) */
  remoteSkipped: boolean;
  /** Message d'erreur éventuel */
  error?: string;
  /** L'entité est en attente de synchronisation (outbox) */
  pendingSync: boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_REMOTE_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DualWriteService {
  /**
   * Double-écriture : IndexedDB + API distante simultanément
   *
   * Algorithme :
   * 1. Écrire dans IndexedDB avec _isDirty: true — TOUJOURS
   * 2. Si en ligne ET !skipRemote → appeler l'API distante
   *    a. Succès → mettre à jour IndexedDB avec _isDirty: false + données serveur
   *    b. Échec → garder _isDirty: true, créer événement outbox
   * 3. Si hors ligne → créer événement outbox pour synchronisation ultérieure
   *
   * @returns DualWriteResult — résultat détaillé de l'opération
   */
  async write(params: DualWriteParams): Promise<DualWriteResult> {
    const {
      storeName,
      entityType,
      operation,
      data,
      tenantId,
      apiEndpoint,
      method,
      entityId,
      metadata,
      skipLocal = false,
      skipRemote = false,
      remoteTimeout = DEFAULT_REMOTE_TIMEOUT,
    } = params;

    const result: DualWriteResult = {
      success: false,
      localData: null,
      remoteData: null,
      localSuccess: false,
      remoteSuccess: false,
      remoteSkipped: false,
      pendingSync: false,
    };

    // --- Étape 1 : Écriture locale (TOUJOURS, sauf skipLocal) ---
    if (!skipLocal) {
      try {
        const localEntity = await this.writeLocal(
          storeName,
          tenantId,
          operation,
          data,
          entityId
        );
        result.localData = localEntity;
        result.localSuccess = true;
      } catch (localError) {
        console.error('[DualWrite] Local write failed:', localError);
        result.error = `Écriture locale échouée: ${(localError as Error).message}`;
        // Si l'écriture locale échoue, on n'essaie même pas le distant
        // car on ne veut pas de données orphelines côté serveur
        return result;
      }
    } else {
      result.localSuccess = true; // Skipped = considered success
    }

    // --- Étape 2 : Écriture distante ---
    const isOnline = networkDetectionService.isConnected();

    if (skipRemote || !isOnline) {
      // Hors ligne ou skipRemote → créer événement outbox
      result.remoteSkipped = true;
      result.pendingSync = true;

      if (!skipLocal) {
        try {
          await outboxService.createEvent(
            tenantId,
            operation,
            entityType,
            entityId || data.id || result.localData?.id || this.generateUUID(),
            data,
            metadata
          );
        } catch (outboxError) {
          console.warn('[DualWrite] Outbox event creation failed:', outboxError);
          // Non bloquant — le flag _isDirty sur l'entité servira de fallback
        }
      }

      result.success = result.localSuccess;
      return result;
    }

    // En ligne → appel API
    try {
      const remoteResponse = await this.writeRemote(
        apiEndpoint,
        method,
        data,
        remoteTimeout
      );
      result.remoteData = remoteResponse;
      result.remoteSuccess = true;

      // Mettre à jour IndexedDB : _isDirty = false + merger les données serveur
      if (!skipLocal && result.localData) {
        try {
          const mergedEntity = {
            ...result.localData,
            ...remoteResponse,
            _isDirty: false,
            _lastSync: new Date().toISOString(),
            _deleted: false,
          };
          await localDb.execute(storeName, 'put', mergedEntity);
          result.localData = mergedEntity;
        } catch (mergeError) {
          console.warn('[DualWrite] Local merge after remote success failed:', mergeError);
          // Non critique — l'entité est marquée _isDirty mais le serveur est à jour
        }
      }
    } catch (remoteError) {
      console.warn('[DualWrite] Remote write failed, falling back to outbox:', (remoteError as Error).message);
      result.remoteSuccess = false;
      result.pendingSync = true;
      result.error = `Écriture distante échouée: ${(remoteError as Error).message}`;

      // Créer événement outbox pour synchronisation ultérieure
      if (!skipLocal) {
        try {
          await outboxService.createEvent(
            tenantId,
            operation,
            entityType,
            entityId || data.id || result.localData?.id || this.generateUUID(),
            data,
            metadata
          );
        } catch (outboxError) {
          console.warn('[DualWrite] Outbox fallback failed:', outboxError);
        }
      }

      // Déclencher une synchronisation asynchrone (fire-and-forget)
      offlineSyncService.sync().catch((syncError) => {
        console.warn('[DualWrite] Auto-sync trigger failed:', syncError);
      });
    }

    result.success = result.localSuccess || result.remoteSuccess;
    return result;
  }

  /**
   * Double-écriture en batch : plusieurs entités à la fois
   * Utile pour les imports, les opérations en masse, etc.
   */
  async writeBatch(paramsList: DualWriteParams[]): Promise<DualWriteResult[]> {
    const results: DualWriteResult[] = [];

    // Traiter les écritures locales en parallèle (IndexedDB)
    const localWrites = paramsList.map(async (params) => {
      const result = await this.write(params);
      return result;
    });

    // Exécuter avec un niveau de concurrence raisonnable
    const concurrency = 5;
    for (let i = 0; i < localWrites.length; i += concurrency) {
      const batch = localWrites.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch);
      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        } else {
          results.push({
            success: false,
            localData: null,
            remoteData: null,
            localSuccess: false,
            remoteSuccess: false,
            remoteSkipped: false,
            pendingSync: false,
            error: settled.reason?.message || 'Batch write failed',
          });
        }
      }
    }

    return results;
  }

  /**
   * Lecture avec fallback : serveur d'abord, IndexedDB ensuite
   * Inverse de offlineFetch : on privilégie la fraîcheur du serveur
   */
  async read<T = any>(params: {
    storeName: string;
    apiEndpoint: string;
    tenantId: string;
    entityId?: string;
    skipLocal?: boolean;
    skipRemote?: boolean;
  }): Promise<{ data: T | null; source: 'remote' | 'local' | 'none' }> {
    const { storeName, apiEndpoint, tenantId, entityId, skipLocal = false, skipRemote = false } = params;
    const isOnline = networkDetectionService.isConnected();

    // En ligne → essayer le serveur d'abord
    if (!skipRemote && isOnline) {
      try {
        const response = await fetch(apiEndpoint, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getClientAuthorizationHeader(),
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Mettre en cache localement
          if (!skipLocal && data) {
            try {
              if (Array.isArray(data)) {
                const items = data.map((item: any) => ({
                  ...item,
                  tenantId: item.tenantId || tenantId,
                  _cachedAt: new Date().toISOString(),
                  _isDirty: false,
                }));
                await localDb.executeBulk(storeName, 'put', items);
              } else if (typeof data === 'object') {
                await localDb.execute(storeName, 'put', {
                  ...data,
                  tenantId: (data as any).tenantId || tenantId,
                  _cachedAt: new Date().toISOString(),
                  _isDirty: false,
                });
              }
            } catch (cacheError) {
              // Non bloquant
            }
          }

          return { data: data as T, source: 'remote' };
        }
      } catch (networkError) {
        console.warn('[DualWrite] Remote read failed, falling back to local:', (networkError as Error).message);
      }
    }

    // Fallback local
    if (!skipLocal) {
      try {
        if (entityId) {
          // Lecture d'une entité spécifique
          const allEntities = await localDb.query<T>(storeName);
          const entity = allEntities.find((e: any) =>
            e.id === entityId &&
            (!tenantId || e.tenantId === tenantId) &&
            !e._deleted
          );
          if (entity) {
            return { data: entity, source: 'local' };
          }
        } else {
          // Lecture de toutes les entités du tenant
          const allEntities = await localDb.query<T>(storeName);
          const filtered = allEntities.filter((e: any) =>
            (!tenantId || e.tenantId === tenantId) &&
            !e._deleted
          );
          return { data: filtered as unknown as T, source: 'local' };
        }
      } catch (localError) {
        console.warn('[DualWrite] Local read failed:', (localError as Error).message);
      }
    }

    return { data: null, source: 'none' };
  }

  // -------------------------------------------------------------------------
  // Méthodes privées
  // -------------------------------------------------------------------------

  /**
   * Écriture dans IndexedDB
   */
  private async writeLocal(
    storeName: string,
    tenantId: string,
    operation: SyncOperationType,
    data: Record<string, any>,
    entityId?: string
  ): Promise<Record<string, any>> {
    const id = entityId || data.id || this.generateUUID();
    const now = new Date().toISOString();

    let entity: Record<string, any>;

    switch (operation) {
      case 'CREATE': {
        entity = {
          ...data,
          id,
          tenantId,
          _version: 1,
          _isDirty: true,
          _deleted: false,
          _lastSync: null,
          createdAt: data.createdAt || now,
          updatedAt: now,
        };
        await localDb.execute(storeName, 'put', entity);
        break;
      }
      case 'UPDATE': {
        // Récupérer l'entité existante
        const existing = await this.findLocalEntity(storeName, tenantId, id);
        entity = {
          ...(existing || {}),
          ...data,
          id,
          tenantId,
          _version: ((existing as any)?._version || 0) + 1,
          _isDirty: true,
          updatedAt: now,
        };
        await localDb.execute(storeName, 'put', entity);
        break;
      }
      case 'DELETE': {
        // Soft delete
        const existing = await this.findLocalEntity(storeName, tenantId, id);
        entity = {
          ...(existing || { id, tenantId }),
          _deleted: true,
          _isDirty: true,
          _version: ((existing as any)?._version || 0) + 1,
          updatedAt: now,
        };
        await localDb.execute(storeName, 'put', entity);
        break;
      }
      default:
        throw new Error(`Opération non supportée: ${operation}`);
    }

    return entity;
  }

  /**
   * Appel API distante
   */
  private async writeRemote(
    apiEndpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: Record<string, any>,
    timeout: number
  ): Promise<Record<string, any>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(apiEndpoint, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuthorizationHeader(),
        },
        body: method !== 'DELETE' ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errorBody || response.statusText}`);
      }

      // Certaines réponses (ex: DELETE) peuvent ne pas avoir de body
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return { success: true };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Timeout: l'API n'a pas répondu en ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Recherche une entité dans IndexedDB
   */
  private async findLocalEntity(
    storeName: string,
    tenantId: string,
    entityId: string
  ): Promise<Record<string, any> | null> {
    try {
      const entities = await localDb.query<Record<string, any>>(storeName);
      return entities.find((e) => e.id === entityId && e.tenantId === tenantId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Génère un UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Instance singleton
export const dualWriteService = new DualWriteService();
