/**
 * Sync Engine (ERP institutionnel)
 *
 * - Push : envoi des opérations pending vers POST /api/sync/push (batch max 100)
 * - Pull : récupération des entités modifiées depuis POST /api/sync/pull
 * - PostgreSQL = source de vérité, local = cache temporaire
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { outboxService } from './outbox.service';
import { idbStoreForEntityType } from './store-names';

/** Alias local (même comportement) — évite ReferenceError si un vieux bundle référence encore `clientBearerHeaders`. */
const clientBearerHeaders = getClientAuthorizationHeader;
import { localDb } from './local-db.service';
import type { OutboxEvent, SyncEntityType, SyncOperationType } from '@/types';

const SYNC_API = '/api/sync';
const BATCH_SIZE = 100;
const SQLITE_VERSION = '1';

/**
 * ⭐ WHITELIST DES TABLES ESSENTIELLES POUR LE BOOTSTRAP INITIAL.
 *
 *    Au lieu de tirer 590+ tables (qui prend 10+ minutes), on ne tire que
 *    les tables nécessaires pour afficher le dashboard et les modules
 *    principaux. Les autres tables seront tirées en lazy au fil de la
 *    navigation (via offlineFetch cache-miss → network → cache).
 *
 *    Critères de sélection :
 *    - Tables utilisées par le dashboard pilotage (students, classes, payments, attendance, exam_scores)
 *    - Tables de référence (school_levels, academic_years, subjects, fee_structures)
 *    - Tables des modules principaux (finance, hr, pedagogy)
 *
 *    Impact : bootstrap passe de ~10 min à ~30s pour la plupart des tenants.
 */
const ESSENTIAL_BOOTSTRAP_TABLES: ReadonlySet<string> = new Set([
  // ─── Dashboard pilotage (effectifs, abandons, finances) ───
  'students',
  'student_enrollments',
  'classes',
  'academic_classes',
  'school_levels',
  'academic_years',
  // ─── Finances ───
  'student_accounts',
  'finance_transactions',
  'fee_structures',
  'fee_overrides',
  'fee_regimes',
  'payments',
  'invoices',
  // ─── Pédagogie ───
  'subjects',
  'attendance_records',
  'class_subjects',
  'teacher_class_assignments',
  'exam_scores',
  'exams',
  'evaluations',
  'grades',
  'bulletins',
  // ─── RH ───
  'staff',
  'teachers',
  'contracts',
  // ─── Élèves : parents / tuteurs ───
  'guardians',
  // ─── Communication ───
  'announcements',
  'messages',
  // ─── Paramètres / Settings (sept. 2026 — spec mode hors-ligne) ───
  'school_settings',
  'settings_bilingual',
  'settings_communication',
  'tenant_features',
  'offline_sync_settings',
  // ─── Academia Shop (sept. 2026 — spec mode hors-ligne) ───
  'shop_products',
  'shop_categories',
  'shop_sales',
  'shop_orders',
  // ─── Helm Connect / communauté (sept. 2026 — spec mode hors-ligne) ───
  'community_channels',
  'community_messages',
  'community_members',
  // ─── EduCast (sept. 2026 — spec mode hors-ligne) ───
  'educast_contents',
  'educast_channels',
  'educast_playlists',
  'educast_settings',
  // ─── Référence ───
  'tenants',
  'users', // pour résolution des noms (sans hashes — filtré par backend)
  'countries',
  'cities',
  'departments',
]);

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
  FEE_OVERRIDE: 'fee_overrides',
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
  // ─── Helm Connect / Communauté (sept. 2026 — spec mode hors-ligne) ───
  COMMUNITY_CHANNEL: 'community_channels',
  COMMUNITY_MESSAGE: 'community_messages',
  COMMUNITY_MEMBER: 'community_members',
  COMMUNITY_REACTION: 'community_reactions',
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
  FEE_OVERRIDE: 30,
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
  // ─── Helm Connect / Communauté ───
  COMMUNITY_CHANNEL: 10,
  COMMUNITY_MESSAGE: 90,
  COMMUNITY_MEMBER: 10,
  COMMUNITY_REACTION: 70,
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
  // ⭐ FIX 2026-09-13 (cf. offline-fetch networkFetch) : headers construits via
  //    Headers.set() (casse normalisée, remplace) — un spread de record
  //    mixant 'Authorization' et 'authorization' produisait un token
  //    « Bearer t, Bearer t » → 401 systémique.
  const mergedHeaders = new Headers();
  mergedHeaders.set('Content-Type', 'application/json');
  const bearerHeaders: Record<string, string> = clientBearerHeaders() ?? {};
  for (const [key, value] of Object.entries(bearerHeaders)) {
    mergedHeaders.set(key, value);
  }
  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
  }
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: mergedHeaders,
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
 * ⭐ Non-bloquant : si l'endpoint n'existe pas ou échoue, on continue sans hash.
 */
