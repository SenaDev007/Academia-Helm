/**
 * Sync Engine (ERP institutionnel)
 *
 * - Push : envoi des opérations pending vers POST /api/sync/push (batch max 100)
 * - Pull : récupération des entités modifiées depuis POST /api/sync/pull
 * - PostgreSQL = source de vérité, local = cache temporaire
 */

import { outboxService } from './outbox.service';
import { localDb } from './local-db.service';
import type { OutboxEvent, SyncEntityType, SyncOperationType } from '@/types';

const SYNC_API = '/api/sync';
const BATCH_SIZE = 100;
const SQLITE_VERSION = '1';

const ENTITY_TO_TABLE: Record<string, string> = {
  STUDENT: 'students',
  TEACHER: 'teachers',
  CLASS: 'classes',
  PAYMENT: 'payments',
  EXAM: 'exams',
  GRADE: 'grades',
  ATTENDANCE: 'attendance',
  ABSENCE: 'absences',
  ACADEMIC_YEAR: 'academic_years',
  SCHOOL_LEVEL: 'school_levels',
};

const OP_MAP: Record<SyncOperationType, 'INSERT' | 'UPDATE' | 'DELETE'> = {
  CREATE: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  errorMessage: string | null;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function clientBearerHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem('accessToken');
  const t = raw?.trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...clientBearerHeaders(),
          ...options.headers,
        },
      });
      if (res.ok || res.status < 500 || attempt === MAX_RETRIES) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error('Sync request failed');
}

/**
 * Récupère le hash du schéma serveur (pour validation push)
 */
async function getSchemaHash(): Promise<{ hash: string }> {
  const res = await fetchWithAuth(`${SYNC_API}/schema-hash`);
  if (!res.ok) throw new Error('Schema hash unavailable');
  return res.json();
}

/**
 * Récupère la dernière date de sync pour un tenant
 */
async function getLastSyncTimestamp(tenantId: string): Promise<string | null> {
  const states = await localDb.query<{ tenantId: string; lastSyncTimestamp: string | null }>('sync_state');
  const s = states.find((x) => x.tenantId === tenantId);
  return s?.lastSyncTimestamp ?? null;
}

/**
 * Enregistre la dernière date de sync
 */
async function setLastSyncTimestamp(tenantId: string, iso: string): Promise<void> {
  const states = await localDb.query<any>('sync_state');
  const existing = states.find((s: any) => s.tenantId === tenantId);
  if (existing) {
    await localDb.execute('sync_state', 'put', {
      ...existing,
      lastSyncTimestamp: iso,
      lastSyncSuccess: true,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await localDb.execute('sync_state', 'add', {
      tenantId,
      lastSyncTimestamp: iso,
      lastSyncSuccess: true,
      pendingEventsCount: 0,
      conflictCount: 0,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Convertit un événement outbox en opération attendue par le backend (spec ERP)
 */
function toBackendOperation(event: OutboxEvent, deviceId?: string) {
  const tableName = ENTITY_TO_TABLE[event.entityType] || event.entityType.toLowerCase() + 's';
  const operationType = OP_MAP[event.operation];
  const payload = {
    ...event.payload,
    tenantId: event.tenantId,
    version: event.localVersion ?? 1,
  };
  return {
    id: event.id,
    table_name: tableName,
    record_id: event.entityId,
    operation_type: operationType,
    payload,
    local_updated_at: event.createdAt,
    device_id: deviceId,
  };
}

/**
 * Lance la synchronisation (push puis pull) pour un tenant
 */
export async function runSync(tenantId: string, deviceId?: string): Promise<{
  success: boolean;
  pushed: number;
  conflicts: number;
  errors: number;
  pulled: { students: number; studentEnrollments: number; payments: number };
}> {
  const result = {
    success: false,
    pushed: 0,
    conflicts: 0,
    errors: 0,
    pulled: { students: 0, studentEnrollments: 0, payments: 0 },
  };

  const { hash } = await getSchemaHash();
  const pending = await outboxService.getPendingEvents(tenantId, BATCH_SIZE);
  if (pending.length > 0) {
    const body = {
      tenantId,
      sqliteSchemaHash: hash,
      sqliteVersion: SQLITE_VERSION,
      device_id: deviceId,
      operations: pending.map((e) => toBackendOperation(e, deviceId)),
    };
    const pushRes = await fetchWithAuth(`${SYNC_API}/push`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const pushData = await pushRes.json().catch(() => ({}));

    if (!pushRes.ok) {
      throw new Error(pushData?.message || pushData?.error || 'Push failed');
    }

    result.pushed = pushData.successful_operations ?? 0;
    result.conflicts = pushData.conflicted_operations ?? 0;
    result.errors = pushData.failed_operations ?? 0;

    const results = pushData.results || [];
    const pendingById = new Map(pending.map((e) => [e.id, e]));
    for (const r of results) {
      const eventId = r.operation_id;
      const ev = pendingById.get(eventId);
      if (r.status === 'SUCCESS') {
        await outboxService.markAsSynced(eventId);
      } else if (r.status === 'CONFLICT') {
        await outboxService.markAsConflict(eventId, r.conflict_reason || 'Conflit');
        try {
          await localDb.execute('sync_conflicts', 'add', {
            id: `conflict-${eventId}-${Date.now()}`,
            table_name: ev?.entityType ?? 'unknown',
            local_data: JSON.stringify(ev?.payload ?? {}),
            server_data: JSON.stringify(r.server_data ?? {}),
            detected_at: new Date().toISOString(),
          });
        } catch (_) { /* store peut ne pas exister en v2 */ }
      } else {
        await outboxService.markAsFailed(eventId, r.error_message || 'Erreur');
      }
    }
  }

  const lastSync = await getLastSyncTimestamp(tenantId);
  const lastSyncAt = lastSync || '1970-01-01T00:00:00.000Z';
  const pullRes = await fetchWithAuth(`${SYNC_API}/pull`, {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: tenantId,
      last_sync_at: lastSyncAt,
      device_id: deviceId,
    }),
  });
  const pullData = await pullRes.json().catch(() => ({}));

  if (pullRes.ok && pullData.entities) {
    result.pulled.students = pullData.entities.students?.length ?? 0;
    result.pulled.studentEnrollments = pullData.entities.studentEnrollments?.length ?? 0;
    result.pulled.payments = pullData.entities.payments?.length ?? 0;
    const pulledAt = pullData.pulled_at || new Date().toISOString();
    await setLastSyncTimestamp(tenantId, pulledAt);
  }

  result.success = result.errors === 0 && result.conflicts === 0;
  return result;
}

/**
 * Vérifie si l'app est en ligne (navigator + ping optionnel)
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine === true;
}

/**
 * Récupère l'état de sync pour un tenant (pour barre d'état)
 */
export async function getSyncState(tenantId: string): Promise<SyncState> {
  const states = await localDb.query<any>('sync_state');
  const s = states.find((x: any) => x.tenantId === tenantId);
  const events = await localDb.query<{ status: string }>('outbox_events');
  const pendingCount = events.filter(
    (e: any) => e.tenantId === tenantId && e.status === 'PENDING'
  ).length;

  return {
    status: 'idle',
    lastSyncAt: s?.lastSyncTimestamp ?? null,
    pendingCount,
    errorMessage: null,
  };
}

export const syncEngine = {
  runSync,
  isOnline,
  getSyncState,
  getLastSyncTimestamp,
  BATCH_SIZE,
};
