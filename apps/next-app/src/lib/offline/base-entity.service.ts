/**
 * ============================================================================
 * BASE ENTITY SERVICE — Service de base abstrait pour tous les modules
 * ============================================================================
 *
 * PRINCIPE : Un seul pattern d'accès aux données pour TOUS les modules.
 * Chaque module (Students, HR, Finance, etc.) étend cette classe de base
 * et hérite automatiquement du double-écriture (IndexedDB + PostgreSQL).
 *
 * Garanties :
 *   - Toutes les opérations CRUD utilisent le DualWriteService
 *   - IndexedDB est TOUJOURS synchronisé avec PostgreSQL
 *   - Les modules existants n'ont pas besoin de modifier leur API publique
 *   - La migration est progressive et sans régression
 *
 * UTILISATION :
 *   class StudentsService extends BaseEntityService<Student> {
 *     constructor() {
 *       super({
 *         storeName: 'students',
 *         entityType: 'STUDENT',
 *         apiPrefix: '/api/students',
 *       });
 *     }
 *   }
 *
 *   const service = new StudentsService();
 *   const student = await service.create(tenantId, { firstName: 'Jean' });
 *   const students = await service.getAll(tenantId);
 *   const updated = await service.update(tenantId, student.id, { firstName: 'Pierre' });
 *   await service.delete(tenantId, student.id);
 * ============================================================================
 */