async function getSchemaHash(): Promise<{ hash: string }> {
  try {
    const res = await fetchWithAuth(`${SYNC_API}/schema-hash`);
    if (!res.ok) return { hash: 'unknown' };
    return res.json();
  } catch {
    return { hash: 'unknown' };
  }
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
 *
 * ⭐ `local_id` est envoyé explicitement pour l'idempotence côté backend
 *    (voir sync.service.ts → INSERT INTO _sync_outbox). Si le réseau coupe
 *    pendant que le serveur a traité l'écriture mais avant que la réponse
 *    ne revienne, le retry renverra le MÊME local_id et le serveur saura
 *    qu'il peut skip sans réappliquer.
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
    id: event.id,                    // ID outbox local (rétro-compat)
    local_id: event.id,              // ⭐ explicite pour l'idempotence backend
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
 * Callback de progression appelé pendant le pull.
 *   - `current` : nombre de tables traitées jusque-là
 *   - `total` : nombre total de tables à traiter (0 si inconnu)
 *   - `currentTable` : nom de la table en cours de traitement
 *   - `pulledSoFar` : nombre total d'enregistrements récupérés
 */
export type SyncProgressCallback = (
  current: number,
  total: number,
  currentTable: string,
  pulledSoFar: number,
) => void;

/**
 * ⭐ Normalise un nom d'entité retourné par le backend vers le nom du store
 *    IndexedDB correspondant.
 *
 *    Le backend peut retourner plusieurs formats :
 *      - "teacher_class_assignments" (snake_case plural)
 *      - "teacherClassAssignments" (camelCase plural)
 *      - "TeacherClassAssignment" (PascalCase singulier)
 *      - "teacherclassassignment" (déjà normalisé IndexedDB)
 *
 *    La convention IndexedDB (déclarée dans local-db.service.ts) est :
 *      - lowercase
 *      - sans séparateurs (underscore ou tiret)
 *      - singulier (pas de 's' final, sauf si le nom singulier finit par 's')
 *
 *    Exemples :
 *      "teacher_class_assignments" → "teacherclassassignment"
 *      "students" → "student"
 *      "class_diaries" → "classdiary"
 *      "Teachers" → "teacher"
 */
function normalizeToIdbStoreName(type: string): string {
  // ⭐ Délègue à la source unique de vérité partagée (store-names.ts) :
  //    même logique de singularisation + concaténation, utilisée aussi par
  //    offline-business.service pour le write-path (alignement lecture/écriture).
  return idbStoreForEntityType(type);
}

/**
 * ⭐ V18 — REPLAY HTTP DES MUTATIONS OFFLINE (« écriture locale d'abord »).
 *
 * Les mutations hors ligne créées par offlineMutationFallback portent
 * `metadata.request = { url, method, body }`. À la reconnexion, on REJOUE la
 * requête HTTP d'origine vers son endpoint réel plutôt que de passer par le
 * générique /api/sync/push : l'endpoint applique sa validation DTO, ses
 * effets de bord (notifications, numérotation, PDF, quotas…) et écrit avec
 * le MAPPING Prisma correct — un INSERT SQL brut échouerait sur les colonnes
 * (casse, champs calculés, FK) pour la plupart des entités.
 *
 * Résultats :
 *   - 2xx            → markAsSynced + écriture de la réponse serveur dans le
 *                      store local (_isDirty cleared) + invalidation du
 *                      response_cache de la famille d'URL ;
 *   - 4xx (métier)   → markAsFailed + message serveur (l'opération est
 *                      REFUSÉE : elle ne sera pas rejouée) ;
 *   - 5xx / réseau   → reste PENDING (rejouée au prochain cycle de sync).
 *
 * ⚠️ Le header X-Offline-Internal est posé pour COURT-CIRCUITER l'intercepteur
 *    global (sinon : replay → patchedFetch → dataService.mutate → re-queue).
 */
async function replayOfflineRequest(
  event: OutboxEvent,
  tenantId: string,
): Promise<{ ok: boolean; conflict: boolean; error?: string }> {
  const request = (event.metadata as any)?.request as
    | { url: string; method: string; body: any }
    | undefined;
  if (!request?.url || !request?.method) {
    return { ok: false, conflict: false, error: 'metadata.request manquant' };
  }

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...clientBearerHeaders(),
        'X-Offline-Internal': 'true', // ⭐ bypass de l'intercepteur global
        'X-Tenant-ID': tenantId,
      },
      ...(request.body !== null && request.body !== undefined
        ? { body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body) }
        : {}),
    });
  } catch (e: any) {
    // Réseau KO au moment du replay → PENDING, nouvelle tentative au prochain cycle
    console.warn(`[SyncEngine] Replay réseau KO (${request.method} ${request.url}): ${e?.message ?? e}`);
    return { ok: false, conflict: false, error: 'network' };
  }

  const text = await response.text().catch(() => '');
  let parsed: any = null;
  if (text.trim()) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }

  if (response.ok) {
    await outboxService.markAsSynced(event.id);

    // Écrire la réponse serveur dans le store local + clearer _isDirty
    try {
      const storeName = idbStoreForEntityType(event.entityType);
      const entities = await localDb.query<any>(storeName);
      const local = entities.find((e) => e.id === event.entityId);
      const serverData =
        (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.id === event.entityId)
          ? parsed
          : Array.isArray(parsed)
            ? parsed.find((r: any) => r?.id === event.entityId)
            : null;
      if (local || serverData) {
        await localDb.execute(storeName, 'put', {
          ...(serverData ?? local),
          id: event.entityId,
          tenantId: local?.tenantId ?? tenantId,
          _isDirty: false,
          _deleted: false,
          _lastSync: new Date().toISOString(),
          ...(local ? { _version: (local._version || 1) + 1 } : {}),
        });
      }
    } catch { /* store inexistant — non bloquant */ }

    // Invalider le response_cache de la famille d'URL (données périmées)
    try {
      const { invalidateResponseCacheFamily } = await import('./offline-fetch');
      await invalidateResponseCacheFamily(request.url);
    } catch { /* non bloquant */ }

    return { ok: true, conflict: false };
  }

  if (response.status >= 400 && response.status < 500) {
    // Refus MÉTIER du serveur (validation, 403, 404…) → FAILED avec message
    const message =
      parsed?.message || parsed?.error || `Serveur : ${response.status} ${response.statusText}`;
    await outboxService.markAsFailed(event.id, message);
    return { ok: false, conflict: false, error: message };
  }

  // 5xx → probablement transitoire (redémarrage Railway, cold start) →
  // rester PENDING, le cycle de sync retentera.
  console.warn(`[SyncEngine] Replay 5xx (${response.status}) pour ${request.url} — restera PENDING`);
  return { ok: false, conflict: false, error: 'server' };
}

