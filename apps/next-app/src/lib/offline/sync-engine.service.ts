/**
 * Sync Engine (ERP institutionnel)
 *
 * - Push : envoi des opérations pending vers POST /api/sync/push (batch max 100)
 * - Pull : récupération des entités modifiées depuis POST /api/sync/pull
 * - PostgreSQL = source de vérité, local = cache temporaire
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { outboxService } from './outbox.service';

/** Alias local (même comportement) — évite ReferenceError si un vieux bundle référence encore `clientBearerHeaders`. */
const clientBearerHeaders = getClientAuthorizationHeader;
import { localDb } from './local-db.service';
import type { OutboxEvent, SyncEntityType, SyncOperationType } from '@/types';

const SYNC_API = '/api/sync';
const BATCH_SIZE = 100;
const SQLITE_VERSION = '1';

const ENTITY_TO_TABLE: Record<SyncEntityType, string> = {
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
  SUBJECT: 'subjects',
  INVOICE: 'invoices',
  HOMEWORK: 'homeworks',
  INCIDENT: 'incidents',
  LOAN: 'loans',
  SESSION: 'sessions',
  MESSAGE: 'messages',
  NOTIFICATION: 'notifications',
  ALERT: 'alerts',
  REPORT: 'reports',
  ORION_ALERT: 'orion_alerts',
  EXAM_CANDIDATE: 'exam_candidates',
  EXAM_RESULT: 'exam_results',
  EXAM_PV: 'exam_pvs',
  PEDAGOGICAL_FILE: 'pedagogical_files',
  DISCIPLINARY_INCIDENT: 'disciplinary_incidents',
  CLASS_DIARY: 'class_diaries',
  LESSON_PLAN: 'lesson_plans',
  LESSON_JOURNAL: 'lesson_journals',
  LESSON_JOURNAL_ENTRY: 'lesson_journal_entries',
  WEEKLY_SEMAINIER: 'weekly_semainier_daily_entries',
  TEACHER_CLASS_ASSIGNMENT: 'teacher_class_assignments',
  HOMEWORK_ENTRY: 'homework_entries',
  ACADEMIC_SERIES: 'academic_series',
  SERIES_SUBJECT: 'series_subjects',
  TEACHER_PROFILE: 'teacher_profiles',
  PEDAGOGICAL_MATERIAL: 'pedagogical_materials',
  MATERIAL_STOCK: 'material_stocks',
  MATERIAL_MOVEMENT: 'material_movements',
  TEACHER_MATERIAL_ASSIGNMENT: 'teacher_material_assignments',
  FEE_STRUCTURE: 'fee_structures',
  EXPENSE: 'expenses',
  FINANCE_SETTING: 'finance_settings',
  SCHOOL_ACADEMIC_SETTING: 'school_academic_settings',
  // --- Nouvelles entités pour double-écriture complète ---
  // RH & Paie
  STAFF: 'staff',
  CONTRACT: 'contracts',
  LEAVE: 'leaves',
  PAYROLL: 'payrolls',
  PAYSHEET: 'paysheets',
  STAFF_DOCUMENT: 'staff_documents',
  // Communication
  SMS: 'sms_queue',
  EMAIL: 'email_queue',
  WHATSAPP_MESSAGE: 'whatsapp_messages',
  COMMUNICATION_TEMPLATE: 'communication_templates',
  // Présences & Emploi du temps
  ATTENDANCE_RECORD: 'attendance_records',
  TIMETABLE: 'timetables',
  TIMETABLE_SLOT: 'timetable_slots',
  // Examens & Bulletins
  EXAM_SCORE: 'exam_scores',
  REPORT_CARD: 'report_cards',
  REPORT_CARD_TEMPLATE: 'report_card_templates',
  // Réunions & Conseils
  MEETING: 'meetings',
  MEETING_DECISION: 'meeting_decisions',
  MEETING_MINUTE: 'meeting_minutes',
  COUNCIL_DECISION: 'council_decisions',
  // QHSE
  QHSE_INCIDENT: 'qhse_incidents',
  QHSE_AUDIT: 'qhse_audits',
  QHSE_RISK: 'qhse_risks',
  QHSE_ACTION: 'qhse_actions',
  // Paramètres & Configuration
  SCHOOL_SETTINGS: 'school_settings',
  SECURITY_SETTINGS: 'security_settings',
  ORION_SETTINGS: 'orion_settings',
  ATLAS_SETTINGS: 'atlas_settings',
  COMMUNICATION_SETTINGS: 'communication_settings',
  BILINGUAL_SETTINGS: 'bilingual_settings',
  OFFLINE_SYNC_SETTINGS: 'offline_sync_settings',
  PEDAGOGICAL_STRUCTURE: 'pedagogical_structure',
  TENANT_STAMP: 'tenant_stamps',
  TENANT_SIGNATURE: 'tenant_signatures',
  TENANT_FEATURE: 'tenant_features',
  ROLE: 'roles',
  PERMISSION: 'permissions',
  // Modules complémentaires
  LIBRARY_BOOK: 'library_books',
  LIBRARY_LOAN: 'library_loans',
  TRANSPORT_ROUTE: 'transport_routes',
  TRANSPORT_SUBSCRIPTION: 'transport_subscriptions',
  CANTEEN_MENU: 'canteen_menus',
  CANTEEN_SUBSCRIPTION: 'canteen_subscriptions',
  CANTEEN_MEAL: 'canteen_meals',
  INFIRMARY_RECORD: 'infirmary_records',
  INFIRMARY_VISIT: 'infirmary_visits',
  SHOP_PRODUCT: 'shop_products',
  SHOP_ORDER: 'shop_orders',
  EDUCAST_VIDEO: 'educast_videos',
  EDUCAST_PLAYLIST: 'educast_playlists',
  // Salles
  ROOM: 'rooms',
  // Agrégation
  AGGREGATION_RESULT: 'aggregation_results',
  AGGREGATION_SESSION: 'aggregation_sessions',
};

