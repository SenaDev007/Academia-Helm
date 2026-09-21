/**
 * Outbox Service
 * 
 * Service pour gérer l'Outbox Pattern côté client
 * 
 * PRINCIPE : Toute action utilisateur génère un événement dans l'outbox
 * Aucun appel direct à l'API métier
 */

import { localDb } from './local-db.service';
import type { OutboxEvent, OutboxEventStatus, SyncOperationType, SyncEntityType } from '@/types';

// Adapter les types pour compatibilité
interface OutboxEventLocal {
  id: string;
  tenantId: string;
  schoolId?: string;
  patronatId?: string;
  academicYearId?: string;
  academicTermId?: string;
  userId?: string;
  module?: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: string | Record<string, any>; // JSON string ou object
  metadata?: string | Record<string, any>;
  status: OutboxEventStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  localVersion: number;
  lastAttemptAt?: string;
  attemptCount: number;
  serverEventId?: string;
  conflictStrategy: string;
}

class OutboxService {
  // ⭐ V18 — Événement DOM dispatché à CHAQUE changement d'état de l'outbox
  //    (création, sync, échec, conflit) : les hooks UI (useEntitySyncStatus,
  //    badge « en attente de synchronisation ») se rafraîchissent IMMÉDIATEMENT
  //    au lieu d'attendre le poll de 60 s.
  private notifyOutboxChanged(): void {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('outbox-changed'));
      }
    } catch { /* non-bloquant */ }
  }

  // ⭐ Entités critiques nécessitant MERGE_FIELDS au lieu de LAST_WRITE_WINS
  private static readonly CRITICAL_ENTITIES: Set<string> = new Set([
    'FINANCE_TRANSACTION', 'STUDENT_ACCOUNT', 'FEE_OVERRIDE', 'FEE_STRUCTURE',
    'PAYMENT', 'EXAM_SCORE', 'GRADE', 'REPORT_CARD', 'ATTENDANCE_RECORD', 'BULLETIN',
  ]);

  /** Retourne la stratégie de conflit appropriée pour l'entité */
  private getConflictStrategy(entityType: string): string {
    return OutboxService.CRITICAL_ENTITIES.has(entityType) ? 'MERGE_FIELDS' : 'LAST_WRITE_WINS';
  }

  /**
   * Crée un événement dans l'outbox
   */
  async createEvent(
    tenantId: string,
    eventType: SyncOperationType,
    entityType: SyncEntityType,
    entityId: string,
    payload: any,
    metadata?: any
  ): Promise<string> {
    const eventId = this.generateUUID();
    
    const event: OutboxEventLocal = {
      id: eventId,
      tenantId,
      schoolId: payload.schoolId,
      patronatId: payload.patronatId,
      academicYearId: payload.academicYearId,
      academicTermId: payload.academicTermId,
      userId: payload.userId,
      module: payload.module,
      entityType,
      entityId,
      operation: eventType,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : undefined,
      status: 'PENDING',
      priority: 0, // Sera calculé par le SyncEngine
      retryCount: 0,
      maxRetries: 10,
      attemptCount: 0,
      localVersion: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // ⭐ MERGE_FIELDS pour les entités critiques (Finance + Notes)
      //    au lieu de LAST_WRITE_WINS par défaut.
      conflictStrategy: this.getConflictStrategy(entityType),
    };

    await localDb.execute('outbox_events', 'put', event);

    // Mettre à jour le compteur d'événements en attente
    await this.updatePendingCount(tenantId);

    // ⭐ V18 — prévenir l'UI immédiatement (badge « en attente de sync »)
    this.notifyOutboxChanged();

    return eventId;
  }

  /**
   * Récupère les événements en attente
   */
  async getPendingEvents(tenantId: string, limit = 100): Promise<OutboxEvent[]> {
    const events = await localDb.query<OutboxEventLocal>('outbox_events');

    // Filtrer par tenant et statut, puis convertir au format OutboxEvent
    const pending = events
      .filter(e => e.tenantId === tenantId && e.status === 'PENDING')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, limit)
      .map(e => this.convertToOutboxEvent(e));

    return pending;
  }

  /**
   * ⭐ Retourne le nombre d'événements PENDING.
   *    Utilisé par le SyncButton pour afficher un badge.
   *
   *    FIX Task 74 (périmètre tenant) : accepte un tenantId optionnel.
   *    - Avec tenantId : ne compte QUE les événements du tenant connecté
   *      (cohérent avec getPendingEvents(tenantId) utilisé par le push).
   *    - Sans tenantId : compte tous les tenants (rétrocompatibilité).
   *
   *    Avant le fix : le badge comptait TOUTES les écoles (getPendingCount()
   *    sans filtre) tandis que le push ne trouvait que les événements du
   *    tenant résolu → symptôme « badge 1 modification / sync 0 sur 1 ».
   */
  async getPendingCount(tenantId?: string): Promise<number> {
    try {
      const events = await localDb.query<OutboxEventLocal>('outbox_events');
      if (!tenantId) {
        return events.filter(e => e.status === 'PENDING').length;
      }
      return events.filter(e => e.tenantId === tenantId && e.status === 'PENDING').length;
    } catch {
      return 0;
    }
  }

  /**
   * Convertit un événement local en OutboxEvent
   * ⭐ V18 : inclut `metadata` (requête d'origine { url, method, body } pour
   * le replay HTTP exact — cf. sync-engine.service.ts pushOutbox).
   */
  private convertToOutboxEvent(event: OutboxEventLocal): OutboxEvent {
    let parsedMetadata: any = undefined;
    if (event.metadata !== undefined && event.metadata !== null) {
      try {
        parsedMetadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
      } catch {
        parsedMetadata = undefined;
      }
    }
    return {
      id: event.id,
      tenantId: event.tenantId,
      entityType: event.entityType,
      entityId: event.entityId,
      operation: event.operation,
      payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
      metadata: parsedMetadata,
      localVersion: event.localVersion || Date.now(),
      createdAt: event.createdAt,
      lastAttemptAt: event.lastAttemptAt,
      attemptCount: event.attemptCount || 0,
      status: event.status,
      errorMessage: event.errorMessage,
    };
  }

  /**
   * Marque un événement comme synchronisé
   */
  async markAsSynced(eventId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) return;

    const updated: OutboxEventLocal = {
      ...event,
      status: 'ACKNOWLEDGED', // Utiliser ACKNOWLEDGED au lieu de SYNCED
      syncedAt: new Date().toISOString(),
    };

    await localDb.execute('outbox_events', 'put', updated);
    await this.updatePendingCount(event.tenantId);
    this.notifyOutboxChanged();
  }

  /**
   * Marque un événement comme échec
   */
  async markAsFailed(eventId: string, error: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) return;

    const updated: OutboxEventLocal = {
      ...event,
      status: 'FAILED',
      errorMessage: error,
      retryCount: (event.retryCount || 0) + 1,
      attemptCount: (event.attemptCount || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
    };

    await localDb.execute('outbox_events', 'put', updated);
    this.notifyOutboxChanged();
  }

  /**
   * ⭐ RÉCUPÉRATION (2026-09-21) : re-passe en PENDING les événements marqués
   * FAILED par l'ANCIEN bug de l'auto-sync (markAsFailed « Max retries
   * exceeded » après un échec TRANSITOIRE : serveur injoignable / 5xx / panne
   * réseau). Ces événements n'ont JAMAIS été refusés par le serveur — leur
   * « échec » était purement infrastructurel. Ils doivent être rejoués vers
   * Neon dès que le serveur est de retour, pas abandonnés (puis supprimés
   * par clearStaleEvents).
   *
   * Critères stricts de re-file :
   *  - status === 'FAILED' ;
   *  - errorMessage correspond à une cause TRANSITOIRE connue (max retries
   *    exceeded, 5xx, service indisponible, réseau…) — un refus MÉTIER
   *    (validation 4xx du serveur) n'est JAMAIS re-filé ;
   *  - événement de moins de 7 jours (au-delà : trop ancien pour être
   *    rejoué sans risque de conflit).
   *
   * Appelé une fois par session (initAutoSyncTrigger) avant la première sync.
   */
  async requeueTransientlyFailedEvents(tenantId: string): Promise<number> {
    let events: OutboxEventLocal[];
    try {
      events = await localDb.query<OutboxEventLocal>('outbox_events');
    } catch {
      return 0; // Base absente → rien à faire
    }

    const TRANSIENT_FAILURE_RE =
      /max retries exceeded|sync service unavailable|502|503|504|failed to fetch|load failed|network|push failed|sync request failed|timeout|délai/i;
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
    const now = Date.now();
    let requeued = 0;

    for (const event of events) {
      if (event.tenantId !== tenantId) continue;
      if (event.status !== 'FAILED') continue;
      if (!event.errorMessage || !TRANSIENT_FAILURE_RE.test(event.errorMessage)) continue;

      const age = now - (Date.parse(event.createdAt) || 0);
      if (age > MAX_AGE_MS) continue;

      await localDb.execute('outbox_events', 'put', {
        ...event,
        status: 'PENDING',
        errorMessage: null,
        retryCount: 0, // ⭐ reset : l'échec n'était pas de son fait
        lastAttemptAt: new Date().toISOString(),
      });
      requeued++;
    }

    if (requeued > 0) {
      console.log(`[Outbox] ${requeued} événement(s) FAILED transitoire(s) re-mis en file PENDING — ils seront synchronisés vers Neon`);
      await this.updatePendingCount(tenantId);
      this.notifyOutboxChanged();
    }
    return requeued;
  }

  /**
   * Marque un événement comme en conflit (serveur a une version plus récente)
   */
  async markAsConflict(eventId: string, reason?: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) return;

    const updated: OutboxEventLocal = {
      ...event,
      status: 'CONFLICT',
      errorMessage: reason,
      attemptCount: (event.attemptCount || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
    };

    await localDb.execute('outbox_events', 'put', updated);
    await this.updatePendingCount(event.tenantId);
    this.notifyOutboxChanged();
  }

  /**
   * Marque un événement comme en cours de synchronisation
   */
  async markAsSyncing(eventId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) return;

    const updated: OutboxEventLocal = {
      ...event,
      status: 'SENT', // Utiliser SENT au lieu de SYNCING
      lastAttemptAt: new Date().toISOString(),
      attemptCount: (event.attemptCount || 0) + 1,
    };

    await localDb.execute('outbox_events', 'put', updated);
    this.notifyOutboxChanged();
  }

  /**
   * Récupère un événement par ID
   */
  private async getEvent(eventId: string): Promise<OutboxEventLocal | null> {
    const events = await localDb.query<OutboxEventLocal>('outbox_events');
    return events.find(e => e.id === eventId) || null;
  }

  /**
   * Met à jour le compteur d'événements en attente
   */
  private async updatePendingCount(tenantId: string): Promise<void> {
    const events = await localDb.query<OutboxEventLocal>('outbox_events');
    const count = events.filter(e => e.tenantId === tenantId && e.status === 'PENDING').length;

    // Mettre à jour sync_state
    const syncStates = await localDb.query<any>('sync_state');
    const existingState = syncStates.find((s: any) => s.tenantId === tenantId);

    if (existingState) {
      await localDb.execute('sync_state', 'put', {
        ...existingState,
        pendingEventsCount: count,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await localDb.execute('sync_state', 'put', {
        tenantId,
        pendingEventsCount: count,
        lastSyncTimestamp: null,
        lastSyncSuccess: false,
        conflictCount: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Génère un UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Nettoie les événements obsolètes :
   * - ACKNOWLEDGED (déjà synchronisés) → supprimés
   * - FAILED avec retryCount >= maxRetries → supprimés
   * - PENDING plus anciens que maxAgeMs → supprimés
   * 
   * @param tenantId - ID du tenant
   * @param maxAgeMs - Âge maximum en ms pour les événements PENDING (défaut: 24h)
   */
  async clearStaleEvents(tenantId: string, maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const events = await localDb.query<OutboxEventLocal>('outbox_events');
    const now = Date.now();
    let cleaned = 0;

    for (const event of events) {
      if (event.tenantId !== tenantId) continue;

      const age = now - new Date(event.createdAt).getTime();
      const shouldRemove =
        event.status === 'ACKNOWLEDGED' ||
        event.status === 'SENT' || // Orphelins
        (event.status === 'FAILED' && event.retryCount >= event.maxRetries) ||
        (event.status === 'PENDING' && age > maxAgeMs) ||
        (event.status === 'CONFLICT' && age > maxAgeMs * 2); // Conflits : 48h

      if (shouldRemove) {
        await localDb.execute('outbox_events', 'delete', event.id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.updatePendingCount(tenantId);
    }

    return cleaned;
  }

  /**
   * Supprime TOUS les événements d'un tenant (reset complet)
   * Utilisé quand l'utilisateur veut forcer la réinitialisation du badge.
   */
  async clearAllEvents(tenantId: string): Promise<number> {
    const events = await localDb.query<OutboxEventLocal>('outbox_events');
    let count = 0;

    for (const event of events) {
      if (event.tenantId !== tenantId) continue;
      await localDb.execute('outbox_events', 'delete', event.id);
      count++;
    }

    if (count > 0) {
      await this.updatePendingCount(tenantId);
    }

    return count;
  }
}

export const outboxService = new OutboxService();

