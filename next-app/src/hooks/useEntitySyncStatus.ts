/**
 * ============================================================================
 * USE ENTITY SYNC STATUS HOOK
 * ============================================================================
 *
 * Hook React pour déterminer le statut de synchronisation d'une entité
 * spécifique (un élève, une classe, un paiement, etc.)
 *
 * Le statut est dérivé de deux sources :
 * 1. Les champs internes de l'entité dans IndexedDB (_isDirty, _lastSync)
 * 2. Les événements dans l'outbox (PENDING / FAILED / CONFLICT)
 *
 * États possibles :
 * - SYNCED   : Entité synchronisée avec le serveur
 * - PENDING  : Modification locale en attente de synchronisation
 * - CONFLICT : Conflit détecté entre version locale et serveur
 * - ERROR    : Erreur de synchronisation
 * - UNKNOWN  : Impossible de déterminer le statut (entité pas encore dans IndexedDB)
 */

'use client';

import { useState, useEffect } from 'react';
import { localDb } from '@/lib/offline/local-db.service';
import { outboxService } from '@/lib/offline/outbox.service';
import type { SyncEntityType, OutboxEventStatus } from '@/types';

export type EntitySyncStatus = 'SYNCED' | 'PENDING' | 'CONFLICT' | 'ERROR' | 'UNKNOWN';

interface EntitySyncInfo {
  status: EntitySyncStatus;
  lastSync: string | null;
  pendingOperation: 'CREATE' | 'UPDATE' | 'DELETE' | null;
  errorMessage: string | null;
  isDirty: boolean;
}

interface UseEntitySyncStatusOptions {
  /** ID de l'entité à vérifier */
  entityId: string;
  /** Type d'entité (ex: 'STUDENT', 'EXAM') */
  entityType: SyncEntityType;
  /** ID du tenant */
  tenantId?: string;
  /** Intervalle de rafraîchissement en ms (défaut: 10000) */
  refreshInterval?: number;
}

const DEFAULT_REFRESH_INTERVAL = 10000; // 10 secondes

/**
 * Hook pour obtenir le statut de synchronisation d'une entité spécifique.
 *
 * @example
 * ```tsx
 * const { status, lastSync, isDirty } = useEntitySyncStatus({
 *   entityId: student.id,
 *   entityType: 'STUDENT',
 *   tenantId: tenant.id,
 * });
 *
 * return (
 *   <tr>
 *     <td>{student.firstName}</td>
 *     <td><EntitySyncIndicator status={status} lastSync={lastSync} /></td>
 *   </tr>
 * );
 * ```
 */
