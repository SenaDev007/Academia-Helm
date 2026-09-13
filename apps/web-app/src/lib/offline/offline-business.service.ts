/**
 * Offline Business Service
 * 
 * Service pour gérer les opérations métier en mode offline-first
 * 
 * PRINCIPE : Toute action utilisateur écrit d'abord dans SQLite local,
 * puis génère un événement dans l'outbox
 */

import { localDb } from './local-db.service';
import { outboxService } from './outbox.service';
import { offlineSyncService } from './offline-sync.service';
import { networkDetectionService } from './network-detection.service';
import { idbStoreForEntityType } from './store-names';
import type { SyncEntityType, SyncOperationType } from '@/types';

/**
 * Crée une entité en mode offline-first
 */
export async function createEntityOffline<T extends { id?: string; createdAt?: string; updatedAt?: string }>(
  tenantId: string,
  entityType: SyncEntityType,
  entityData: T,
  metadata?: any
): Promise<T> {
  // 1. Générer un ID si absent
  const entityId = entityData.id || generateUUID();
  const entity = { ...entityData, id: entityId };

  // 2. Écrire dans la base locale (put = upsert, évite ConstraintError si l'entité existe déjà)
  //    ⭐ FIX (sept. 2026) : store SINGULIER via idbStoreForEntityType — avant, le
  //    store pluriel (« students ») ne correspondait pas au chemin de lecture
  //    (« student ») → la création hors ligne n'apparaissait pas dans l'UI.
  const storeName = idbStoreForEntityType(entityType);
  await localDb.execute(storeName, 'put', {
    ...entity,
    tenantId,
    _version: 1,
    _isDirty: true,
    _deleted: false,
    _lastSync: null,
    createdAt: (entity as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 3. Créer un événement dans l'outbox
  await outboxService.createEvent(
    tenantId,
    'CREATE',
    entityType,
    entityId,
    entity,
    metadata
  );

  // 4. Si online, lancer la synchronisation (async, ne pas attendre)
  if (networkDetectionService.isConnected()) {
    offlineSyncService.sync().catch(error => {
      console.error('Auto-sync failed:', error);
    });
  }

  return entity as T;
}

/**
 * Met à jour une entité en mode offline-first
 * ⭐ V18 — UPSERT : si l'entité n'existe pas encore dans le store local (ex:
 *    liste paginée jamais cachée dans les stores entités, édition d'un élève
 *    consulté pour la 1re fois hors ligne…), on CRÉE l'enregistrement local
 *    à partir du corps de la requête (le PUT envoie l'objet complet) au lieu
 *    d'échouer « Entity not found » — l'écriture n'est jamais perdue.
 */
export async function updateEntityOffline<T extends Record<string, any> & { id?: string }>(
  tenantId: string,
  entityType: SyncEntityType,
  entityId: string,
  updates: Partial<T>,
  metadata?: any
): Promise<T> {
  // 1. Récupérer l'entité locale
  const storeName = idbStoreForEntityType(entityType);
  const entities = await localDb.query<T & { id: string; _version: number }>(storeName);
  const entity = entities.find((e: any) => e.id === entityId);

  // 2. Mettre à jour dans la base locale (upsert — cf. commentaire V18)
  const base = entity ?? {
    id: entityId,
    ...(updates as any),
  };
  const updated = {
    ...base,
    ...updates,
    id: entityId,
    tenantId,
    _version: ((entity as any)?._version || 0) + 1,
    _isDirty: true,
    updatedAt: new Date().toISOString(),
  };

  await localDb.execute(storeName, 'put', updated);

  // 3. Créer un événement dans l'outbox (⭐ V18 : metadata porte la requête
  //    d'origine { url, method, body } pour un replay exact à la reconnexion)
  await outboxService.createEvent(
    tenantId,
    'UPDATE',
    entityType,
    entityId,
    updated,
    metadata
  );

  // 4. Si online, lancer la synchronisation (async)
  if (networkDetectionService.isConnected()) {
    offlineSyncService.sync().catch(error => {
      console.error('Auto-sync failed:', error);
    });
  }

  return updated as T;
}

/**
 * Supprime une entité en mode offline-first
 */
export async function deleteEntityOffline(
  tenantId: string,
  entityType: SyncEntityType,
  entityId: string,
  metadata?: any
): Promise<void> {
  // 1. Récupérer l'entité locale
  const storeName = idbStoreForEntityType(entityType);
  const entities = await localDb.query(storeName);
  const entity = entities.find((e: any) => e.id === entityId);

  if (!entity) {
    throw new Error(`Entity ${entityType} with id ${entityId} not found`);
  }

  // 2. Soft delete dans la base locale
  const updated = {
    ...entity,
    _deleted: true,
    _isDirty: true,
    _version: ((entity as any)._version || 1) + 1,
    updatedAt: new Date().toISOString(),
  };

  await localDb.execute(storeName, 'put', updated);

  // 3. Créer un événement dans l'outbox
  await outboxService.createEvent(
    tenantId,
    'DELETE',
    entityType,
    entityId,
    { id: entityId }, // Pour DELETE, seulement l'ID
    metadata
  );

  // 4. Si online, lancer la synchronisation (async)
  if (networkDetectionService.isConnected()) {
    offlineSyncService.sync().catch(error => {
      console.error('Auto-sync failed:', error);
    });
  }
}

/**
 * Génère un UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

