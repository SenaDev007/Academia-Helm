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
import { idbStoreForEntityType } from '@/lib/offline/store-names';
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

const DEFAULT_REFRESH_INTERVAL = 60000; // ⭐ 60 secondes (était 10s — voir note anti-rechargement ci-dessous)

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

  // ⭐ FIX ANOMALIE 2 (propagation) : setInfo ne déclenche un re-render QUE si
  //    le statut a réellement changé. L'ancien code créait un NOUVEL objet à
  //    chaque interval (toutes les 10s) → les pages consommatrices (Élèves,
  //    Pédagogie, Finance, Admissions, Évaluations…) se re-rendaient en boucle
  //    même sans aucun changement → « rechargements intempestifs ».
  const setInfoIfChanged = (next: EntitySyncInfo) => {
    setInfo(prev => {
      if (
        prev.status === next.status &&
        prev.lastSync === next.lastSync &&
        prev.pendingOperation === next.pendingOperation &&
        prev.errorMessage === next.errorMessage &&
        prev.isDirty === next.isDirty
      ) {
        return prev; // même référence → React ne re-render pas
      }
      return next;
    });
  };

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
        setInfoIfChanged({
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
        setInfoIfChanged({
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
        setInfoIfChanged({
          status: 'PENDING',
          lastSync: null,
          pendingOperation: pendingEvent.operation,
          errorMessage: null,
          isDirty: true,
        });
        return;
      }

      // 2. Vérifier les champs internes de l'entité dans IndexedDB
      //    ⭐ V18 — store SINGULIER via idbStoreForEntityType (même règle que le
      //    write-path offline-business.service). AVANT : `${type.toLowerCase()}s`
      //    (pluriel — ex 'students') ne correspondait à AUCUN store créé : la
      //    détection _isDirty échouait silencieusement pour TOUTES les entités.
      const storeName = idbStoreForEntityType(entityType);
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
            setInfoIfChanged({ status: 'UNKNOWN', lastSync: null, pendingOperation: null, errorMessage: null, isDirty: false });
            return;
          }

          if (entity._isDirty) {
            setInfoIfChanged({
              status: 'PENDING',
              lastSync: entity._lastSync || null,
              pendingOperation: null,
              errorMessage: null,
              isDirty: true,
            });
            return;
          }

          setInfoIfChanged({
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
      setInfoIfChanged({
        status: 'SYNCED',
        lastSync: null,
        pendingOperation: null,
        errorMessage: null,
        isDirty: false,
      });
    } catch (error) {
      // ⭐ On garde le dernier état connu — pas de setState inutile (anti-re-render)
      console.warn('[useEntitySyncStatus] Error checking status:', error);
    }
  };

  useEffect(() => {
    checkStatus();

    // Rafraîchir périodiquement
    const interval = setInterval(checkStatus, refreshInterval);

    // Écouter les événements de synchronisation pour rafraîchir immédiatement
    const handleSyncEnd = () => checkStatus();
    const handleNetworkChange = () => checkStatus();
    // ⭐ V18 — 'outbox-changed' : dispatché à CHAQUE écriture/sync outbox → le
    //    badge « en attente de synchronisation » apparaît IMMÉDIATEMENT après
    //    une création/modification hors ligne (fini l'attente du poll 60 s).
    const handleOutboxChange = () => checkStatus();

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-end', handleSyncEnd);
      window.addEventListener('online', handleNetworkChange);
      window.addEventListener('offline', handleNetworkChange);
      window.addEventListener('outbox-changed', handleOutboxChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('sync-end', handleSyncEnd);
        window.removeEventListener('online', handleNetworkChange);
        window.removeEventListener('offline', handleNetworkChange);
        window.removeEventListener('outbox-changed', handleOutboxChange);
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
        //    ⭐ V18 — store SINGULIER via idbStoreForEntityType (cf. note du hook
        //    single — AVANT le store pluriel ne matchait aucun store réel).
        const storeName = idbStoreForEntityType(entityType);
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

        // ⭐ FIX ANOMALIE 2 (propagation) : ne re-render QUE si les statuts ont
        //    réellement changé — comparaison JSON évite les re-rendus en boucle
        //    toutes les 15 secondes sur les pages de listes.
        setStatuses(prev => {
          if (JSON.stringify(prev) === JSON.stringify(result)) return prev;
          return result;
        });
      } catch (error) {
        console.warn('[useEntitySyncStatusBatch] Error:', error);
      }
    };

    loadStatuses();

    const handleSyncEnd = () => loadStatuses();
    const handleNetworkChange = () => loadStatuses();
    // ⭐ V18 — idem hook single : rafraîchissement immédiat à chaque changement d'outbox
    const handleOutboxChange = () => loadStatuses();

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-end', handleSyncEnd);
      window.addEventListener('online', handleNetworkChange);
      window.addEventListener('outbox-changed', handleOutboxChange);
    }

    // Rafraîchir toutes les 60 secondes (⭐ était 15s — réduite : le statut est
    // de toute façon rafraîchi immédiatement via les événements sync-end)
    const interval = setInterval(loadStatuses, 60000);

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('sync-end', handleSyncEnd);
        window.removeEventListener('online', handleNetworkChange);
        window.removeEventListener('outbox-changed', handleOutboxChange);
      }
    };
  }, [entityType, tenantId]);

  return statuses;
}
