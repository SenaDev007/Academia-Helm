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
  const storeName = `${entityType.toLowerCase()}s`;
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
 */
export async function updateEntityOffline<T extends Record<string, any> & { id: string }>(
  tenantId: string,
  entityType: SyncEntityType,
  entityId: string,
  updates: Partial<T>,
  metadata?: any
): Promise<T> {
  // 1. Récupérer l'entité locale
  const storeName = `${entityType.toLowerCase()}s`;
  const entities = await localDb.query<T & { _version: number }>(storeName);
  const entity = entities.find((e: any) => e.id === entityId);

  if (!entity) {
    throw new Error(`Entity ${entityType} with id ${entityId} not found`);
  }

  // 2. Mettre à jour dans SQLite local
  const updated = {
    ...entity,
    ...updates,
    _version: ((entity as any)._version || 1) + 1,
    _isDirty: true,
    updatedAt: new Date().toISOString(),
  };

  await localDb.execute(storeName, 'put', updated);

  // 3. Créer un événement dans l'outbox
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
  const storeName = `${entityType.toLowerCase()}s`;
  const entities = await localDb.query(storeName);
  const entity = entities.find((e: any) => e.id === entityId);

  if (!entity) {
    throw new Error(`Entity ${entityType} with id ${entityId} not found`);
  }

  // 2. Soft delete dans SQLite local
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

