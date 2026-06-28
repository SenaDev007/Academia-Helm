/**
 * DualWriteService — Persistance double simultanée (IndexedDB + PostgreSQL)
 *
 * PRINCIPE FONDAMENTAL :
 *   Chaque sauvegarde persiste SIMULTANÉMENT dans la base locale (IndexedDB)
 *   ET dans la base mère (PostgreSQL). Aucun déphasage n'est toléré.
 *
 * FLUX NOMINAL (en ligne) :
 *   1. Écrire dans IndexedDB (_isDirty = true) — garantie immédiate
 *   2. Écrire dans PostgreSQL via l'API distante — en parallèle si possible
 *   3. Si les deux réussissent → _isDirty = false, résultat = SYNCED
 *   4. Si seul le local réussit → outbox prend le relais, résultat = LOCAL_ONLY
 *   5. Si seul le remote réussit → on synchronise le local avec le remote, résultat = REMOTE_ONLY
 *
 * FLUX HORS LIGNE :
 *   1. Écrire dans IndexedDB (_isDirty = true)
 *   2. Créer un événement dans l'outbox
 *   3. Le sync engine poussera quand la connexion reviendra
 *
 * MODULES COUVERTS :
 *   - Élèves & Scolarité, Personnel RH & Paie, Classes & Structure
 *   - Examens Notes & Bulletins, Finances & Économat
 *   - Organisation Pédagogique, Discipline & Incidents
 *   - Réunions, Communication, Agrégation & Décision
 *   - ORION (Pilotage Direction), Paramètres / Settings
 *   - Cantine, Transport, Infirmerie, QHSE, EduCast, Boutique, Bibliothèque
 */

import { localDb } from './local-db.service';
import { outboxService } from './outbox.service';
import { offlineSyncService } from './offline-sync.service';
import { networkDetectionService } from './network-detection.service';
import { LocalAuditService } from './local-audit.service';
import { conflictResolverService, type ConflictResolutionStrategy } from './conflict-resolver.service';
import type { SyncEntityType, SyncOperationType } from '@/types';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/** Résultat d'une opération dual-write */
export type DualWriteStatus = 'SYNCED' | 'LOCAL_ONLY' | 'REMOTE_ONLY' | 'FAILED';

export interface DualWriteResult<T = any> {
  /** Statut global de l'opération */
  status: DualWriteStatus;
  /** Données telles que persistées localement */
  localData: T | null;
  /** Données telles que retournées par le serveur (peut inclure id auto-généré, updatedAt serveur, etc.) */
  remoteData: T | null;
  /** L'écriture locale a réussi */
  localSuccess: boolean;
  /** L'écriture distante a réussi */
  remoteSuccess: boolean;
  /** Message d'erreur éventuel (local ou remote) */
  error?: string;
  /** ID de l'événement outbox (si local uniquement) */
  outboxEventId?: string;
}

/** Configuration d'une opération dual-write */
export interface DualWriteConfig {
  /** ID du tenant (obligatoire) */
  tenantId: string;
  /** Type d'entité (ex: 'STUDENT', 'PAYMENT', etc.) */
  entityType: SyncEntityType;
  /** ID de l'entité (obligatoire pour UPDATE et DELETE) */
  entityId?: string;
  /** Type d'opération */
  operation: SyncOperationType;
  /** Données à persister */
  data?: any;
  /** URL de l'API distante (surcharge si différente du pattern standard) */
  remoteUrl?: string;
  /** Méthode HTTP pour l'API distante (défaut: auto-détecté selon l'opération) */
  remoteMethod?: string;
  /** Données supplémentaires à envoyer au remote (payload custom) */
  remotePayload?: any;
  /** Stratégie de résolution de conflit (défaut: LAST_WRITE_WINS) */
  conflictStrategy?: ConflictResolutionStrategy;
  /** ID utilisateur pour l'audit */
  userId?: string;
  /** Métadonnées additionnelles pour l'outbox */
  metadata?: any;
  /** Si true, ne pas tenter l'écriture distante (forcement local-only) */
  localOnly?: boolean;
  /** Si true, ne pas écrire localement (forcement remote-only — rare) */
  remoteOnly?: boolean;
  /** Nom du store local (surcharge si différent du mapping standard) */
  storeName?: string;
  /** Timeout pour la requête distante en ms (défaut: 10000) */
  remoteTimeout?: number;
  /** Nombre max de tentatives remote (défaut: 2) */
  maxRemoteRetries?: number;
}

