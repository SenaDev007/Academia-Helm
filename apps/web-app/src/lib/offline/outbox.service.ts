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
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: string | Record<string, any>; // JSON string ou object
  metadata?: string | Record<string, any>;
  status: OutboxEventStatus;
  retryCount?: number;
  errorMessage?: string;
  createdAt: string;
  syncedAt?: string;
  localVersion?: number;
  lastAttemptAt?: string;
  attemptCount?: number;
  serverEventId?: string;
}

class OutboxService {
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
      entityType,
      entityId,
      operation: eventType,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : undefined,
      status: 'PENDING',
      retryCount: 0,
      attemptCount: 0,
      localVersion: Date.now(),
      createdAt: new Date().toISOString(),
    };

    await localDb.execute('outbox_events', 'add', event);

    // Mettre à jour le compteur d'événements en attente
    await this.updatePendingCount(tenantId);

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
   * Convertit un événement local en OutboxEvent
   */
  private convertToOutboxEvent(event: OutboxEventLocal): OutboxEvent {
    return {
      id: event.id,
      tenantId: event.tenantId,
      entityType: event.entityType,
      entityId: event.entityId,
      operation: event.operation,
      payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
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
      await localDb.execute('sync_state', 'add', {
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
}

export const outboxService = new OutboxService();

