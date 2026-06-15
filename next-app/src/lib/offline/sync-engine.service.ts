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
  // ─── Élèves & Scolarité ───
  STUDENT: 'students',
  GUARDIAN: 'guardians',
  STUDENT_GUARDIAN: 'student_guardians',
  // ─── Personnel, RH & Paie ───
  TEACHER: 'teachers',
  STAFF: 'staff',
  CONTRACT: 'contracts',
  CONTRACT_AMENDMENT: 'contract_amendments',
  LEAVE_REQUEST: 'leave_requests',
  STAFF_ALLOWANCE: 'staff_allowances',
  STAFF_SCHEDULE: 'staff_schedules',
  STAFF_ATTENDANCE: 'staff_attendance',
  STAFF_EVALUATION: 'staff_evaluations',
  STAFF_DOCUMENT: 'staff_documents',
  STAFF_ASSIGNMENT: 'staff_assignments',
  OVERTIME_RECORD: 'overtime_records',
  SALARY_PAYMENT: 'salary_payments',
  SALARY_SLIP: 'salary_slips',
  PAYROLL: 'payrolls',
  PAYROLL_ITEM: 'payroll_items',
  PAYROLL_PERIOD: 'payroll_periods',
  // ─── Classes & Structure ───
  CLASS: 'classes',
  CLASS_STUDENT: 'class_students',
  CLASS_SUBJECT: 'class_subjects',
  SUBJECT: 'subjects',
  SCHOOL_LEVEL: 'school_levels',
  ACADEMIC_YEAR: 'academic_years',
  ACADEMIC_PERIOD: 'academic_periods',
  // ─── Examens, Notes & Bulletins ───
  EXAM: 'exams',
  GRADE: 'grades',
  EXAM_CANDIDATE: 'exam_candidates',
  EXAM_RESULT: 'exam_results',
  EXAM_SCORE: 'exam_scores',
  EXAM_SESSION: 'exam_sessions',
  EXAM_PV: 'exam_pvs',
  EXAM_COMPOSITION: 'exam_compositions',
  EXAM_DELIBERATION: 'exam_deliberations',
  REPORT_CARD: 'report_cards',
  REPORT_CARD_ITEM: 'report_card_items',
  EVALUATION: 'evaluations',
  GRADE_CALCULATION: 'grade_calculations',
  STUDENT_PERIOD_AVERAGE: 'student_period_averages',
  STUDENT_SUBJECT_AVERAGE: 'student_subject_averages',
  // ─── Finances & Économat ───
  PAYMENT: 'payments',
  INVOICE: 'invoices',
  FEE_STRUCTURE: 'fee_structures',
  FEE_CONFIGURATION: 'fee_configurations',
  FEE_DEFINITION: 'fee_definitions',
  FEE_REGIME: 'fee_regimes',
  EXPENSE: 'expenses',
  FINANCE_SETTING: 'finance_settings',
  FINANCE_TRANSACTION: 'finance_transactions',
  FINANCE_BUDGET: 'finance_budgets',
  TREASURY_MOVEMENT: 'treasury_movements',
  TUITION_INSTALLMENT: 'tuition_installments',
  TUITION_PAYMENT: 'tuition_payments',
  PAYMENT_PLAN: 'payment_plans',
  PAYMENT_FLOW: 'payment_flows',
  // ─── Organisation Pédagogique ───
  ATTENDANCE: 'attendance',
  ABSENCE: 'absences',
  HOMEWORK: 'homeworks',
  HOMEWORK_ENTRY: 'homework_entries',
  HOMEWORK_SUBMISSION: 'homework_submissions',
  PEDAGOGICAL_FILE: 'pedagogical_files',
  CLASS_DIARY: 'class_diaries',
  LESSON_PLAN: 'lesson_plans',
  LESSON_JOURNAL: 'lesson_journals',
  LESSON_JOURNAL_ENTRY: 'lesson_journal_entries',
  WEEKLY_SEMAINIER: 'weekly_semainier_daily_entries',
  TEACHER_CLASS_ASSIGNMENT: 'teacher_class_assignments',
  ACADEMIC_SERIES: 'academic_series',
  SERIES_SUBJECT: 'series_subjects',
  TEACHER_PROFILE: 'teacher_profiles',
  PEDAGOGICAL_MATERIAL: 'pedagogical_materials',
  MATERIAL_STOCK: 'material_stocks',
  MATERIAL_MOVEMENT: 'material_movements',
  TEACHER_MATERIAL_ASSIGNMENT: 'teacher_material_assignments',
  TEACHING_ASSIGNMENT: 'teaching_assignments',
  SUBJECT_PROGRAM: 'subject_programs',
  TIMETABLE: 'timetables',
  TIMETABLE_ENTRY: 'timetable_entries',
  ACADEMIC_CLASS: 'academic_classes',
  ACADEMIC_CYCLE: 'academic_cycles',
  ACADEMIC_LEVEL: 'academic_levels',
  // ─── Discipline & Incidents ───
  DISCIPLINARY_INCIDENT: 'disciplinary_incidents',
  INCIDENT: 'incidents',
  // ─── Réunions ───
  MEETING: 'meetings',
  MEETING_PARTICIPANT: 'meeting_participants',
  MEETING_AGENDA_ITEM: 'meeting_agenda_items',
  MEETING_MINUTE: 'meeting_minutes',
  // ─── Communication ───
  MESSAGE: 'messages',
  MESSAGE_RECIPIENT: 'message_recipients',
  MESSAGE_TEMPLATE: 'message_templates',
  ANNOUNCEMENT: 'announcements',
  SMS_LOG: 'sms_logs',
  EMAIL_LOG: 'email_logs',
  PUSH_NOTIFICATION: 'push_notifications',
  COMMUNICATION_CHANNEL: 'communication_channels',
  NOTIFICATION: 'notifications',
  ALERT: 'alerts',
  // ─── Agrégation & Décision ───
  AGGREGATION_RESULT: 'aggregation_results',
  AGGREGATION_SESSION: 'aggregation_sessions',
  AGGREGATION_DECISION: 'aggregation_decisions',
  RANKING: 'rankings',
  HONOR_ROLL: 'honor_rolls',
  // ─── ORION (Pilotage Direction) ───
  ORION_ALERT: 'orion_alerts',
  ORION_INSIGHT: 'orion_insights',
  ORION_FORECAST: 'orion_forecasts',
  ORION_SETTINGS: 'orion_settings',
  // ─── Paramètres / Settings ───
  SCHOOL_ACADEMIC_SETTING: 'school_academic_settings',
  SCHOOL_SETTINGS: 'school_settings',
  TENANT_IDENTITY_PROFILE: 'tenant_identity_profiles',
  SETTINGS_PEDAGOGICAL_STRUCTURE: 'settings_pedagogical_structures',
  SETTINGS_BILINGUAL: 'settings_bilingual',
  TENANT_FEATURE: 'tenant_features',
  SECURITY_SETTINGS: 'security_settings',
  OFFLINE_SYNC_SETTINGS: 'offline_sync_settings',
  SETTINGS_COMMUNICATION: 'settings_communications',
  TENANT_STAMP: 'tenant_stamps',
  TENANT_SIGNATURE: 'tenant_signatures',
  ROLE: 'roles',
  PERMISSION: 'permissions',
  SETTINGS_HISTORY: 'settings_histories',
  // ─── Cantine ───
  CANTEEN_SETTINGS: 'canteen_settings',
  CANTEEN_MENU: 'canteen_menus',
  CANTEEN_MEAL_SERVICE: 'canteen_meal_services',
  CANTEEN_ATTENDANCE: 'canteen_attendance',
  CANTEEN_SUBSCRIPTION: 'canteen_subscriptions',
  CANTEEN_PAYMENT: 'canteen_payments',
  // ─── Transport ───
  VEHICLE: 'vehicles',
  ROUTE: 'routes',
  TRANSPORT_DRIVER: 'transport_drivers',
  TRANSPORT_TRIP: 'transport_trips',
  TRANSPORT_ASSIGNMENT: 'transport_assignments',
  TRANSPORT_SETTINGS: 'transport_settings',
  // ─── Infirmerie ───
  INFIRMARY_VISIT: 'infirmary_visits',
  INFIRMARY_MEDICAL_RECORD: 'infirmary_medical_records',
  INFIRMARY_MEDICATION_STOCK: 'infirmary_medication_stocks',
  INFIRMARY_SETTINGS: 'infirmary_settings',
  // ─── QHSE ───
  QHSE_AUDIT: 'qhse_audits',
  QHSE_INCIDENT: 'qhse_incidents',
  QHSE_RISK: 'qhse_risks',
  QHSE_ACTION_PLAN: 'qhse_action_plans',
  QHSE_SETTING: 'qhse_settings',
  // ─── EduCast ───
  EDUCAST_CONTENT: 'educast_contents',
  EDUCAST_CHANNEL: 'educast_channels',
  EDUCAST_PLAYLIST: 'educast_playlists',
  EDUCAST_SETTINGS: 'educast_settings',
  // ─── Boutique / Shop ───
  SHOP_PRODUCT: 'shop_products',
  SHOP_CATEGORY: 'shop_categories',
  SHOP_ORDER: 'shop_orders',
  SHOP_SALE: 'shop_sales',
  SHOP_SETTINGS: 'shop_settings',
  // ─── Bibliothèque ───
  LIBRARY_BOOK: 'library_books',
  LIBRARY_LOAN: 'library_loans',
  LIBRARY_RESERVATION: 'library_reservations',
  LIBRARY_SETTINGS: 'library_settings',
  // ─── Divers / Legacy ───
  SESSION: 'sessions',
  LOAN: 'loans',
  REPORT: 'reports',
  MODULE: 'modules',
};