// ─────────────────────────────────────────────────────────────────
// Mapping EntityType → Store IndexedDB
// ─────────────────────────────────────────────────────────────────

const ENTITY_TO_STORE: Record<SyncEntityType, string> = {
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

// ─────────────────────────────────────────────────────────────────
// Mapping EntityType → API Route
// ─────────────────────────────────────────────────────────────────

/**
 * Génère l'URL de l'API distante pour une entité et une opération données.
 * Convention REST :
 *   CREATE  → POST   /api/{module}/{resource}
 *   UPDATE  → PUT    /api/{module}/{resource}/{id}
 *   DELETE  → DELETE /api/{module}/{resource}/{id}
 */
function getDefaultRemoteUrl(entityType: SyncEntityType, operation: SyncOperationType, entityId?: string): string | null {
  // Mapping EntityType → (module, resource)
  const routeMap: Record<string, [string, string]> = {
    // Élèves
    STUDENT: ['students', 'students'],
    GUARDIAN: ['students', 'guardians'],
    STUDENT_GUARDIAN: ['students', 'student-guardians'],
    // RH
    TEACHER: ['hr', 'teachers'],
    STAFF: ['hr', 'staff'],
    CONTRACT: ['hr', 'contracts'],
    CONTRACT_AMENDMENT: ['hr', 'contract-amendments'],
    LEAVE_REQUEST: ['hr', 'leave-requests'],
    STAFF_ALLOWANCE: ['hr', 'staff-allowances'],
    STAFF_SCHEDULE: ['hr', 'staff-schedules'],
    STAFF_ATTENDANCE: ['hr', 'staff-attendance'],
    STAFF_EVALUATION: ['hr', 'staff-evaluations'],
    STAFF_DOCUMENT: ['hr', 'staff-documents'],
    STAFF_ASSIGNMENT: ['hr', 'staff-assignments'],
    OVERTIME_RECORD: ['hr', 'overtime-records'],
    SALARY_PAYMENT: ['hr', 'salary-payments'],
    SALARY_SLIP: ['hr', 'salary-slips'],
    PAYROLL: ['hr', 'payrolls'],
    PAYROLL_ITEM: ['hr', 'payroll-items'],
    PAYROLL_PERIOD: ['hr', 'payroll-periods'],
    // Classes
    CLASS: ['students', 'classes'],
    CLASS_STUDENT: ['students', 'class-students'],
    CLASS_SUBJECT: ['pedagogy', 'class-subjects'],
    SUBJECT: ['pedagogy', 'subjects'],
    SCHOOL_LEVEL: ['pedagogy', 'school-levels'],
    ACADEMIC_YEAR: ['settings', 'academic-years'],
    ACADEMIC_PERIOD: ['settings', 'academic-periods'],
    // Examens
    EXAM: ['exams', 'exams'],
    GRADE: ['exams', 'grades'],
    EXAM_CANDIDATE: ['exams', 'exam-candidates'],
    EXAM_RESULT: ['exams', 'exam-results'],
    EXAM_SCORE: ['exams', 'exam-scores'],
    EXAM_SESSION: ['exams', 'exam-sessions'],
    EXAM_PV: ['exams', 'exam-pvs'],
    EXAM_COMPOSITION: ['exams', 'exam-compositions'],
    EXAM_DELIBERATION: ['exams', 'exam-deliberations'],
    REPORT_CARD: ['exams', 'report-cards'],
    REPORT_CARD_ITEM: ['exams', 'report-card-items'],
    EVALUATION: ['exams', 'evaluations'],
    GRADE_CALCULATION: ['exams', 'grade-calculations'],
    STUDENT_PERIOD_AVERAGE: ['exams', 'student-period-averages'],
    STUDENT_SUBJECT_AVERAGE: ['exams', 'student-subject-averages'],
    // Finances
    PAYMENT: ['finance', 'payments'],
    INVOICE: ['finance', 'invoices'],
    FEE_STRUCTURE: ['finance', 'fee-structures'],
    FEE_CONFIGURATION: ['finance', 'fee-configurations'],
    FEE_DEFINITION: ['finance', 'fee-definitions'],
    FEE_REGIME: ['finance', 'fee-regimes'],
    EXPENSE: ['finance', 'expenses'],
    FINANCE_SETTING: ['finance', 'settings'],
    FINANCE_TRANSACTION: ['finance', 'transactions'],
    FINANCE_BUDGET: ['finance', 'budgets'],
    TREASURY_MOVEMENT: ['finance', 'treasury-movements'],
    TUITION_INSTALLMENT: ['finance', 'tuition-installments'],
    TUITION_PAYMENT: ['finance', 'tuition-payments'],
    PAYMENT_PLAN: ['finance', 'payment-plans'],
    PAYMENT_FLOW: ['finance', 'payment-flows'],
    // Pédagogie
    ATTENDANCE: ['pedagogy', 'attendance'],
    ABSENCE: ['pedagogy', 'absences'],
    HOMEWORK: ['pedagogy', 'homeworks'],
    HOMEWORK_ENTRY: ['pedagogy', 'homework-entries'],
    HOMEWORK_SUBMISSION: ['pedagogy', 'homework-submissions'],
    PEDAGOGICAL_FILE: ['pedagogy', 'pedagogical-files'],
    CLASS_DIARY: ['pedagogy', 'class-diaries'],
    LESSON_PLAN: ['pedagogy', 'lesson-plans'],
    LESSON_JOURNAL: ['pedagogy', 'lesson-journals'],
    LESSON_JOURNAL_ENTRY: ['pedagogy', 'lesson-journal-entries'],
    WEEKLY_SEMAINIER: ['pedagogy', 'weekly-semainier'],
    TEACHER_CLASS_ASSIGNMENT: ['pedagogy', 'teacher-class-assignments'],
    ACADEMIC_SERIES: ['pedagogy', 'academic-series'],
    SERIES_SUBJECT: ['pedagogy', 'series-subjects'],
    TEACHER_PROFILE: ['pedagogy', 'teacher-profiles'],
    PEDAGOGICAL_MATERIAL: ['pedagogy', 'pedagogical-materials'],
    MATERIAL_STOCK: ['pedagogy', 'material-stocks'],
    MATERIAL_MOVEMENT: ['pedagogy', 'material-movements'],
    TEACHER_MATERIAL_ASSIGNMENT: ['pedagogy', 'teacher-material-assignments'],
    TEACHING_ASSIGNMENT: ['pedagogy', 'teaching-assignments'],
    TIMETABLE: ['pedagogy', 'timetables'],
    TIMETABLE_ENTRY: ['pedagogy', 'timetable-entries'],
    ACADEMIC_CLASS: ['pedagogy', 'academic-classes'],
    ACADEMIC_CYCLE: ['pedagogy', 'academic-cycles'],
    ACADEMIC_LEVEL: ['pedagogy', 'academic-levels'],
    // Discipline
    DISCIPLINARY_INCIDENT: ['students', 'disciplinary-incidents'],
    INCIDENT: ['students', 'incidents'],
    // Réunions
    MEETING: ['meetings', 'meetings'],
    MEETING_PARTICIPANT: ['meetings', 'participants'],
    MEETING_AGENDA_ITEM: ['meetings', 'agenda-items'],
    MEETING_MINUTE: ['meetings', 'minutes'],
    // Communication
    MESSAGE: ['communication', 'messages'],
    MESSAGE_RECIPIENT: ['communication', 'message-recipients'],
    MESSAGE_TEMPLATE: ['communication', 'message-templates'],
    ANNOUNCEMENT: ['communication', 'announcements'],
    SMS_LOG: ['communication', 'sms-logs'],
    EMAIL_LOG: ['communication', 'email-logs'],
    PUSH_NOTIFICATION: ['communication', 'push-notifications'],
    COMMUNICATION_CHANNEL: ['communication', 'channels'],
    NOTIFICATION: ['communication', 'notifications'],
    ALERT: ['communication', 'alerts'],
    // Agrégation
    AGGREGATION_RESULT: ['aggregation', 'results'],
    AGGREGATION_SESSION: ['aggregation', 'sessions'],
    AGGREGATION_DECISION: ['aggregation', 'decisions'],
    RANKING: ['aggregation', 'rankings'],
    HONOR_ROLL: ['aggregation', 'honor-rolls'],
    // ORION
    ORION_ALERT: ['orion', 'alerts'],
    ORION_INSIGHT: ['orion', 'insights'],
    ORION_FORECAST: ['orion', 'forecasts'],
    ORION_SETTINGS: ['orion', 'settings'],
    // Settings
    SCHOOL_ACADEMIC_SETTING: ['settings', 'academic-settings'],
    SCHOOL_SETTINGS: ['settings', 'school-settings'],
    TENANT_IDENTITY_PROFILE: ['settings', 'identity'],
    SETTINGS_PEDAGOGICAL_STRUCTURE: ['settings', 'pedagogical-structure'],
    SETTINGS_BILINGUAL: ['settings', 'bilingual'],
    TENANT_FEATURE: ['settings', 'features'],
    SECURITY_SETTINGS: ['settings', 'security'],
    OFFLINE_SYNC_SETTINGS: ['settings', 'offline-sync'],
    SETTINGS_COMMUNICATION: ['settings', 'communication'],
    TENANT_STAMP: ['settings', 'stamps'],
    TENANT_SIGNATURE: ['settings', 'signatures'],
    ROLE: ['settings', 'roles'],
    PERMISSION: ['settings', 'permissions'],
    SETTINGS_HISTORY: ['settings', 'history'],
    // Cantine
    CANTEEN_SETTINGS: ['canteen', 'settings'],
    CANTEEN_MENU: ['canteen', 'menus'],
    CANTEEN_MEAL_SERVICE: ['canteen', 'meal-services'],
    CANTEEN_ATTENDANCE: ['canteen', 'attendance'],
    CANTEEN_SUBSCRIPTION: ['canteen', 'subscriptions'],
    CANTEEN_PAYMENT: ['canteen', 'payments'],
    // Transport
    VEHICLE: ['transport', 'vehicles'],
    ROUTE: ['transport', 'routes'],
    TRANSPORT_DRIVER: ['transport', 'drivers'],
    TRANSPORT_TRIP: ['transport', 'trips'],
    TRANSPORT_ASSIGNMENT: ['transport', 'assignments'],
    TRANSPORT_SETTINGS: ['transport', 'settings'],
    // Infirmerie
    INFIRMARY_VISIT: ['infirmary', 'visits'],
    INFIRMARY_MEDICAL_RECORD: ['infirmary', 'medical-records'],
    INFIRMARY_MEDICATION_STOCK: ['infirmary', 'medication-stocks'],
    INFIRMARY_SETTINGS: ['infirmary', 'settings'],
    // QHSE
    QHSE_AUDIT: ['qhse', 'audits'],
    QHSE_INCIDENT: ['qhse', 'incidents'],
    QHSE_RISK: ['qhse', 'risks'],
    QHSE_ACTION_PLAN: ['qhse', 'action-plans'],
    QHSE_SETTING: ['qhse', 'settings'],
    // EduCast
    EDUCAST_CONTENT: ['educast', 'contents'],
    EDUCAST_CHANNEL: ['educast', 'channels'],
    EDUCAST_PLAYLIST: ['educast', 'playlists'],
    EDUCAST_SETTINGS: ['educast', 'settings'],
    // Boutique
    SHOP_PRODUCT: ['shop', 'products'],
    SHOP_CATEGORY: ['shop', 'categories'],
    SHOP_ORDER: ['shop', 'orders'],
    SHOP_SALE: ['shop', 'sales'],
    SHOP_SETTINGS: ['shop', 'settings'],
    // Bibliothèque
    LIBRARY_BOOK: ['library', 'books'],
    LIBRARY_LOAN: ['library', 'loans'],
    LIBRARY_RESERVATION: ['library', 'reservations'],
    LIBRARY_SETTINGS: ['library', 'settings'],
    // Divers
    SESSION: ['pedagogy', 'sessions'],
    LOAN: ['library', 'loans'],
    REPORT: ['exams', 'reports'],
    MODULE: ['settings', 'modules'],
  };

  const mapping = routeMap[entityType];
  if (!mapping) return null;

  const [module, resource] = mapping;
  const base = `/api/${module}/${resource}`;

  switch (operation) {
    case 'CREATE':
      return base;
    case 'UPDATE':
      return entityId ? `${base}/${entityId}` : base;
    case 'DELETE':
      return entityId ? `${base}/${entityId}` : base;
    default:
      return base;
  }
}

/**
 * Détermine la méthode HTTP selon l'opération
 */
function getHttpMethod(operation: SyncOperationType): string {
  switch (operation) {
    case 'CREATE': return 'POST';
    case 'UPDATE': return 'PUT';
    case 'DELETE': return 'DELETE';
    default: return 'POST';
  }
}

// ─────────────────────────────────────────────────────────────────
// Service principal
// ─────────────────────────────────────────────────────────────────

class DualWriteService {
  /**
   * Opération dual-write universelle — persiste simultanément en local et à distance.
   *
   * C'EST LA MÉTHODE CENTRALE. Tous les modules doivent passer par ici
   * pour toute opération de création, mise à jour ou suppression.
   */
  async execute<T = any>(config: DualWriteConfig): Promise<DualWriteResult<T>> {
    const {
      tenantId,
      entityType,
      entityId,
      operation,
      data,
      conflictStrategy = 'LAST_WRITE_WINS',
      userId,
      metadata,
      localOnly = false,
      remoteOnly = false,
      storeName: customStoreName,
      remoteUrl: customRemoteUrl,
      remoteMethod: customRemoteMethod,
      remotePayload,
      remoteTimeout = 10000,
      maxRemoteRetries = 2,
    } = config;

    const storeName = customStoreName || ENTITY_TO_STORE[entityType] || `${entityType.toLowerCase()}s`;
    const now = new Date().toISOString();
    const resolvedEntityId = entityId || data?.id || generateUUID();

    // Résultat par défaut
    const result: DualWriteResult<T> = {
      status: 'FAILED',
      localData: null,
      remoteData: null,
      localSuccess: false,
      remoteSuccess: false,
    };

    // ── 1. ÉCRITURE LOCALE (sauf si remoteOnly) ──
    if (!remoteOnly) {
      try {
        const localEntity = this.prepareLocalEntity(data, resolvedEntityId, tenantId, operation, now, storeName);
        await localDb.execute(storeName, 'put', localEntity);
        result.localData = localEntity as T;
        result.localSuccess = true;
      } catch (localError: any) {
        console.error(`[DualWrite] Local write failed for ${entityType}:`, localError);
        result.error = `Local: ${localError.message}`;

        // Si l'écriture locale échoue, on ne continue pas — la donnée serait perdue
        if (!remoteOnly) {
          return result;
        }
      }
    }

    // ── 2. ÉCRITURE DISTANTE (sauf si localOnly ou hors ligne) ──
    const isOnline = networkDetectionService.isConnected();

    if (!localOnly && isOnline) {
      try {
        const remoteResult = await this.writeRemote<T>(
          entityType,
          operation,
          resolvedEntityId,
          remotePayload || data,
          customRemoteUrl,
          customRemoteMethod,
          remoteTimeout,
          maxRemoteRetries
        );

        if (remoteResult.success) {
          result.remoteData = remoteResult.data;
          result.remoteSuccess = true;

          // Si les deux ont réussi → SYNCED
          if (result.localSuccess) {
            // Mettre à jour le local avec les données serveur (id auto, updatedAt serveur, etc.)
            await this.reconcileLocalWithRemote(storeName, resolvedEntityId, remoteResult.data, tenantId);
            result.localData = { ...result.localData, ...remoteResult.data } as T;
            result.status = 'SYNCED';
          } else {
            // Seul le remote a réussi (remoteOnly ou local échoué)
            result.status = 'REMOTE_ONLY';
            // Persister quand même localement pour cohérence
            try {
              await localDb.execute(storeName, 'put', {
                ...remoteResult.data,
                tenantId,
                _isDirty: false,
                _lastSync: now,
              });
              result.localData = remoteResult.data;
              result.localSuccess = true;
            } catch {
              // On ne bloque pas si la mise à jour locale échoue ici
            }
          }
        } else {
          // Remote a échoué → on garde le local et on met dans l'outbox
          result.error = remoteResult.error;

          if (result.localSuccess) {
            // Créer l'événement outbox pour retry ultérieur
            const outboxEventId = await outboxService.createEvent(
              tenantId,
              operation,
              entityType,
              resolvedEntityId,
              remotePayload || data,
              { ...metadata, conflictStrategy, failedRemoteAttempt: true }
            );
            result.outboxEventId = outboxEventId;
            result.status = 'LOCAL_ONLY';

            // Déclencher sync pour retry
            offlineSyncService.sync().catch(() => {});
          }
        }
      } catch (remoteError: any) {
        console.error(`[DualWrite] Remote write failed for ${entityType}:`, remoteError);
        result.error = `Remote: ${remoteError.message}`;

        if (result.localSuccess) {
          const outboxEventId = await outboxService.createEvent(
            tenantId,
            operation,
            entityType,
            resolvedEntityId,
            remotePayload || data,
            { ...metadata, conflictStrategy, failedRemoteAttempt: true }
          );
          result.outboxEventId = outboxEventId;
          result.status = 'LOCAL_ONLY';
          offlineSyncService.sync().catch(() => {});
        }
      }
    } else if (result.localSuccess && !isOnline) {
      // ── HORS LIGNE : local réussi, remote impossible → outbox ──
      const outboxEventId = await outboxService.createEvent(
        tenantId,
        operation,
        entityType,
        resolvedEntityId,
        remotePayload || data,
        { ...metadata, conflictStrategy, offline: true }
      );
      result.outboxEventId = outboxEventId;
      result.status = 'LOCAL_ONLY';
    } else if (result.localSuccess && localOnly) {
      // ── LOCAL SEULEMENT (demandé explicitement) → outbox pour sync futur ──
      const outboxEventId = await outboxService.createEvent(
        tenantId,
        operation,
        entityType,
        resolvedEntityId,
        remotePayload || data,
        { ...metadata, conflictStrategy, localOnlyRequested: true }
      );
      result.outboxEventId = outboxEventId;
      result.status = 'LOCAL_ONLY';
    }

    // ── 3. AUDIT LOG ──
    if (userId && result.status !== 'FAILED') {
      try {
        await LocalAuditService.log(
          tenantId,
          userId,
          operation as any,
          entityType,
          resolvedEntityId,
          { status: result.status, localSuccess: result.localSuccess, remoteSuccess: result.remoteSuccess }
        );
      } catch {
        // L'audit ne doit jamais bloquer l'opération
      }
    }

    return result;
  }

  /**
   * Création dual-write — raccourci pour operation='CREATE'
   */
  async create<T = any>(
    tenantId: string,
    entityType: SyncEntityType,
    data: any,
    options?: Partial<DualWriteConfig>
  ): Promise<DualWriteResult<T>> {
    return this.execute<T>({
      tenantId,
      entityType,
      operation: 'CREATE',
      data,
      ...options,
    });
  }

  /**
   * Mise à jour dual-write — raccourci pour operation='UPDATE'
   */
  async update<T = any>(
    tenantId: string,
    entityType: SyncEntityType,
    entityId: string,
    data: any,
    options?: Partial<DualWriteConfig>
  ): Promise<DualWriteResult<T>> {
    return this.execute<T>({
      tenantId,
      entityType,
      entityId,
      operation: 'UPDATE',
      data,
      ...options,
    });
  }

  /**
   * Suppression dual-write — raccourci pour operation='DELETE'
   */
  async delete<T = any>(
    tenantId: string,
    entityType: SyncEntityType,
    entityId: string,
    options?: Partial<DualWriteConfig>
  ): Promise<DualWriteResult<T>> {
    return this.execute<T>({
      tenantId,
      entityType,
      entityId,
      operation: 'DELETE',
      data: { id: entityId },
      ...options,
    });
  }

  /**
   * Lecture dual-write — lit d'abord localement, puis tente de rafraîchir depuis le serveur.
   * Retourne les données locales immédiatement, et les données rafraîchies si en ligne.
   */
  async read<T = any>(
    tenantId: string,
    entityType: SyncEntityType,
    entityId: string,
    options?: { storeName?: string; remoteUrl?: string; forceRemote?: boolean }
  ): Promise<{ data: T | null; source: 'local' | 'remote' | 'cached' }> {
    const storeName = options?.storeName || ENTITY_TO_STORE[entityType] || `${entityType.toLowerCase()}s`;

    // 1. Lire localement d'abord
    let localEntity: T | null = null;
    try {
      const entities = await localDb.query<T & { id: string }>(storeName);
      localEntity = entities.find((e: any) => e.id === entityId) as T || null;
    } catch {
      // Store peut ne pas exister encore
    }

    // 2. Si en ligne et forceRemote, rafraîchir depuis le serveur
    if (networkDetectionService.isConnected() && (options?.forceRemote || !localEntity)) {
      try {
        const remoteUrl = options?.remoteUrl || getDefaultRemoteUrl(entityType, 'UPDATE', entityId);
        if (remoteUrl) {
          const response = await this.fetchWithAuth(remoteUrl, { method: 'GET' });
          if (response.ok) {
            const remoteData = await response.json();
            // Mettre à jour le cache local
            try {
              await localDb.execute(storeName, 'put', {
                ...remoteData,
                tenantId,
                _isDirty: false,
                _lastSync: new Date().toISOString(),
              });
            } catch {
              // Mise à jour cache non critique
            }
            return { data: remoteData, source: 'remote' };
          }
        }
      } catch {
        // Remote échoué → on retourne le local
      }
    }

    if (localEntity) {
      return { data: localEntity, source: 'cached' };
    }

    return { data: null, source: 'local' };
  }

  /**
   * Lecture par query local — retourne toutes les entités d'un type pour un tenant
   */
  async readAll<T = any>(
    tenantId: string,
    entityType: SyncEntityType,
    options?: { storeName?: string }
  ): Promise<T[]> {
    const storeName = options?.storeName || ENTITY_TO_STORE[entityType] || `${entityType.toLowerCase()}s`;
    try {
      const entities = await localDb.query<T & { tenantId: string; _deleted?: boolean }>(storeName);
      return entities.filter((e: any) => e.tenantId === tenantId && !e._deleted);
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Méthodes internes
  // ─────────────────────────────────────────────────────────────────

  /**
   * Prépare l'entité pour l'écriture locale avec les champs techniques
   */
  private prepareLocalEntity(
    data: any,
    entityId: string,
    tenantId: string,
    operation: SyncOperationType,
    now: string,
    storeName: string
  ): any {
    if (operation === 'DELETE') {
      return {
        id: entityId,
        tenantId,
        _deleted: true,
        _isDirty: true,
        _version: Date.now(),
        updatedAt: now,
      };
    }

    return {
      ...data,
      id: entityId,
      tenantId,
      _isDirty: true,
      _deleted: false,
      _version: Date.now(),
      _lastSync: null,
      createdAt: data?.createdAt || now,
      updatedAt: now,
    };
  }

  /**
   * Écrit à distance via fetch avec retry
   */
  private async writeRemote<T>(
    entityType: SyncEntityType,
    operation: SyncOperationType,
    entityId: string,
    data: any,
    customUrl?: string,
    customMethod?: string,
    timeout: number = 10000,
    maxRetries: number = 2
  ): Promise<{ success: boolean; data: T | null; error?: string }> {
    const url = customUrl || getDefaultRemoteUrl(entityType, operation, entityId);
    if (!url) {
      return { success: false, data: null, error: 'No remote URL available' };
    }

    const method = customMethod || getHttpMethod(operation);
    let lastError: string = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const body = operation === 'DELETE' ? undefined : JSON.stringify(data);
        const response = await this.fetchWithAuth(url, {
          method,
          body,
          signal: AbortSignal.timeout(timeout),
        });

        if (response.ok) {
          let responseData: T | null = null;
          try {
            responseData = await response.json();
          } catch {
            // 204 No Content ou réponse non-JSON
          }
          return { success: true, data: responseData };
        }

        // Conflit détecté (409 Conflict)
        if (response.status === 409) {
          const conflictData = await response.json().catch(() => ({}));
          return {
            success: false,
            data: null,
            error: `CONFLICT: ${conflictData.message || 'Data conflict detected'}`,
          };
        }

        // Erreur serveur → retry
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        if (response.status >= 500 && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }

        // Erreur client (4xx) → pas de retry
        return { success: false, data: null, error: lastError };
      } catch (error: any) {
        lastError = error.message || 'Network error';
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
      }
    }

    return { success: false, data: null, error: lastError };
  }

  /**
   * Réconcilie les données locales avec les données distantes après un SYNCED
   * Met à jour l'ID local si le serveur en a généré un différent,
   * et marque _isDirty = false.
   */
  private async reconcileLocalWithRemote(
    storeName: string,
    localEntityId: string,
    remoteData: any,
    tenantId: string
  ): Promise<void> {
    if (!remoteData) return;

    try {
      // Le serveur peut avoir généré un nouvel ID
      const serverId = remoteData.id || localEntityId;

      // Si l'ID local est différent de l'ID serveur, il faut mettre à jour
      if (serverId !== localEntityId) {
        // Supprimer l'ancienne entrée locale (avec l'ancien ID)
        try {
          await localDb.execute(storeName, 'delete', localEntityId);
        } catch {
          // L'ancienne entrée peut ne pas exister
        }
      }

      // Écrire les données serveur dans le store local
      await localDb.execute(storeName, 'put', {
        ...remoteData,
        tenantId,
        _isDirty: false,
        _lastSync: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[DualWrite] Reconciliation failed for ${storeName}:${localEntityId}:`, error);
    }
  }

  /**
   * Fetch avec authentification automatique
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const authHeaders = getClientAuthorizationHeader();
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });
  }

  /**
   * Retourne le nom du store pour un entityType donné
   */
  getStoreName(entityType: SyncEntityType): string {
    return ENTITY_TO_STORE[entityType] || `${entityType.toLowerCase()}s`;
  }

  /**
   * Retourne le mapping complet EntityType → Store
   */
  getEntityToStoreMapping(): Record<SyncEntityType, string> {
    return { ...ENTITY_TO_STORE };
  }

  /**
   * Vérifie la cohérence entre les données locales et distantes
   * pour un entityType donné. Retourne les IDs en désynchronisation.
   */
  async checkConsistency(
    tenantId: string,
    entityType: SyncEntityType
  ): Promise<{ dirtyIds: string[]; missingRemoteIds: string[]; missingLocalIds: string[] }> {
    const storeName = this.getStoreName(entityType);
    const dirtyIds: string[] = [];

    try {
      const localEntities = await localDb.query<{ id: string; _isDirty?: boolean; tenantId: string }>(storeName);
      const tenantEntities = localEntities.filter((e: any) => e.tenantId === tenantId);

      for (const entity of tenantEntities) {
        if (entity._isDirty) {
          dirtyIds.push(entity.id);
        }
      }
    } catch {
      // Store peut ne pas exister
    }

    return {
      dirtyIds,
      missingRemoteIds: [], // Nécessite un appel serveur — à implémenter dans Phase 3
      missingLocalIds: [],  // Nécessite un appel serveur — à implémenter dans Phase 3
    };
  }

  /**
   * Force la synchronisation de toutes les entités dirty d'un tenant
   */
  async forceSyncAll(tenantId: string): Promise<{ synced: number; failed: number }> {
    try {
      await offlineSyncService.sync();
      const state = await localDb.query<any>('sync_state');
      const tenantState = state.find((s: any) => s.tenantId === tenantId);
      return {
        synced: tenantState?.pendingEventsCount === 0 ? 1 : 0,
        failed: 0,
      };
    } catch {
      return { synced: 0, failed: 1 };
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────

/**
 * Génère un UUID v4 (cryptographiquement sûr si crypto.randomUUID disponible)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback pour les environnements sans crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────────
// Export singleton
// ─────────────────────────────────────────────────────────────────

export const dualWriteService = new DualWriteService();
export default dualWriteService;