/**
 * ⭐ Pousse uniquement les changements locaux (outbox) vers Neon.
 *    Ne fait PAS de pull — utile pour envoyer rapidement ses modifications
 *    sans attendre le téléchargement complet des données distantes.
 *
 *    Utilisé par le bouton "Push only" dans le header de l'app.
 */
export async function pushOutbox(
  tenantId: string,
  deviceId?: string,
  onProgress?: SyncProgressCallback,
): Promise<{
  pushed: number;
  conflicts: number;
  errors: number;
  /** ⭐ Événements restés EN FILE (échec transitoire : réseau / 5xx — ils
   *    seront retentés au prochain cycle). Ce n'est NI un échec définitif NI
   *    un succès : les appelants doivent le distinguer de `errors`. */
  stillPending: number;
}> {
  const { hash } = await getSchemaHash();

  const pending = await outboxService.getPendingEvents(tenantId, BATCH_SIZE);

  // Trier par priorité avant l'envoi
  const sortedPending = [...pending].sort((a, b) => {
    const prioA = ENTITY_PRIORITY[a.entityType] || 0;
    const prioB = ENTITY_PRIORITY[b.entityType] || 0;
    return prioB - prioA; // Décroissant
  });

  if (sortedPending.length === 0) {
    return { pushed: 0, conflicts: 0, errors: 0, stillPending: 0 };
  }

  // ⭐ V4.0 — SPLIT : les événements portant metadata.request (mutations créées
  //    par l'intercepteur global / offlineMutationFallback) sont REJOUES vers
  //    leurs endpoints d'origine ; les autres (legacy / desktop SQLite)
  //    continuent par le batch générique /api/sync/push.
  //    ⭐ V4.0 — PROPRIÉTAIRE UNIQUE : les événements marqués metadata.sw (mis
  //    en file PAR LE SERVICE WORKER — sw.js v4, interception des écritures)
  //    sont EXCLUS : leur replay appartient au SW (Background Sync
  //    'ah-sync-pending' + replay HTTP exact côté SW). Le sync-engine
  //    applicatif ne les touche plus → AUCUN risque de doublon de mutation.
  const replayable = sortedPending.filter((e) => {
    const meta = e.metadata as any;
    if (meta?.sw) return false; // ⭐ file du SW → replay par le SW uniquement
    const req = meta?.request;
    return req && typeof req.url === 'string' && typeof req.method === 'string';
  });
  const tableOps = sortedPending.filter((e) => !replayable.includes(e));

  let replayPushed = 0;
  let replayErrors = 0;
  let replayConflicts = 0;
  let replayTransient = 0; // ⭐ échecs réseau/5xx → restent PENDING (pas des erreurs)
  for (const event of replayable) {
    const result = await replayOfflineRequest(event, tenantId);
    if (result.ok) replayPushed++;
    else if (result.error === 'network' || result.error === 'server') {
      // Transitoire — l'événement RESTE PENDING : pas compté comme erreur,
      // il sera retenté au prochain cycle.
      replayTransient++;
    } else {
      replayErrors++;
    }
  }

  if (tableOps.length === 0) {
    return {
      pushed: replayPushed,
      conflicts: replayConflicts,
      errors: replayErrors,
      stillPending: replayTransient,
    };
  }

  const body = {
    tenantId,
    sqliteSchemaHash: hash,
    sqliteVersion: SQLITE_VERSION,
    device_id: deviceId,
    operations: tableOps.map((e) => toBackendOperation(e, deviceId)),
  };

  const pushRes = await fetchWithAuth(`${SYNC_API}/push`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const pushData = await pushRes.json().catch(() => ({}));

  if (!pushRes.ok) {
    // ⭐ Les replays déjà ackés ne sont pas perdus : on retourne leur compte
    //    avec l'état du batch générique. Les tableOps RESTENT PENDING (aucun
    //    statut terminal n'a été posé) : ils ne sont PAS comptés comme
    //    « errors » (échec définitif) mais comme « stillPending » — le batch
    //    sera retenté au prochain cycle. Avant : tableOps comptés en erreurs
    //    → toast « N actions ont échoué » sur une simple panne serveur.
    if (replayPushed > 0) {
      return {
        pushed: replayPushed,
        conflicts: replayConflicts,
        errors: replayErrors,
        stillPending: replayTransient + tableOps.length,
      };
    }
    throw new Error(pushData?.message || pushData?.error || 'Push failed');
  }

  const pushed = (pushData.successful_operations ?? 0) + replayPushed;
  const conflicts = (pushData.conflicted_operations ?? 0) + replayConflicts;
  const errors = (pushData.failed_operations ?? 0) + replayErrors;

  const results = pushData.results || [];
  const pendingById = new Map(tableOps.map((e) => [e.id, e]));

  for (const r of results) {
    const eventId = r.operation_id;
    const ev = pendingById.get(eventId);
    if (r.status === 'SUCCESS') {
      await outboxService.markAsSynced(eventId);
      // Clear the _isDirty flag on the synced entity in IndexedDB
      if (ev) {
        try {
          // ⭐ FIX (sept. 2026) : store SINGULIER partagé (idbStoreForEntityType) —
          //    ENTITY_TO_TABLE donne le nom de TABLE Postgres (pluriel), inutilisable
          //    comme store IndexedDB : le flag _isDirty n'était jamais nettoyé.
          const storeName = idbStoreForEntityType(ev.entityType);
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
      } catch (_) { /* store non présent */ }
    } else {
      await outboxService.markAsFailed(eventId, r.error_message || 'Erreur');
    }
  }

  // ⭐ Compter les tableOps restés en file (statut terminal non posé —
  //    ex : résultat absent de la réponse serveur) : transitoire, pas erreur.
  let terminalCount = 0;
  for (const r of results) {
    if (r.status === 'SUCCESS' || r.status === 'CONFLICT' || r.status === 'FAILED') terminalCount++;
  }
  const tableOpsStillPending = Math.max(0, tableOps.length - terminalCount);

  return {
    pushed,
    conflicts,
    errors,
    stillPending: replayTransient + tableOpsStillPending,
  };
}

/**
 * Lance la synchronisation (push puis pull) pour un tenant
 *
 * ⭐ options.pull === false → SYNC EXPRESS (push uniquement, aucune requête serveur
 *    en lecture). Utilisée au retour de connexion : on pousse immédiatement les
 *    modifications locales, et on laisse le pull delta au cycle périodique
 *    (≥ 5 min entre deux pulls). Les reconnexions de routine deviennent ainsi
 *    quasi instantanées et invisibles pour l'utilisateur.
 */
export async function runSync(
  tenantId: string,
  deviceId?: string,
  onProgress?: SyncProgressCallback,
  options?: { pull?: boolean },
): Promise<{
  success: boolean;
  pushed: number;
  conflicts: number;
  errors: number;
  /** ⭐ Événements restés en file après le push (transitoire). */
  pending: number;
  pulled: Record<string, number>;
}> {
  const result = {
    success: false,
    pushed: 0,
    conflicts: 0,
    errors: 0,
    pending: 0,
    pulled: {} as Record<string, number>,
  };

  // 1. PUSH (Envoyer les changements locaux)
  const pushResult = await pushOutbox(tenantId, deviceId, onProgress);
  result.pushed = pushResult.pushed;
  result.conflicts = pushResult.conflicts;
  result.errors = pushResult.errors;
  result.pending = pushResult.stillPending ?? 0;

  // ⭐ SYNC EXPRESS (options.pull === false) : push-only, AUCUNE lecture serveur.
  //    Le timestamp de dernière sync n'est PAS touché — le prochain pull delta
  //    repartira du même point et récupérera tout ce qui a changé entre-temps.
  if (options?.pull === false) {
    console.log('[Sync] Express sync (push-only) — pull différé au cycle périodique');
    // ⭐ FIX « succès mensonger » : avant, success = (errors === 0 && conflicts === 0)
    //    → un push qui n'avait RIEN envoyé (serveur injoignable, événements
    //    restés PENDING) était compté RÉUSSI → toast « Synchronisation réussie »
    //    alors que rien n'était parti vers Neon.
    result.success =
      result.errors === 0 && result.conflicts === 0 && result.pending === 0;
    if (result.pending > 0) {
      console.log(`[Sync] Express sync : ${result.pending} événement(s) toujours en file (transitoire) — nouvelle tentative au prochain cycle`);
    }
    return result;
  }

  // 2. PULL (Récupérer les changements serveur)
  const lastSync = await getLastSyncTimestamp(tenantId);
  const lastSyncAt = lastSync || '1970-01-01T00:00:00.000Z';
  
  // ⭐ FIX SIMPLIFICATION (sept. 2026) : le filtrage sur les tables essentielles
  //    est maintenant TOUJOURS actif — même pour une sync silencieuse (sans
  //    onProgress). Avant : sans onProgress, le serveur renvoyait TOUTES les
  //    tables (629) en une seule requête → 10 minutes de blocage silencieux.
  let tablesToPull: string[] | undefined = undefined;
  let totalTables = 0;
  {
    try {
      const tablesRes = await fetchWithAuth(`${SYNC_API}/tables`, { method: 'GET' });
      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        const allTables: string[] = Array.isArray(tablesData) ? tablesData : (tablesData.tables || tablesData.data || []);

        // ⭐ FIX PERFORMANCE : filtrer pour ne garder que les tables essentielles.
        //    Avant : on tirait 590+ tables → 10+ minutes de bootstrap
        //    Maintenant : on tire ~30 tables essentielles → ~30 secondes
        //    Les autres tables seront tirées en lazy au fil de la navigation
        //    (via offlineFetch cache-miss → network → cache IDB).
        tablesToPull = allTables.filter((t) => ESSENTIAL_BOOTSTRAP_TABLES.has(t));
        totalTables = tablesToPull.length;

        console.log(`[Sync] Pull: ${totalTables}/${allTables.length} tables essentielles sélectionnées`);
      }
    } catch {
      // Non-critique : on retombe sur le mode non-chunké (fallback)
    }
    // ⭐ Indiquer que la récupération démarre — on met total=0 temporairement
    //    pour déclencher le mode "indeterminate" (barre animée) pendant que le
    //    serveur prépare les données. Sans ça, l'utilisateur voit "0/30 0%"
    //    statique pendant 30s sans comprendre ce qui se passe.
    onProgress?.(0, 0, 'récupération serveur…', 0);
  }

  // ⭐ CHUNKED PULL — au lieu d'envoyer une seule requête POST /api/sync/pull
  //    avec 629 tables d'un coup (ce qui bloque le serveur pendant 10+ min
  //    à construire la réponse JSON complète), on découpe en chunks de 25 tables.
  //
  //    Avantages :
  //    1. Chaque requête prend ~30s au lieu de 10 min → l'utilisateur voit la
  //       barre progresser toutes les 30s au lieu de rester bloquée.
  //    2. Si une requête échoue (timeout, réseau), on ne perd pas tout le
  //       travail déjà fait — les chunks précédents sont déjà persistés.
  //    3. Le serveur peut paralléliser les requêtes SQL plus efficacement
  //       car il n'a pas à construire un énorme objet en mémoire.
  //
  //    ⭐ Le mode chunké s'applique maintenant même sans onProgress
  //    (sync silencieuse) — le fallback non-chunké ne survient que si la
  //    liste des tables n'a pas pu être récupérée.
  const CHUNK_SIZE = 25;
  let pulledAt = new Date().toISOString();
  let pullServerId = 'remote-master';

  if (tablesToPull && tablesToPull.length > 0) {
    // ⭐ Mode chunked — découper en chunks de CHUNK_SIZE tables
    const chunks: string[][] = [];
    for (let i = 0; i < tablesToPull.length; i += CHUNK_SIZE) {
      chunks.push(tablesToPull.slice(i, i + CHUNK_SIZE));
    }

    let tablesProcessed = 0;
    let totalPulledSoFar = 0;

    // ⭐ PARALLÉLISATION des chunks avec concurrence limitée à 3.
    //    Avant : boucle for séquentielle → 24 chunks × 30s = 12 min
    //    Maintenant : 3 chunks en parallèle → 24/3 × 30s = 4 min (ou moins car
    //    les chunks essentiels sont plus petits maintenant — ~30 tables / 25 = 2 chunks)
    //    La concurrence est limitée à 3 pour ne pas saturer le pool Postgres/Neon.
    const MAX_CONCURRENCY = 3;
    const MAX_RETRIES = 3;

    const processChunk = async (chunkIdx: number, chunk: string[]) => {
      // ⭐ Fiabilisation : retry jusqu'à 3 fois en cas d'échec d'un chunk.
      let lastChunkError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const chunkRes = await fetchWithAuth(`${SYNC_API}/pull`, {
            method: 'POST',
            body: JSON.stringify({
              tenant_id: tenantId,
              last_sync_at: lastSyncAt,
              device_id: deviceId,
              tables: chunk,
            }),
          });

          if (!chunkRes.ok) {
            throw new Error(`HTTP ${chunkRes.status} ${chunkRes.statusText}`);
          }

          const chunkData = await chunkRes.json().catch(() => ({}));

          if (chunkData.entities) {
            // Persister chaque table du chunk
            const pulledInChunk: Record<string, number> = {};
            let pulledCount = 0;
            let tablesInChunk = 0;

            for (const type of Object.keys(chunkData.entities)) {
              const items = chunkData.entities[type] || [];
              if (items.length > 0) {
                const storeName = normalizeToIdbStoreName(type);
                try {
                  await localDb.executeBulk(storeName, 'put', items);
                  pulledInChunk[type] = items.length;
                  pulledCount += items.length;
                } catch (e) {
                  console.warn(`[Sync] Store "${storeName}" (from type "${type}") not in IndexedDB — skipping ${items.length} items`);
                }
              }
              tablesInChunk += 1;
            }

            // ⭐ Mettre à jour les compteurs globaux de façon thread-safe
            tablesProcessed += tablesInChunk;
            totalPulledSoFar += pulledCount;
            for (const [type, count] of Object.entries(pulledInChunk)) {
              result.pulled[type] = (result.pulled[type] || 0) + count;
            }

            // Mettre à jour pulledAt avec le timestamp du serveur si dispo
            if (chunkData.pulled_at) {
              pulledAt = chunkData.pulled_at;
            }
            if (chunkData.server_id) {
              pullServerId = chunkData.server_id;
            }

            // ⭐ Mettre à jour la progression
            onProgress?.(tablesProcessed, totalTables, `chunk ${chunkIdx + 1}/${chunks.length} OK`, totalPulledSoFar);
            return; // ✅ Succès
          } else {
            throw new Error('Réponse sans entités');
          }
        } catch (attemptError) {
          lastChunkError = attemptError as Error;
          console.warn(`[Sync] Chunk ${chunkIdx + 1}/${chunks.length} attempt ${attempt}/${MAX_RETRIES} failed:`, (attemptError as Error).message);

          if (attempt < MAX_RETRIES) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }

      // ⭐ Tous les retries ont échoué — lever une erreur
      throw new Error(
        `Échec du chunk ${chunkIdx + 1}/${chunks.length} après ${MAX_RETRIES} tentatives. ` +
        `Dernière erreur : ${lastChunkError?.message || 'inconnue'}. ` +
        `Tables concernées : ${chunk.slice(0, 5).join(', ')}${chunk.length > 5 ? '…' : ''}. ` +
        `Relancez la synchronisation pour réessayer.`
      );
    };

    // ⭐ Exécuter les chunks avec concurrence limitée
    //    Approche simple : on traite les chunks par batches de MAX_CONCURRENCY
    //    en parallèle, et on attend que chaque batch termine avant de passer au suivant.
    //    Ce n'est pas optimal (un chunk rapide attend les lents du batch), mais c'est
    //    robuste et évite les bugs de pool de promesses.
    for (let batchStart = 0; batchStart < chunks.length; batchStart += MAX_CONCURRENCY) {
      const batch = chunks.slice(batchStart, batchStart + MAX_CONCURRENCY);
      const batchPromises = batch.map((chunk, i) => {
        const chunkIdx = batchStart + i;
        onProgress?.(tablesProcessed, totalTables, `démarrage chunk ${chunkIdx + 1}/${chunks.length}…`, totalPulledSoFar);
        return processChunk(chunkIdx, chunk);
      });

      // ⭐ Si un chunk du batch échoue, on lève l'erreur (les autres sont perdus)
      //    mais c'est acceptable car chaque chunk a déjà ses 3 retries internes.
      await Promise.all(batchPromises);
    }

    // Finalisation : mettre à jour le timestamp de sync + device registry
    await setLastSyncTimestamp(tenantId, pulledAt);
    await localDb.execute('device_registry_local', 'put', {
      id: 'current_device',
      lastSyncServerId: pullServerId,
      lastSyncAt: pulledAt,
      status: 'SYNCED'
    });

    // ⭐ Progression finale à 100%
    onProgress?.(totalTables, totalTables, 'terminé', totalPulledSoFar);
  } else {
    // ⭐ Mode non-chunké (comportement historique) — une seule requête
    const pullRes = await fetchWithAuth(`${SYNC_API}/pull`, {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: tenantId,
        last_sync_at: lastSyncAt,
        device_id: deviceId,
        ...(tablesToPull ? { tables: tablesToPull } : {}),
      }),
    });
    const pullData = await pullRes.json().catch(() => ({}));

    if (pullRes.ok && pullData.entities) {
      // Parcourir toutes les entités retournées et les persister en base locale
      const entityTypes = Object.keys(pullData.entities);
      let pulledSoFar = 0;
      for (const type of entityTypes) {
        const items = pullData.entities[type] || [];
        if (items.length > 0) {
          const storeName = normalizeToIdbStoreName(type);
          try {
            await localDb.executeBulk(storeName, 'put', items);
            result.pulled[type] = items.length;
            pulledSoFar += items.length;
          } catch (e) {
            console.warn(`[Sync] Store "${storeName}" (from type "${type}") not in IndexedDB — skipping ${items.length} items`);
          }
        }
        if (onProgress) {
          try {
            onProgress(
              Object.keys(result.pulled).length,
              totalTables || entityTypes.length,
              type,
              pulledSoFar,
            );
          } catch {}
        }
      }

      pulledAt = pullData.pulled_at || pulledAt;
      if (pullData.server_id) pullServerId = pullData.server_id;

      await setLastSyncTimestamp(tenantId, pulledAt);
      await localDb.execute('device_registry_local', 'put', {
        id: 'current_device',
        lastSyncServerId: pullServerId,
        lastSyncAt: pulledAt,
        status: 'SYNCED'
      });
    }
  }

  result.success = result.errors === 0 && result.conflicts === 0 && result.pending === 0;

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
  pushOutbox,
  isOnline,
  getSyncState,
  getLastSyncTimestamp,
  BATCH_SIZE,
};
