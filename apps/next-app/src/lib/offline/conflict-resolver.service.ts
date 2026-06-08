/**
 * Conflict Resolver Service
 * 
 * Service pour gérer et résoudre les conflits de données
 * identifiés lors de la synchronisation.
 * 
 * RÈGLE : Section 12 du Cahier Technique
 */

import { localDb } from './local-db.service';

export type ConflictResolutionStrategy = 
  | 'LAST_WRITE_WINS'
  | 'SERVER_WINS'
  | 'CLIENT_WINS'
  | 'MERGE_FIELDS';

class ConflictResolverService {
  /**
   * Résout un conflit détecté
   */
  async resolve(
    conflictId: string, 
    strategy: ConflictResolutionStrategy,
    manualData?: any
  ): Promise<boolean> {
    const conflicts = await localDb.query<any>('sync_conflicts');
    const conflict = conflicts.find((c: any) => c.id === conflictId);

    if (!conflict) return false;

    const localData = JSON.parse(conflict.local_data);
    const serverData = JSON.parse(conflict.server_data);
    const storeName = conflict.table_name;

    let resolvedData: any;

    switch (strategy) {
      case 'SERVER_WINS':
        resolvedData = serverData;
        break;
      case 'CLIENT_WINS':
        resolvedData = localData;
        break;
      case 'LAST_WRITE_WINS':
        const localTime = new Date(localData.updatedAt || 0).getTime();
        const serverTime = new Date(serverData.updatedAt || 0).getTime();
        resolvedData = localTime > serverTime ? localData : serverData;
        break;
      case 'MERGE_FIELDS':
        resolvedData = { ...serverData, ...localData };
        break;
      default:
        resolvedData = manualData || serverData;
    }

    try {
      // 1. Appliquer la résolution en base locale
      await localDb.execute(storeName, 'put', {
        ...resolvedData,
        _isDirty: false, // Résolu, donc plus "dirty" par rapport au serveur
        _lastSync: new Date().toISOString(),
      });

      // 2. Marquer le conflit comme résolu
      await localDb.execute('sync_conflicts', 'delete', conflictId);

      console.log(`[Conflict] Resolved ${conflictId} using ${strategy}`);
      return true;
    } catch (error) {
      console.error('[Conflict] Resolution failed:', error);
      return false;
    }
  }

  /**
   * Récupère la liste des conflits en attente
   */
  async getPendingConflicts(): Promise<any[]> {
    return await localDb.query('sync_conflicts');
  }
}

export const conflictResolverService = new ConflictResolverService();