/**
 * Priorités de synchronisation — tous modules couverts
 *
 * HIGH (100)   : Données critiques temps réel (présence, notes, examens, discipline)
 * HIGH-ish (90): Paiements, transactions financières
 * MEDIUM (50)  : Pédagogie, messages, notifications, réunions
 * MEDIUM-low (30): Paramètres, configuration, agrégation
 * LOW (10)     : Données de référence (élèves, classes, niveaux)
 */
const ENTITY_PRIORITY: Record<SyncEntityType, number> = {
  // ─── Élèves & Scolarité ───
  STUDENT: 10,
  GUARDIAN: 10,
  STUDENT_GUARDIAN: 10,
  // ─── Personnel, RH & Paie ───
  TEACHER: 10,
  STAFF: 10,
  CONTRACT: 30,
  CONTRACT_AMENDMENT: 30,
  LEAVE_REQUEST: 50,
  STAFF_ALLOWANCE: 30,
  STAFF_SCHEDULE: 50,
  STAFF_ATTENDANCE: 100,
  STAFF_EVALUATION: 50,
  STAFF_DOCUMENT: 10,
  STAFF_ASSIGNMENT: 30,
  OVERTIME_RECORD: 50,
  SALARY_PAYMENT: 90,
  SALARY_SLIP: 90,
  PAYROLL: 90,
  PAYROLL_ITEM: 90,
  PAYROLL_PERIOD: 30,
  // ─── Classes & Structure ───
  CLASS: 10,
  CLASS_STUDENT: 10,
  CLASS_SUBJECT: 10,
  SUBJECT: 10,
  SCHOOL_LEVEL: 10,
  ACADEMIC_YEAR: 10,
  ACADEMIC_PERIOD: 10,
  // ─── Examens, Notes & Bulletins ───
  EXAM: 100,
  GRADE: 100,
  EXAM_CANDIDATE: 100,
  EXAM_RESULT: 100,
  EXAM_SCORE: 100,
  EXAM_SESSION: 100,
  EXAM_PV: 100,
  EXAM_COMPOSITION: 100,
  EXAM_DELIBERATION: 100,
  REPORT_CARD: 90,
  REPORT_CARD_ITEM: 90,
  EVALUATION: 100,
  GRADE_CALCULATION: 90,
  STUDENT_PERIOD_AVERAGE: 90,
  STUDENT_SUBJECT_AVERAGE: 90,
  // ─── Finances & Économat ───
  PAYMENT: 90,
  INVOICE: 10,
  FEE_STRUCTURE: 10,
  FEE_CONFIGURATION: 30,
  FEE_DEFINITION: 10,
  FEE_REGIME: 10,
  EXPENSE: 30,
  FINANCE_SETTING: 30,
  FINANCE_TRANSACTION: 90,
  FINANCE_BUDGET: 30,
  TREASURY_MOVEMENT: 90,
  TUITION_INSTALLMENT: 30,
  TUITION_PAYMENT: 90,
  PAYMENT_PLAN: 30,
  PAYMENT_FLOW: 30,
  // ─── Organisation Pédagogique ───
  ATTENDANCE: 100,
  ABSENCE: 100,
  HOMEWORK: 50,
  HOMEWORK_ENTRY: 50,
  HOMEWORK_SUBMISSION: 50,
  PEDAGOGICAL_FILE: 50,
  CLASS_DIARY: 50,
  LESSON_PLAN: 50,
  LESSON_JOURNAL: 50,
  LESSON_JOURNAL_ENTRY: 50,
  WEEKLY_SEMAINIER: 50,
  TEACHER_CLASS_ASSIGNMENT: 10,
  ACADEMIC_SERIES: 10,
  SERIES_SUBJECT: 10,
  TEACHER_PROFILE: 10,
  PEDAGOGICAL_MATERIAL: 10,
  MATERIAL_STOCK: 10,
  MATERIAL_MOVEMENT: 10,
  TEACHER_MATERIAL_ASSIGNMENT: 10,
  TEACHING_ASSIGNMENT: 30,
  SUBJECT_PROGRAM: 30,
  TIMETABLE: 50,
  TIMETABLE_ENTRY: 50,
  ACADEMIC_CLASS: 10,
  ACADEMIC_CYCLE: 10,
  ACADEMIC_LEVEL: 10,
  // ─── Discipline & Incidents ───
  DISCIPLINARY_INCIDENT: 100,
  INCIDENT: 100,
  // ─── Réunions ───
  MEETING: 50,
  MEETING_PARTICIPANT: 50,
  MEETING_AGENDA_ITEM: 50,
  MEETING_MINUTE: 50,
  // ─── Communication ───
  MESSAGE: 50,
  MESSAGE_RECIPIENT: 50,
  MESSAGE_TEMPLATE: 10,
  ANNOUNCEMENT: 50,
  SMS_LOG: 50,
  EMAIL_LOG: 50,
  PUSH_NOTIFICATION: 50,
  COMMUNICATION_CHANNEL: 10,
  NOTIFICATION: 50,
  ALERT: 50,
  // ─── Agrégation & Décision ───
  AGGREGATION_RESULT: 30,
  AGGREGATION_SESSION: 30,
  AGGREGATION_DECISION: 30,
  RANKING: 30,
  HONOR_ROLL: 30,
  // ─── ORION (Pilotage Direction) ───
  ORION_ALERT: 50,
  ORION_INSIGHT: 30,
  ORION_FORECAST: 30,
  ORION_SETTINGS: 30,
  // ─── Paramètres / Settings ───
  SCHOOL_ACADEMIC_SETTING: 80,
  SCHOOL_SETTINGS: 30,
  TENANT_IDENTITY_PROFILE: 30,
  SETTINGS_PEDAGOGICAL_STRUCTURE: 30,
  SETTINGS_BILINGUAL: 30,
  TENANT_FEATURE: 30,
  SECURITY_SETTINGS: 30,
  OFFLINE_SYNC_SETTINGS: 30,
  SETTINGS_COMMUNICATION: 30,
  TENANT_STAMP: 10,
  TENANT_SIGNATURE: 10,
  ROLE: 30,
  PERMISSION: 30,
  SETTINGS_HISTORY: 10,
  // ─── Cantine ───
  CANTEEN_SETTINGS: 30,
  CANTEEN_MENU: 30,
  CANTEEN_MEAL_SERVICE: 50,
  CANTEEN_ATTENDANCE: 100,
  CANTEEN_SUBSCRIPTION: 30,
  CANTEEN_PAYMENT: 90,
  // ─── Transport ───
  VEHICLE: 10,
  ROUTE: 10,
  TRANSPORT_DRIVER: 10,
  TRANSPORT_TRIP: 50,
  TRANSPORT_ASSIGNMENT: 30,
  TRANSPORT_SETTINGS: 30,
  // ─── Infirmerie ───
  INFIRMARY_VISIT: 100,
  INFIRMARY_MEDICAL_RECORD: 90,
  INFIRMARY_MEDICATION_STOCK: 30,
  INFIRMARY_SETTINGS: 30,
  // ─── QHSE ───
  QHSE_AUDIT: 50,
  QHSE_INCIDENT: 100,
  QHSE_RISK: 50,
  QHSE_ACTION_PLAN: 50,
  QHSE_SETTING: 30,
  // ─── EduCast ───
  EDUCAST_CONTENT: 30,
  EDUCAST_CHANNEL: 10,
  EDUCAST_PLAYLIST: 10,
  EDUCAST_SETTINGS: 30,
  // ─── Boutique / Shop ───
  SHOP_PRODUCT: 10,
  SHOP_CATEGORY: 10,
  SHOP_ORDER: 90,
  SHOP_SALE: 90,
  SHOP_SETTINGS: 30,
  // ─── Bibliothèque ───
  LIBRARY_BOOK: 10,
  LIBRARY_LOAN: 50,
  LIBRARY_RESERVATION: 50,
  LIBRARY_SETTINGS: 30,
  // ─── Divers / Legacy ───
  SESSION: 50,
  LOAN: 10,
  REPORT: 50,
  MODULE: 10,
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