import { dualWriteService, type DualWriteResult } from './dual-write.service';
import { localDb } from './local-db.service';
import { offlineFetch } from './offline-fetch';
import type { SyncEntityType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BaseEntityConfig {
  /** Nom du store IndexedDB (ex: 'students') */
  storeName: string;
  /** Type d'entité pour le sync engine (ex: 'STUDENT') */
  entityType: SyncEntityType;
  /** Préfixe API (ex: '/api/students') */
  apiPrefix: string;
  /** Nom du module pour les logs (ex: 'Students') */
  moduleName?: string;
}

export interface BaseEntityReadOptions {
  /** Si true, forcer la lecture depuis le serveur (ignorer le cache) */
  forceRefresh?: boolean;
  /** Filtres additionnels pour la lecture locale */
  filters?: Record<string, any>;
  /** Si true, ne pas écrire en cache après lecture serveur */
  skipCache?: boolean;
}

// ---------------------------------------------------------------------------
// Service de base abstrait
// ---------------------------------------------------------------------------

export abstract class BaseEntityService<T extends Record<string, any>> {
  protected readonly config: BaseEntityConfig;

  constructor(config: BaseEntityConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // CRUD — Double-écriture automatique
  // -------------------------------------------------------------------------

  /**
   * Crée une nouvelle entité (double-écriture : IndexedDB + API)
   */
  async create(tenantId: string, data: Partial<T>, metadata?: Record<string, any>): Promise<DualWriteResult & { data: T }> {
    const result = await dualWriteService.write({
      storeName: this.config.storeName,
      entityType: this.config.entityType,
      operation: 'CREATE',
      data: data as Record<string, any>,
      tenantId,
      apiEndpoint: this.config.apiPrefix,
      method: 'POST',
      metadata,
    });

    return {
      ...result,
      data: (result.localData || result.remoteData || data) as T,
    };
  }

  /**
   * Met à jour une entité existante (double-écriture : IndexedDB + API)
   */
  async update(tenantId: string, entityId: string, data: Partial<T>, metadata?: Record<string, any>): Promise<DualWriteResult & { data: T }> {
    const result = await dualWriteService.write({
      storeName: this.config.storeName,
      entityType: this.config.entityType,
      operation: 'UPDATE',
      data: data as Record<string, any>,
      tenantId,
      apiEndpoint: `${this.config.apiPrefix}/${entityId}`,
      method: 'PUT',
      entityId,
      metadata,
    });

    return {
      ...result,
      data: (result.localData || result.remoteData || data) as T,
    };
  }

  /**
   * Supprime une entité (soft delete, double-écriture)
   */
  async delete(tenantId: string, entityId: string, metadata?: Record<string, any>): Promise<DualWriteResult> {
    return dualWriteService.write({
      storeName: this.config.storeName,
      entityType: this.config.entityType,
      operation: 'DELETE',
      data: { id: entityId },
      tenantId,
      apiEndpoint: `${this.config.apiPrefix}/${entityId}`,
      method: 'DELETE',
      entityId,
      metadata,
    });
  }

  /**
   * Récupère toutes les entités du tenant (serveur d'abord, local en fallback)
   */
  async getAll(tenantId: string, options?: BaseEntityReadOptions): Promise<T[]> {
    const { forceRefresh = false, filters, skipCache = false } = options || {};

    // Lecture via DualWriteService.read() — serveur d'abord, local ensuite
    const result = await dualWriteService.read<T[]>({
      storeName: this.config.storeName,
      apiEndpoint: this.config.apiPrefix,
      tenantId,
      skipLocal: forceRefresh,
      skipRemote: skipCache,
    });

    let data = result.data;

    // Fallback vers offlineFetch si DualWriteService.read() échoue
    if (!data && !forceRefresh) {
      try {
        data = await offlineFetch<T[]>(
          this.config.apiPrefix,
          this.config.storeName,
          { tenantId, skipCache }
        );
      } catch {
        // Dernier recours : lecture directe IndexedDB
        data = await this.getAllLocal(tenantId) as unknown as T[];
      }
    }

    // Appliquer les filtres
    if (data && filters && Array.isArray(data)) {
      data = data.filter((item: any) => {
        return Object.entries(filters).every(([key, value]) => {
          return item[key] === value;
        });
      });
    }

    return (data || []) as T[];
  }

  /**
   * Récupère une entité par ID (serveur d'abord, local en fallback)
   */
  async getById(tenantId: string, entityId: string, options?: BaseEntityReadOptions): Promise<T | null> {
    const { forceRefresh = false } = options || {};

    const result = await dualWriteService.read<T>({
      storeName: this.config.storeName,
      apiEndpoint: `${this.config.apiPrefix}/${entityId}`,
      tenantId,
      entityId,
      skipLocal: forceRefresh,
    });

    if (result.data) {
      return result.data;
    }

    // Fallback
    return this.getLocalById(tenantId, entityId);
  }

  // -------------------------------------------------------------------------
  // Accès local direct (IndexedDB)
  // -------------------------------------------------------------------------

  /**
   * Récupère toutes les entités du tenant depuis IndexedDB uniquement
   */
  async getAllLocal(tenantId: string): Promise<T[]> {
    try {
      const allEntities = await localDb.query<T>(this.config.storeName);
      return allEntities.filter((e: any) =>
        e.tenantId === tenantId && !e._deleted
      );
    } catch {
      return [];
    }
  }

  /**
   * Récupère une entité par ID depuis IndexedDB uniquement
   */
  async getLocalById(tenantId: string, entityId: string): Promise<T | null> {
    try {
      const entities = await localDb.query<T>(this.config.storeName);
      return entities.find((e: any) =>
        e.id === entityId && e.tenantId === tenantId && !e._deleted
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Compte les entités locales pour un tenant
   */
  async countLocal(tenantId: string): Promise<number> {
    const entities = await this.getAllLocal(tenantId);
    return entities.length;
  }

  /**
   * Compte les entités en attente de synchronisation (_isDirty = true)
   */
  async countPendingSync(tenantId: string): Promise<number> {
    try {
      const allEntities = await localDb.query<T>(this.config.storeName);
      return allEntities.filter((e: any) =>
        e.tenantId === tenantId && e._isDirty && !e._deleted
      ).length;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------------

  /**
   * Récupère le nom du module pour les logs
   */
  protected get logPrefix(): string {
    return `[${this.config.moduleName || this.config.entityType}]`;
  }
}
