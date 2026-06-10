/**
 * Sync Service
 * 
 * Service pour la synchronisation entre Desktop (SQLite) et Web SaaS (PostgreSQL)
 * Utilise le Outbox Pattern pour garantir la cohérence
 */

import apiClient from '@/lib/api/client';
import type {
  SyncUpRequest,
  SyncUpResponse,
  SyncDownRequest,
  SyncDownResponse,
  SyncSummary,
  SyncLog,
} from '@/types';

/**
 * Synchronisation montante : Desktop → Server
 * 
 * Envoie les événements de l'Outbox locale vers le serveur
 */
export async function syncUp(request: SyncUpRequest): Promise<SyncUpResponse> {
  const response = await apiClient.post<SyncUpResponse>('/sync/up', request);
  return response.data;
}

/**
 * Synchronisation descendante : Server → Desktop
 * 
 * Récupère les changements serveur depuis la dernière synchronisation
 */
export async function syncDown(request: SyncDownRequest): Promise<SyncDownResponse> {
  const response = await apiClient.post<SyncDownResponse>('/sync/down', request);
  return response.data;
}

/**
 * Récupère le résumé de synchronisation
 */
export async function getSyncSummary(): Promise<SyncSummary> {
  const response = await apiClient.get<SyncSummary>('/sync/summary');
  return response.data;
}

/**
 * Récupère l'historique des synchronisations (journal)
 */
export async function getSyncLogs(limit = 50): Promise<SyncLog[]> {
  const response = await apiClient.get<SyncLog[]>('/sync/logs', {
    params: { limit },
  });
  return response.data;
}

/**
 * Résout un conflit en acceptant la version serveur
 */
export async function resolveConflict(
  outboxEventId: string,
  acceptServerVersion: boolean
): Promise<void> {
  await apiClient.post('/sync/resolve-conflict', {
    outboxEventId,
    acceptServerVersion,
  });
}