/**
 * Priorités de synchronisation (Section 10.4 du cahier technique)
 */
const ENTITY_PRIORITY: Record<SyncEntityType, number> = {
  ATTENDANCE: 100, // HIGH
  ABSENCE: 100,
  ATTENDANCE_RECORD: 100,
  GRADE: 100,
  EXAM: 100,
  EXAM_RESULT: 100,
  EXAM_PV: 100,
  EXAM_CANDIDATE: 100,
  EXAM_SCORE: 100,
  DISCIPLINARY_INCIDENT: 100,
  INCIDENT: 100,
  QHSE_INCIDENT: 100,
  PAYMENT: 90, // HIGH-ish
  PAYROLL: 90,
  PAYSHEET: 90,
  MESSAGE: 50, // MEDIUM
  NOTIFICATION: 50,
  ALERT: 50,
  ORION_ALERT: 50,
  REPORT: 50,
  HOMEWORK: 50,
  PEDAGOGICAL_FILE: 50,
  SESSION: 50,
  CLASS_DIARY: 50,
  LESSON_PLAN: 50,
  LESSON_JOURNAL: 50,
  LESSON_JOURNAL_ENTRY: 50,
  WEEKLY_SEMAINIER: 50,
  HOMEWORK_ENTRY: 50,
  SMS: 50,
  EMAIL: 50,
  WHATSAPP_MESSAGE: 50,
  COMMUNICATION_TEMPLATE: 50,
  TIMETABLE: 50,
  TIMETABLE_SLOT: 50,
  REPORT_CARD: 50,
  REPORT_CARD_TEMPLATE: 50,
  MEETING: 50,
  MEETING_DECISION: 50,
  MEETING_MINUTE: 50,
  COUNCIL_DECISION: 50,
  QHSE_AUDIT: 50,
  QHSE_RISK: 50,
  QHSE_ACTION: 50,
  SCHOOL_ACADEMIC_SETTING: 80, // HIGH — source of truth for exams module
  SCHOOL_SETTINGS: 70,
  SECURITY_SETTINGS: 70,
  ORION_SETTINGS: 60,
  ATLAS_SETTINGS: 60,
  COMMUNICATION_SETTINGS: 60,
  BILINGUAL_SETTINGS: 60,
  OFFLINE_SYNC_SETTINGS: 60,
  PEDAGOGICAL_STRUCTURE: 60,
  TENANT_STAMP: 60,
  TENANT_SIGNATURE: 60,
  TENANT_FEATURE: 60,
  INVOICE: 10, // LOW
  STUDENT: 10,
  TEACHER: 10,
  CLASS: 10,
  ACADEMIC_YEAR: 10,
  SCHOOL_LEVEL: 10,
  SUBJECT: 10,
  LOAN: 10,
  FEE_STRUCTURE: 10,
  EXPENSE: 10,
  FINANCE_SETTING: 10,
  TEACHER_CLASS_ASSIGNMENT: 10,
  ACADEMIC_SERIES: 10,
  SERIES_SUBJECT: 10,
  TEACHER_PROFILE: 10,
  PEDAGOGICAL_MATERIAL: 10,
  MATERIAL_STOCK: 10,
  MATERIAL_MOVEMENT: 10,
  TEACHER_MATERIAL_ASSIGNMENT: 10,
  // Nouvelles entités
  STAFF: 10,
  CONTRACT: 10,
  LEAVE: 40,
  STAFF_DOCUMENT: 10,
  ROLE: 20,
  PERMISSION: 20,
  ROOM: 10,
  // Modules complémentaires
  LIBRARY_BOOK: 10,
  LIBRARY_LOAN: 30,
  TRANSPORT_ROUTE: 10,
  TRANSPORT_SUBSCRIPTION: 30,
  CANTEEN_MENU: 10,
  CANTEEN_SUBSCRIPTION: 30,
  CANTEEN_MEAL: 40,
  INFIRMARY_RECORD: 40,
  INFIRMARY_VISIT: 50,
  SHOP_PRODUCT: 10,
  SHOP_ORDER: 30,
  EDUCAST_VIDEO: 10,
  EDUCAST_PLAYLIST: 10,
  AGGREGATION_RESULT: 20,
  AGGREGATION_SESSION: 20,
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
    await localDb.execute('sync_state', 'put', {
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
    priority: ENTITY_PRIORITY[event.entityType] || 0,
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
  pulled: Record<string, number>;
}> {
  const result = {
    success: false,
    pushed: 0,
    conflicts: 0,
    errors: 0,
    pulled: {} as Record<string, number>,
  };

  const { hash } = await getSchemaHash();
  
  // 1. PUSH (Envoyer les changements locaux)
  const pending = await outboxService.getPendingEvents(tenantId, BATCH_SIZE);
  
  // Trier par priorité avant l'envoi
  const sortedPending = [...pending].sort((a, b) => {
    const prioA = ENTITY_PRIORITY[a.entityType] || 0;
    const prioB = ENTITY_PRIORITY[b.entityType] || 0;
    return prioB - prioA; // Décroissant
  });

  if (sortedPending.length > 0) {
    const body = {
      tenantId,
      sqliteSchemaHash: hash,
      sqliteVersion: SQLITE_VERSION,
      device_id: deviceId,
      operations: sortedPending.map((e) => toBackendOperation(e, deviceId)),
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
    const pendingById = new Map(sortedPending.map((e) => [e.id, e]));
    
    for (const r of results) {
      const eventId = r.operation_id;
      const ev = pendingById.get(eventId);
      if (r.status === 'SUCCESS') {
        await outboxService.markAsSynced(eventId);
        // Clear the _isDirty flag on the synced entity in IndexedDB
        if (ev) {
          try {
            const storeName = ENTITY_TO_TABLE[ev.entityType] || `${ev.entityType.toLowerCase()}s`;
            const entities = await localDb.query<{ id: string; _isDirty?: boolean; _lastSync?: string }>(storeName);
            const entity = entities.find((e) => e.id === ev.entityId);
            if (entity && entity._isDirty) {
              await localDb.execute(storeName, 'put', {
                ...entity,
                _isDirty: false,
                _lastSync: new Date().toISOString(),
              });
            }
          } catch {
            // Store may not exist — not an error
          }
        }
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
        } catch (_) { /* store store non présent */ }
      } else {
        await outboxService.markAsFailed(eventId, r.error_message || 'Erreur');
      }
    }
  }

  // 2. PULL (Récupérer les changements serveur)
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
    // Parcourir toutes les entités retournées et les persister en base locale
    const entityTypes = Object.keys(pullData.entities);
    for (const type of entityTypes) {
      const items = pullData.entities[type] || [];
      if (items.length > 0) {
        // Déterminer le nom du store local
        const storeName = type.endsWith('s') ? type : `${type}s`;
        try {
          await localDb.executeBulk(storeName, 'put', items);
          result.pulled[type] = items.length;
        } catch (e) {
          console.error(`[Sync] Failed to persist ${type}:`, e);
        }
      }
    }
    
    const pulledAt = pullData.pulled_at || new Date().toISOString();
    await setLastSyncTimestamp(tenantId, pulledAt);

    // 6. Finalisation : Mise à jour du registre local (Section 11.2)
    await localDb.execute('device_registry_local', 'put', {
      id: 'current_device',
      lastSyncServerId: pullData.server_id || 'remote-master',
      lastSyncAt: pulledAt,
      status: 'SYNCED'
    });
  }

  result.success = result.errors === 0 && result.conflicts === 0;

  // Clean up stale outbox events (ACKNOWLEDGED, old SENT/FAILED) after each sync
  try {
    await outboxService.clearStaleEvents(tenantId);
  } catch {
    // Non-critical — stale events will be cleaned up next time
  }

  // Ne PAS dispatcher sync-end ici — c'est la responsabilité de offline-sync.service.ts
  // qui gère l'orchestration globale et évite les doubles dispatchs

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
  const events = await localDb.query<{ status: string; tenantId: string }>('outbox_events');
  const pendingCount = events.filter(
    (e: any) => e.tenantId === tenantId && e.status === 'PENDING'
  ).length;

  return {
    status: isOnline() ? 'online' : 'offline',
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