export function useEntitySyncStatus({
  entityId,
  entityType,
  tenantId,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
}: UseEntitySyncStatusOptions): EntitySyncInfo {
  const [info, setInfo] = useState<EntitySyncInfo>({
    status: 'UNKNOWN',
    lastSync: null,
    pendingOperation: null,
    errorMessage: null,
    isDirty: false,
  });

  const checkStatus = async () => {
    try {
      // 1. Vérifier l'outbox pour les événements liés à cette entité
      const outboxEvents = await localDb.query<{
        entityId: string;
        entityType: string;
        status: OutboxEventStatus;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        errorMessage?: string;
        tenantId: string;
      }>('outbox_events');

      const relevantEvents = outboxEvents.filter(
        (e) => e.entityId === entityId && e.entityType === entityType
      );

      // Filtrer par tenant si fourni
      const tenantEvents = tenantId
        ? relevantEvents.filter((e) => e.tenantId === tenantId)
        : relevantEvents;

      // Vérifier s'il y a un événement en conflit
      const conflictEvent = tenantEvents.find((e) => e.status === 'CONFLICT');
      if (conflictEvent) {
        setInfo({
          status: 'CONFLICT',
          lastSync: null,
          pendingOperation: conflictEvent.operation,
          errorMessage: conflictEvent.errorMessage || null,
          isDirty: true,
        });
        return;
      }

      // Vérifier s'il y a un événement en erreur
      const errorEvent = tenantEvents.find((e) => e.status === 'FAILED');
      if (errorEvent) {
        setInfo({
          status: 'ERROR',
          lastSync: null,
          pendingOperation: errorEvent.operation,
          errorMessage: errorEvent.errorMessage || null,
          isDirty: true,
        });
        return;
      }

      // Vérifier s'il y a un événement en attente
      const pendingEvent = tenantEvents.find((e) =>
        ['PENDING', 'SENT'].includes(e.status)
      );
      if (pendingEvent) {
        setInfo({
          status: 'PENDING',
          lastSync: null,
          pendingOperation: pendingEvent.operation,
          errorMessage: null,
          isDirty: true,
        });
        return;
      }

      // 2. Vérifier les champs internes de l'entité dans IndexedDB
      const storeName = `${entityType.toLowerCase()}s`;
      try {
        const entities = await localDb.query<{
          id: string;
          _isDirty?: boolean;
          _lastSync?: string | null;
          _deleted?: boolean;
          tenantId?: string;
        }>(storeName);

        const entity = entities.find((e) => e.id === entityId);

        if (entity) {
          // Filtrer par tenant si fourni
          if (tenantId && entity.tenantId && entity.tenantId !== tenantId) {
            setInfo({ status: 'UNKNOWN', lastSync: null, pendingOperation: null, errorMessage: null, isDirty: false });
            return;
          }

          if (entity._isDirty) {
            setInfo({
              status: 'PENDING',
              lastSync: entity._lastSync || null,
              pendingOperation: null,
              errorMessage: null,
              isDirty: true,
            });
            return;
          }

          setInfo({
            status: 'SYNCED',
            lastSync: entity._lastSync || null,
            pendingOperation: null,
            errorMessage: null,
            isDirty: false,
          });
          return;
        }
      } catch {
        // Le store n'existe peut-être pas dans IndexedDB
        // Ce n'est pas une erreur fatale — l'entité peut provenir du serveur directement
      }

      // 3. Si l'entité n'est pas dans IndexedDB et pas dans l'outbox,
      // elle provient probablement d'un fetch API récent → SYNCED
      setInfo({
        status: 'SYNCED',
        lastSync: null,
        pendingOperation: null,
        errorMessage: null,
        isDirty: false,
      });
    } catch (error) {
      console.warn('[useEntitySyncStatus] Error checking status:', error);
      setInfo((prev) => prev); // Garder le dernier état connu
    }
  };

  useEffect(() => {
    checkStatus();

    // Rafraîchir périodiquement
    const interval = setInterval(checkStatus, refreshInterval);

    // Écouter les événements de synchronisation pour rafraîchir immédiatement
    const handleSyncEnd = () => checkStatus();
    const handleNetworkChange = () => checkStatus();

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-end', handleSyncEnd);
      window.addEventListener('online', handleNetworkChange);
      window.addEventListener('offline', handleNetworkChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('sync-end', handleSyncEnd);
        window.removeEventListener('online', handleNetworkChange);
        window.removeEventListener('offline', handleNetworkChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType, tenantId, refreshInterval]);

  return info;
}

/**
 * Version allégée pour les listes : récupère le statut de synchronisation
 * de plusieurs entités en une seule passe (évite N appels IndexedDB).
 *
 * @example
 * ```tsx
 * const statuses = useEntitySyncStatusBatch('STUDENT', tenantId);
 * // statuses = { [entityId]: 'PENDING' | 'SYNCED' | ... }
 * ```
 */
export function useEntitySyncStatusBatch(
  entityType: SyncEntityType,
  tenantId?: string
): Record<string, EntitySyncStatus> {
  const [statuses, setStatuses] = useState<Record<string, EntitySyncStatus>>({});

  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const result: Record<string, EntitySyncStatus> = {};

        // 1. Charger tous les événements outbox pour ce type d'entité
        const outboxEvents = await localDb.query<{
          entityId: string;
          entityType: string;
          status: OutboxEventStatus;
          tenantId: string;
        }>('outbox_events');

        const entityEvents = outboxEvents.filter(
          (e) => e.entityType === entityType && (!tenantId || e.tenantId === tenantId)
        );

        // Map: entityId → statut outbox
        const outboxMap: Record<string, EntitySyncStatus> = {};
        for (const event of entityEvents) {
          if (event.status === 'CONFLICT') {
            outboxMap[event.entityId] = 'CONFLICT';
          } else if (event.status === 'FAILED') {
            outboxMap[event.entityId] = 'ERROR';
          } else if (['PENDING', 'SENT'].includes(event.status)) {
            outboxMap[event.entityId] = 'PENDING';
          }
        }

        // 2. Charger les entités depuis IndexedDB pour vérifier _isDirty
        const storeName = `${entityType.toLowerCase()}s`;
        try {
          const entities = await localDb.query<{
            id: string;
            _isDirty?: boolean;
            tenantId?: string;
          }>(storeName);

          const tenantEntities = tenantId
            ? entities.filter((e) => e.tenantId === tenantId)
            : entities;

          for (const entity of tenantEntities) {
            if (outboxMap[entity.id]) {
              result[entity.id] = outboxMap[entity.id];
            } else if (entity._isDirty) {
              result[entity.id] = 'PENDING';
            } else {
              result[entity.id] = 'SYNCED';
            }
          }
        } catch {
          // Store n'existe pas — toutes les entités sont SYNCED
        }

        // Ajouter les entités de l'outbox qui ne sont pas dans le store local
        for (const [id, status] of Object.entries(outboxMap)) {
          if (!result[id]) {
            result[id] = status;
          }
        }

        setStatuses(result);
      } catch (error) {
        console.warn('[useEntitySyncStatusBatch] Error:', error);
      }
    };

    loadStatuses();

    const handleSyncEnd = () => loadStatuses();
    const handleNetworkChange = () => loadStatuses();

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-end', handleSyncEnd);
      window.addEventListener('online', handleNetworkChange);
    }

    // Rafraîchir toutes les 15 secondes
    const interval = setInterval(loadStatuses, 15000);

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('sync-end', handleSyncEnd);
        window.removeEventListener('online', handleNetworkChange);
      }
    };
  }, [entityType, tenantId]);

  return statuses;
}
