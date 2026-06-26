/**
 * ============================================================================
 * ROLE-PORTAL MAPPING — Conforme au document academia-helm-portails.md
 * ============================================================================
 *
 * Mapping canonique des 77+ rôles vers leurs portails respectifs.
 * Ce fichier est la SEULE source de vérité côté frontend pour :
 *   - Déterminer quel portail afficher selon le rôle
 *   - Valider qu'un rôle peut se connecter via un portail donné
 *   - Filtrer les options de portail selon le contexte (sous-domaine école)
 *   - Afficher les modules/accessibles selon le niveau d'accréditation
 *
 * Modèle RBAC 7 dimensions :
 *   portal → role → function → accreditations → levelScopes → classScopes → permissions
 *
 * 5 Portails :
 *   - PLATFORM (7 rôles)  : Administration SaaS globale
 *   - SCHOOL   (45 rôles) : Gestion de l'établissement
 *   - TEACHER  (11 rôles) : Pédagogie & suivi
 *   - PARENT   (9 rôles)  : Suivi & communication
 *   - PUBLIC   (5 rôles)  : Pré-inscription & acquisition
 * ============================================================================
 */

import { RESERVED_SUBDOMAINS } from '@/lib/tenant/constants';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PortalType = 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC';

export type AccreditationLevel =
  | 'ALL_LEVELS'
  | 'MATERNELLE_ADMIN'
  | 'PRIMARY_ADMIN'
  | 'SECONDARY_ADMIN'
  | 'MATERNELLE'
  | 'PRIMARY'
  | 'SECONDARY';

export interface RolePortalEntry {
  /** Nom du rôle technique (stocké en DB / JWT) */
  role: string;
  /** Portail autorisé pour ce rôle */
  portal: PortalType;
  /** Fonction métier (ex: CENSEUR, CAISSIER) */
  functionLabel: string;
  /** Accréditations (périmètre niveau) */
  accreditations?: AccreditationLevel[];
  /** Niveaux autorisés */
  levelScopes?: string[];
  /** Permissions principales */
  permissions?: string[];
}

// ─── PORTAIL 01 — PLATEFORME (7 rôles) ─────────────────────────────────────

const PLATFORM_ROLES: RolePortalEntry[] = [
  {
    role: 'PLATFORM_OWNER',
    portal: 'PLATFORM',
    functionLabel: 'Propriétaire de la Plateforme',
    accreditations: ['ALL_LEVELS'],
    permissions: ['ALL'],
  },
  {
    role: 'PLATFORM_SUPER_ADMIN',
    portal: 'PLATFORM',
    functionLabel: 'Super Administrateur de la Plateforme',
    permissions: ['TENANT_MANAGE', 'PLAN_CONFIGURE', 'ROLE_MANAGE', 'SECURITY_AUDIT', 'SYSTEM_DIAGNOSE'],
  },
  {
    role: 'PLATFORM_ADMIN',
    portal: 'PLATFORM',
    functionLabel: 'Administrateur de la Plateforme',
    permissions: ['TENANT_VIEW', 'TENANT_SUPPORT', 'INCIDENT_MANAGE', 'CONFIG_LIMITED'],
  },
  {
    role: 'BILLING_MANAGER',
    portal: 'PLATFORM',
    functionLabel: 'Gestionnaire de Facturation',
    permissions: ['SUBSCRIPTION_MANAGE', 'INVOICE_MANAGE', 'PAYMENT_VIEW', 'SUSPENSION_TRIGGER', 'REPORT_FINANCIAL'],
  },
  {
    role: 'SUPPORT_AGENT',
    portal: 'PLATFORM',
    functionLabel: 'Agent de Support',
    permissions: ['TICKET_MANAGE', 'TENANT_VIEW_LIMITED', 'INCIDENT_CREATE', 'USER_ASSIST'],
  },
  {
    role: 'TECHNICAL_OPERATOR',
    portal: 'PLATFORM',
    functionLabel: 'Opérateur Technique / DevOps',
    permissions: ['INFRA_MANAGE', 'LOG_ACCESS', 'BACKUP_MANAGE', 'SECURITY_TECHNICAL', 'INTEGRATION_MANAGE'],
  },
  {
    role: 'PLATFORM_AUDITOR',
    portal: 'PLATFORM',
    functionLabel: 'Auditeur de la Plateforme',
    permissions: ['AUDIT_LOG_VIEW', 'COMPLIANCE_REPORT', 'ACCESS_ANALYSIS'],
  },
];

// ─── PORTAIL 02 — ÉCOLE (45 rôles) ─────────────────────────────────────────

const SCHOOL_ROLES: RolePortalEntry[] = [
  // 3.1 — Gouvernance et Direction Générale
  // PROMOTER est l'alias canonique du "Promoteur / Fondateur" — rôle stocké en DB
  // pour les comptes promoteurs créés via les scripts d'insertion. Il bénéficie
  // des mêmes permissions que SCHOOL_OWNER (accès à tous les modules école).
  { role: 'PROMOTER', portal: 'SCHOOL', functionLabel: 'Promoteur / Fondateur', accreditations: ['ALL_LEVELS'], permissions: ['ALL_VIEW', 'STRATEGIC_REPORT', 'FINANCE_CONSOLIDATED', 'DECISION_VALIDATE'] },
  { role: 'SCHOOL_OWNER', portal: 'SCHOOL', functionLabel: 'Promoteur / Fondateur', accreditations: ['ALL_LEVELS'], permissions: ['ALL_VIEW', 'STRATEGIC_REPORT', 'FINANCE_CONSOLIDATED', 'DECISION_VALIDATE'] },
  { role: 'BOARD_PRESIDENT', portal: 'SCHOOL', functionLabel: 'Président CA', accreditations: ['ALL_LEVELS'], permissions: ['REPORT_VIEW', 'FINANCE_VIEW', 'GOVERNANCE_AUDIT', 'STRATEGIC_VALIDATE'] },
  { role: 'DIRECTOR_GENERAL', portal: 'SCHOOL', functionLabel: 'Directeur Général', accreditations: ['ALL_LEVELS'], permissions: ['ALL_MANAGE', 'INCIDENT_MANAGE', 'REPORT_FULL', 'DECISION_VALIDATE'] },
  { role: 'SCHOOL_DIRECTOR', portal: 'SCHOOL', functionLabel: 'Directeur d\'Établissement', accreditations: ['ALL_LEVELS'], permissions: ['STUDENT_MANAGE', 'TEACHER_MANAGE', 'BULLETIN_VALIDATE', 'DISCIPLINE_MANAGE', 'COMMUNICATION_OFFICIAL'] },
  { role: 'DEPUTY_DIRECTOR', portal: 'SCHOOL', functionLabel: 'Directeur Adjoint', accreditations: ['ALL_LEVELS'], permissions: ['STUDENT_VIEW', 'TEACHER_VIEW', 'BULLETIN_VIEW', 'COORDINATION_MANAGE'] },

  // 3.2 — Administration Générale
  { role: 'SCHOOL_ADMIN', portal: 'SCHOOL', functionLabel: 'Secrétaire Général', permissions: ['DOCUMENT_MANAGE', 'ARCHIVE_MANAGE', 'SECRETARIAT_SUPERVISE', 'MAIL_MANAGE'] },
  { role: 'ADMIN_AGENT', portal: 'SCHOOL', functionLabel: 'Agent Administratif', permissions: ['DATA_ENTRY', 'DOCUMENT_PREPARE', 'ARCHIVE_VIEW', 'TASK_LIMITED'] },
  { role: 'RESP_SCOLARITE', portal: 'SCHOOL', functionLabel: 'Responsable Scolarité Générale', permissions: ['STUDENT_MANAGE', 'ADMISSION_MANAGE', 'ENROLLMENT_MANAGE', 'STAT_ACADEMIC', 'LEVEL_SUPERVISE'] },
  { role: 'DATA_MANAGER', portal: 'SCHOOL', functionLabel: 'Gestionnaire de Données', permissions: ['DATA_IMPORT', 'DATA_EXPORT', 'DATA_CLEAN', 'DUPLICATE_MANAGE', 'CONSOLIDATION'] },
  { role: 'INTERNAL_AUDITOR', portal: 'SCHOOL', functionLabel: 'Auditeur Interne', permissions: ['AUDIT_LOG_VIEW', 'ACCESS_REVIEW', 'FINANCE_AUDIT', 'SCOLARITE_AUDIT'] },

  // 3.3 — Maternelle
  { role: 'RESP_MATERNELLE', portal: 'SCHOOL', functionLabel: 'Responsable Maternelle', accreditations: ['MATERNELLE_ADMIN'], levelScopes: ['MATERNELLE'], permissions: ['STUDENT_VIEW', 'STUDENT_CREATE', 'QUALITATIVE_EVAL_MANAGE', 'REPORT_BOOK_VALIDATE', 'PARENT_COMMUNICATION'] },
  { role: 'PEDAGOGIC_COORDINATOR', portal: 'SCHOOL', functionLabel: 'Coordinateur Pédagogique Maternelle', accreditations: ['MATERNELLE_ADMIN'], levelScopes: ['MATERNELLE'], permissions: ['EVAL_QUALITATIVE', 'PROG_MANAGE', 'TEACHER_SUPPORT', 'APPRECIATION_VALIDATE'] },
  { role: 'EXAM_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Examens', accreditations: ['PRIMARY_ADMIN', 'SECONDARY_ADMIN'], permissions: ['EXAM_PLAN', 'GRADE_COLLECT', 'AVERAGE_COMPUTE', 'BULLETIN_PREPARE'] },
  { role: 'SECRETARY', portal: 'SCHOOL', functionLabel: 'Secrétaire', accreditations: ['MATERNELLE_ADMIN', 'PRIMARY_ADMIN', 'SECONDARY_ADMIN'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'CERTIFICATE_GENERATE', 'LIST_EXPORT'] },
  { role: 'MONITOR', portal: 'SCHOOL', functionLabel: 'Surveillant / Assistant Vie Scolaire', accreditations: ['MATERNELLE_ADMIN', 'PRIMARY_ADMIN'], permissions: ['ATTENDANCE_MANAGE', 'INCIDENT_MINOR', 'PARENT_ALERT', 'DISCIPLINE_MANAGE'] },
  { role: 'TEACHING_ASSISTANT', portal: 'SCHOOL', functionLabel: 'Assistant(e) Maternelle', accreditations: ['MATERNELLE_ADMIN'], levelScopes: ['MATERNELLE'], permissions: ['STUDENT_VIEW', 'ATTENDANCE_VIEW', 'OBSERVATION_ADD'] },
  { role: 'ACTIVITIES_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Activités', accreditations: ['PRIMARY_ADMIN'], levelScopes: ['PRIMARY'], permissions: ['ACTIVITY_MANAGE', 'TRIP_MANAGE', 'CLUB_MANAGE', 'CONSENT_MANAGE'] },

  // 3.4 — Primaire
  { role: 'RESP_PRIMAIRE', portal: 'SCHOOL', functionLabel: 'Responsable Primaire', accreditations: ['PRIMARY_ADMIN'], levelScopes: ['PRIMARY'], permissions: ['STUDENT_MANAGE', 'TEACHER_SUPERVISE', 'GRADE_VALIDATE', 'BULLETIN_VALIDATE', 'REPORT_PRIMARY'] },

  // 3.5 — Secondaire
  { role: 'RESP_SECONDAIRE', portal: 'SCHOOL', functionLabel: 'Responsable Secondaire', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['STUDENT_MANAGE', 'SUBJECT_MANAGE', 'COEFFICIENT_MANAGE', 'EXAM_MANAGE', 'GRADE_VALIDATE', 'BULLETIN_VALIDATE', 'CLASS_COUNCIL'] },
  { role: 'CENSOR', portal: 'SCHOOL', functionLabel: 'Censeur', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['TIMETABLE_MANAGE', 'PROGRAM_SUPERVISE', 'GRADE_SUPERVISE', 'COEFFICIENT_CHECK', 'EXAM_SUPERVISE', 'CLASS_COUNCIL'] },
  { role: 'GENERAL_MONITOR', portal: 'SCHOOL', functionLabel: 'Surveillant Général', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['ATTENDANCE_MANAGE', 'DISCIPLINE_MANAGE', 'SANCTION_MANAGE', 'CONVOCATION_MANAGE', 'INCIDENT_LOG', 'LIFE_REPORT'] },

  // 3.6 — Rôles administratifs level-specific (Phase 2 multi-niveaux)
  // Ces rôles permettent d'avoir un Directeur/Secrétaire/Secrétaire comptable
  // distinct pour chaque niveau (maternelle, primaire, secondaire).
  // En mode FUSED_MATERNELLE_PRIMAIRE, utiliser les variants _MAT_PRI.

  // Directeurs par niveau
  { role: 'DIRECTEUR_MATERNELLE', portal: 'SCHOOL', functionLabel: 'Directeur Maternelle', accreditations: ['MATERNELLE_ADMIN'], levelScopes: ['MATERNELLE'], permissions: ['STUDENT_MANAGE', 'TEACHER_MANAGE', 'BULLETIN_VALIDATE', 'DISCIPLINE_MANAGE', 'COMMUNICATION_OFFICIAL'] },
  { role: 'DIRECTEUR_PRIMAIRE', portal: 'SCHOOL', functionLabel: 'Directeur Primaire', accreditations: ['PRIMARY_ADMIN'], levelScopes: ['PRIMARY'], permissions: ['STUDENT_MANAGE', 'TEACHER_MANAGE', 'BULLETIN_VALIDATE', 'DISCIPLINE_MANAGE', 'COMMUNICATION_OFFICIAL'] },
  { role: 'DIRECTEUR_SECONDAIRE', portal: 'SCHOOL', functionLabel: 'Directeur Secondaire', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['STUDENT_MANAGE', 'TEACHER_MANAGE', 'BULLETIN_VALIDATE', 'DISCIPLINE_MANAGE', 'COMMUNICATION_OFFICIAL'] },
  // Mode FUSED : Directeur Maternelle + Primaire fusionnés
  { role: 'DIRECTEUR_MAT_PRI', portal: 'SCHOOL', functionLabel: 'Directeur Maternelle + Primaire', accreditations: ['MATERNELLE_ADMIN', 'PRIMARY_ADMIN'], levelScopes: ['MATERNELLE', 'PRIMARY'], permissions: ['STUDENT_MANAGE', 'TEACHER_MANAGE', 'BULLETIN_VALIDATE', 'DISCIPLINE_MANAGE', 'COMMUNICATION_OFFICIAL'] },

  // Secrétaires par niveau
  { role: 'SECRETAIRE_MATERNELLE', portal: 'SCHOOL', functionLabel: 'Secrétaire Maternelle', accreditations: ['MATERNELLE_ADMIN'], levelScopes: ['MATERNELLE'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'CERTIFICATE_GENERATE', 'LIST_EXPORT'] },
  { role: 'SECRETAIRE_PRIMAIRE', portal: 'SCHOOL', functionLabel: 'Secrétaire Primaire', accreditations: ['PRIMARY_ADMIN'], levelScopes: ['PRIMARY'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'CERTIFICATE_GENERATE', 'LIST_EXPORT'] },
  { role: 'SECRETAIRE_SECONDAIRE', portal: 'SCHOOL', functionLabel: 'Secrétaire Secondaire', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'CERTIFICATE_GENERATE', 'LIST_EXPORT'] },
  // Mode FUSED : Secrétaire Maternelle + Primaire fusionnés
  { role: 'SECRETAIRE_MAT_PRI', portal: 'SCHOOL', functionLabel: 'Secrétaire Maternelle + Primaire', accreditations: ['MATERNELLE_ADMIN', 'PRIMARY_ADMIN'], levelScopes: ['MATERNELLE', 'PRIMARY'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'CERTIFICATE_GENERATE', 'LIST_EXPORT'] },

  // Secrétaires comptables par niveau
  { role: 'SECRETAIRE_COMPTABLE_MATERNELLE', portal: 'SCHOOL', functionLabel: 'Secrétaire Comptable Maternelle', accreditations: ['MATERNELLE_ADMIN'], levelScopes: ['MATERNELLE'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'FEE_COLLECT', 'RECEIPT_GENERATE', 'LIST_EXPORT'] },
  { role: 'SECRETAIRE_COMPTABLE_PRIMAIRE', portal: 'SCHOOL', functionLabel: 'Secrétaire Comptable Primaire', accreditations: ['PRIMARY_ADMIN'], levelScopes: ['PRIMARY'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'FEE_COLLECT', 'RECEIPT_GENERATE', 'LIST_EXPORT'] },
  { role: 'SECRETAIRE_COMPTABLE_SECONDAIRE', portal: 'SCHOOL', functionLabel: 'Secrétaire Comptable Secondaire', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'FEE_COLLECT', 'RECEIPT_GENERATE', 'LIST_EXPORT'] },
  // Mode FUSED : Secrétaire Comptable Maternelle + Primaire fusionnés
  { role: 'SECRETAIRE_COMPTABLE_MAT_PRI', portal: 'SCHOOL', functionLabel: 'Secrétaire Comptable Maternelle + Primaire', accreditations: ['MATERNELLE_ADMIN', 'PRIMARY_ADMIN'], levelScopes: ['MATERNELLE', 'PRIMARY'], permissions: ['STUDENT_ENROLL', 'STUDENT_VIEW', 'FEE_COLLECT', 'RECEIPT_GENERATE', 'LIST_EXPORT'] },
  { role: 'ORIENTATION_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Orientation', accreditations: ['SECONDARY_ADMIN'], levelScopes: ['SECONDARY'], permissions: ['ORIENTATION_MANAGE', 'SERIES_ASSIGN', 'STUDENT_COUNSEL', 'FAMILY_COMMUNICATE', 'EXAM_PREPARE'] },

  // 3.6 — Finance et Économat
  { role: 'CFO', portal: 'SCHOOL', functionLabel: 'Directeur Administratif et Financier', permissions: ['FINANCE_ALL', 'BUDGET_MANAGE', 'CASHIER_SUPERVISE', 'REPORT_FINANCIAL', 'EXPENSE_VALIDATE', 'STRATEGY_FINANCIAL'] },
  { role: 'FINANCE_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Financier', permissions: ['FINANCE_VIEW', 'RECEIPT_MANAGE', 'EXPENSE_VIEW', 'ENCAISSEMENT_CHECK', 'UNPAID_TRACK', 'REPORT_FINANCIAL'] },
  { role: 'ACCOUNTANT', portal: 'SCHOOL', functionLabel: 'Comptable', permissions: ['ACCOUNTING_MANAGE', 'RECEIPT_RECORD', 'EXPENSE_RECORD', 'BANK_RECONCILE', 'FINANCIAL_STATEMENT', 'AUDIT_FINANCIAL'] },
  { role: 'CASHIER', portal: 'SCHOOL', functionLabel: 'Caissier', permissions: ['PAYMENT_RECEIVE', 'RECEIPT_GENERATE', 'STUDENT_BALANCE_VIEW', 'CASHIER_CLOSE', 'CASHIER_HISTORY', 'CANCELLATION_LIMITED'] },
  { role: 'RECOVERY_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Recouvrement', permissions: ['DEBTOR_TRACK', 'PARENT_REMIND', 'PAYMENT_PLAN', 'ACCESS_BLOCK', 'RECOVERY_REPORT', 'COMMUNICATION_COORDINATE'] },

  // 3.7 — Pédagogie, Vie Scolaire et Services
  { role: 'PEDAGOGIC_DIRECTOR', portal: 'SCHOOL', functionLabel: 'Responsable Pédagogique Général', permissions: ['CURRICULUM_ALL', 'EVAL_SUPERVISE', 'QUALITY_MANAGE', 'PEDAGOGY_REPORT', 'LEVEL_COORDINATE'] },
  { role: 'SCHOOL_LIFE_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Vie Scolaire', permissions: ['ATTENDANCE_ALL', 'DISCIPLINE_ALL', 'INCIDENT_MANAGE', 'SANCTION_MANAGE', 'SCHOOL_LIFE_REPORT'] },
  { role: 'COMMUNICATION_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Communication', permissions: ['ANNOUNCEMENT_MANAGE', 'CAMPAIGN_MANAGE', 'NOTIFICATION_MANAGE', 'MESSAGE_TEMPLATE', 'COMMUNICATION_STAT'] },
  { role: 'COMMUNICATION_AGENT', portal: 'SCHOOL', functionLabel: 'Chargé de Communication', permissions: ['MESSAGE_WRITE', 'ANNOUNCEMENT_SCHEDULE', 'CAMPAIGN_TRACK', 'TEMPLATE_MANAGE'] },
  { role: 'HR_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable RH', permissions: ['STAFF_MANAGE', 'CONTRACT_MANAGE', 'ABSENCE_STAFF', 'HR_DOSSIER', 'STAFF_EVAL', 'PAYROLL_MANAGE'] },
  { role: 'PAYROLL_MANAGER', portal: 'SCHOOL', functionLabel: 'Gestionnaire de Paie', permissions: ['PAYROLL_COMPUTE', 'SALARY_MANAGE', 'PAYSLIP_GENERATE', 'PAYROLL_HISTORY', 'PAYROLL_EXPORT'] },
  { role: 'IT_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Informatique', permissions: ['USER_MANAGE', 'EQUIPMENT_MANAGE', 'ACCESS_MANAGE', 'SECURITY_LOCAL', 'INTEGRATION_MANAGE', 'PORTAL_CONFIG'] },
  { role: 'LIBRARIAN', portal: 'SCHOOL', functionLabel: 'Bibliothécaire', permissions: ['CATALOG_MANAGE', 'LOAN_MANAGE', 'PENALTY_MANAGE', 'DIGITAL_RESOURCE', 'LIBRARY_STAT'] },
  { role: 'CANTEEN_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Cantine', permissions: ['MENU_MANAGE', 'SUBSCRIPTION_CANTEEN', 'MEAL_ATTENDANCE', 'CANTEEN_PAYMENT', 'STOCK_MANAGE', 'CANTEEN_REPORT'] },
  { role: 'TRANSPORT_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Transport', permissions: ['BUS_MANAGE', 'ROUTE_MANAGE', 'DRIVER_MANAGE', 'STUDENT_TRANSPORT', 'TRANSPORT_PAYMENT', 'TRANSPORT_INCIDENT', 'TRANSPORT_REPORT'] },
  { role: 'BOARDING_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Internat', permissions: ['ROOM_MANAGE', 'BOARDING_ATTENDANCE', 'BOARDING_DISCIPLINE', 'BOARDING_MEAL', 'BOARDING_EXIT', 'BOARDING_REPORT'] },
  { role: 'HEALTH_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Santé / Infirmerie', permissions: ['HEALTH_RECORD', 'MEDICAL_VISIT', 'ALLERGY_MANAGE', 'HEALTH_INCIDENT', 'MEDICAL_AUTH', 'HEALTH_ALERT', 'HEALTH_REPORT'] },
  { role: 'SECURITY_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Sécurité', permissions: ['ACCESS_CONTROL', 'VISITOR_MANAGE', 'EXIT_AUTHORIZE', 'SECURITY_INCIDENT', 'SECURITY_ALERT', 'SECURITY_REPORT'] },
  { role: 'SETTINGS_MANAGER', portal: 'SCHOOL', functionLabel: 'Responsable Paramètres', permissions: ['SCHOOL_CONFIG', 'ACADEMIC_YEAR', 'PERIOD_MANAGE', 'CLASS_SETUP', 'SUBJECT_SETUP', 'CALC_RULES', 'TEMPLATE_MANAGE', 'PERMISSION_LOCAL'] },
];

// ─── PORTAIL 03 — ENSEIGNANT (11 rôles) ────────────────────────────────────

const TEACHER_ROLES: RolePortalEntry[] = [
  { role: 'TEACHER', portal: 'TEACHER', functionLabel: 'Enseignant', levelScopes: ['MATERNELLE', 'PRIMARY', 'SECONDARY'], permissions: ['CLASS_MANAGE', 'ATTENDANCE_MANAGE', 'GRADE_ENTRY', 'APPRECIATION_ADD', 'HOMEWORK_MANAGE', 'PARENT_MESSAGE', 'BULLETIN_VIEW'] },
  { role: 'HEAD_TEACHER', portal: 'TEACHER', functionLabel: 'Professeur Principal', levelScopes: ['PRIMARY', 'SECONDARY'], permissions: ['CLASS_OVERVIEW', 'RESULT_SYNTHESIS', 'CLASS_APPRECIATION', 'CLASS_COUNCIL_PREPARE', 'ADMIN_COMMUNICATE'] },
  { role: 'SUBSTITUTE_TEACHER', portal: 'TEACHER', functionLabel: 'Enseignant Remplaçant', permissions: ['ATTENDANCE_MANAGE', 'CAHIER_TEXTE', 'HOMEWORK_MANAGE', 'GRADE_ENTRY_IF_AUTHORIZED'] },
  { role: 'TEACHER_ASSISTANT', portal: 'TEACHER', functionLabel: 'Assistant Enseignant', permissions: ['STUDENT_VIEW', 'HOMEWORK_VIEW', 'RESOURCE_VIEW', 'ATTENDANCE_VIEW_LIMITED'] },
  { role: 'DEPARTMENT_COORDINATOR', portal: 'TEACHER', functionLabel: 'Coordinateur de Département', permissions: ['TEACHER_COORDINATE', 'PROGRESSION_MANAGE', 'EVAL_HARMONIZE', 'DEPARTMENT_STAT', 'RESOURCE_SHARE'] },
  { role: 'PEDAGOGIC_ADVISOR', portal: 'TEACHER', functionLabel: 'Conseiller Pédagogique', permissions: ['TEACHER_OBSERVE', 'RECOMMENDATION_ADD', 'PROGRESSION_ANALYZE', 'PEDAGOGIC_REPORT'] },
  { role: 'TEACHER_RESP', portal: 'TEACHER', functionLabel: 'Enseignant Responsable', levelScopes: ['PRIMARY', 'SECONDARY'], permissions: ['CLASS_MANAGE', 'GRADE_ENTRY', 'CURRICULUM_MANAGE', 'EVAL_HARMONIZE'] },
  { role: 'TEACHER_INTERNSHIP', portal: 'TEACHER', functionLabel: 'Enseignant Stagiaire', permissions: ['STUDENT_VIEW', 'ATTENDANCE_VIEW', 'RESOURCE_VIEW'] },
  { role: 'TUTOR', portal: 'TEACHER', functionLabel: 'Tuteur', permissions: ['STUDENT_VIEW', 'GRADE_VIEW_LIMITED', 'PARENT_MESSAGE'] },
  { role: 'MENTOR', portal: 'TEACHER', functionLabel: 'Mentor', permissions: ['TEACHER_OBSERVE', 'RECOMMENDATION_ADD', 'RESOURCE_SHARE'] },
  { role: 'EXAMINER', portal: 'TEACHER', functionLabel: 'Examinateur', permissions: ['EXAM_SUPERVISE', 'GRADE_COLLECT'] },
];

// ─── PORTAIL 04 — PARENT / ÉLÈVE (9 rôles) ────────────────────────────────

const PARENT_ROLES: RolePortalEntry[] = [
  { role: 'PARENT', portal: 'PARENT', functionLabel: 'Parent Principal', permissions: ['CHILD_VIEW', 'PAYMENT_MAKE', 'BULLETIN_VIEW', 'ABSENCE_VIEW', 'MESSAGE_RECEIVE', 'MESSAGE_SEND', 'CONSENT_SIGN', 'DOCUMENT_DOWNLOAD'] },
  { role: 'PARENT_PRIMARY', portal: 'PARENT', functionLabel: 'Parent Principal (v2)', permissions: ['CHILD_VIEW', 'PAYMENT_MAKE', 'BULLETIN_VIEW', 'ABSENCE_VIEW', 'MESSAGE_RECEIVE', 'MESSAGE_SEND', 'CONSENT_SIGN', 'DOCUMENT_DOWNLOAD', 'NOTIFICATION_PREF', 'VOICE_ASSISTANCE'] },
  { role: 'PARENT_SECONDARY', portal: 'PARENT', functionLabel: 'Parent Secondaire', permissions: ['CHILD_VIEW', 'BULLETIN_VIEW', 'NOTIFICATION_RECEIVE', 'MESSAGE_RECEIVE', 'PAYMENT_IF_AUTHORIZED'] },
  { role: 'LEGAL_GUARDIAN', portal: 'PARENT', functionLabel: 'Tuteur Légal', permissions: ['CONSENT_SIGN', 'PAYMENT_MAKE', 'DOCUMENT_DOWNLOAD', 'FULL_VIEW_IF_AUTHORIZED'] },
  { role: 'FINANCIAL_RESPONSIBLE', portal: 'PARENT', functionLabel: 'Responsable Financier Élève', permissions: ['BALANCE_VIEW', 'PAYMENT_MAKE', 'RECEIPT_DOWNLOAD', 'PAYMENT_PLAN_VIEW', 'REMINDER_RECEIVE'] },
  { role: 'GUARDIAN', portal: 'PARENT', functionLabel: 'Tuteur', permissions: ['CHILD_VIEW', 'BULLETIN_VIEW', 'NOTIFICATION_RECEIVE'] },
  { role: 'STUDENT', portal: 'PARENT', functionLabel: 'Élève', levelScopes: ['MATERNELLE', 'PRIMARY', 'SECONDARY'], permissions: ['HOMEWORK_VIEW', 'AGENDA_VIEW', 'RESOURCE_VIEW', 'GRADE_VIEW_IF_AUTHORIZED', 'PROGRESSION_VIEW'] },
  { role: 'CLASS_DELEGATE', portal: 'PARENT', functionLabel: 'Élève Délégué', permissions: ['STUDENT_STANDARD', 'CLASS_INFO_SUBMIT_IF_AUTHORIZED', 'ADMIN_MESSAGE_LIMITED', 'ANNOUNCEMENT_VIEW'] },
  { role: 'ALUMNI', portal: 'PARENT', functionLabel: 'Ancien Élève / Alumni', permissions: ['DOCUMENT_ARCHIVE_VIEW', 'ATTESTATION_REQUEST', 'BULLETIN_ARCHIVE', 'ALUMNI_SPACE_IF_ENABLED', 'ADMIN_REQUEST'] },
];

// ─── PORTAIL 05 — PUBLIC (5 rôles) ─────────────────────────────────────────

const PUBLIC_ROLES: RolePortalEntry[] = [
  { role: 'VISITOR', portal: 'PUBLIC', functionLabel: 'Visiteur', permissions: ['PUBLIC_VIEW', 'CONTACT_REQUEST', 'PRE_ENROLLMENT_START'] },
  { role: 'PROSPECT_PARENT', portal: 'PUBLIC', functionLabel: 'Parent Prospect', permissions: ['INFO_REQUEST', 'CHILD_PRE_ENROLL', 'DOCUMENT_UPLOAD', 'APPLICATION_TRACK', 'ADMISSION_MESSAGE_RECEIVE'] },
  { role: 'APPLICANT', portal: 'PUBLIC', functionLabel: 'Candidat Élève', levelScopes: ['MATERNELLE', 'PRIMARY', 'SECONDARY'], permissions: ['PRE_ENROLLMENT', 'DOCUMENT_SUBMIT', 'APPLICATION_STATUS', 'ENROLLMENT_FINALIZE'] },
  { role: 'SPONSOR', portal: 'PUBLIC', functionLabel: 'Sponsor / Donateur', permissions: ['PUBLIC_VIEW', 'CONTACT_REQUEST'] },
  { role: 'AMBASSADOR', portal: 'PUBLIC', functionLabel: 'Ambassadeur', permissions: ['PUBLIC_VIEW', 'CONTACT_REQUEST', 'REFERRAL_MANAGE'] },
];

// ─── Rôles Legacy (compatibilité arrière) ──────────────────────────────────

const LEGACY_ROLE_MAP: Record<string, PortalType> = {
  'admin': 'SCHOOL',
  'director': 'SCHOOL',
  'teacher': 'TEACHER',
  'secretary': 'SCHOOL',
  'accountant': 'SCHOOL',
  'SUPER_ADMIN': 'PLATFORM',
  'SUPER_DIRECTOR': 'SCHOOL',
};

// ─── Lookup Maps ────────────────────────────────────────────────────────────

/** Tous les rôles avec leur portail */
const ALL_ROLES: RolePortalEntry[] = [
  ...PLATFORM_ROLES,
  ...SCHOOL_ROLES,
  ...TEACHER_ROLES,
  ...PARENT_ROLES,
  ...PUBLIC_ROLES,
];

/** Map rôle → portail (O(1) lookup) */
const ROLE_TO_PORTAL: Map<string, PortalType> = new Map(
  ALL_ROLES.map((entry) => [entry.role, entry.portal])
);

/** Map rôle → RolePortalEntry complet */
const ROLE_TO_ENTRY: Map<string, RolePortalEntry> = new Map(
  ALL_ROLES.map((entry) => [entry.role, entry])
);

/** Rôles par portail */
const ROLES_BY_PORTAL: Record<PortalType, string[]> = {
  PLATFORM: PLATFORM_ROLES.map((r) => r.role),
  SCHOOL: SCHOOL_ROLES.map((r) => r.role),
  TEACHER: TEACHER_ROLES.map((r) => r.role),
  PARENT: PARENT_ROLES.map((r) => r.role),
  PUBLIC: PUBLIC_ROLES.map((r) => r.role),
};

// ─── Fonctions Utilitaires ──────────────────────────────────────────────────

/**
 * Retourne le portail autorisé pour un rôle donné.
 * Conforme au document academia-helm-portails.md.
 * Les rôles legacy sont mappés vers le portail SCHOOL par défaut.
 */
export function getPortalForRole(role: string): PortalType {
  // Lookup dans le mapping canonique
  const portal = ROLE_TO_PORTAL.get(role);
  if (portal) return portal;

  // Lookup dans les rôles legacy
  const legacyPortal = LEGACY_ROLE_MAP[role];
  if (legacyPortal) return legacyPortal;

  // Rôle non reconnu → SCHOOL par défaut (compatibilité)
  return 'SCHOOL';
}

/**
 * Vérifie si un rôle peut se connecter via un portail donné.
 */
export function canRoleUsePortal(role: string, portal: PortalType): boolean {
  return getPortalForRole(role) === portal;
}

/**
 * Retourne l'entrée complète d'un rôle (permissions, accreditations, etc.)
 */
export function getRoleEntry(role: string): RolePortalEntry | undefined {
  return ROLE_TO_ENTRY.get(role);
}

/**
 * Retourne la liste des rôles pour un portail donné.
 */
export function getRolesForPortal(portal: PortalType): string[] {
  return ROLES_BY_PORTAL[portal] || [];
}

/**
 * Retourne les portails disponibles selon le contexte d'accès.
 *
 * - Domaine principal (academiahelm.com) : tous les portails
 * - Sous-domaine école (school.academiahelm.com) : SCHOOL, TEACHER, PARENT, PUBLIC
 *   (pas PLATFORM — réservé au domaine principal)
 */
export function getAvailablePortals(context: 'main-domain' | 'school-subdomain'): PortalType[] {
  if (context === 'school-subdomain') {
    return ['SCHOOL', 'TEACHER', 'PARENT', 'PUBLIC'];
  }
  return ['PLATFORM', 'SCHOOL', 'TEACHER', 'PARENT', 'PUBLIC'];
}

/**
 * Détermine le contexte d'accès à partir du hostname.
 * Retourne 'school-subdomain' si un sous-domaine de tenant est détecté,
 * sinon 'main-domain'.
 */
export function detectAccessContext(): 'main-domain' | 'school-subdomain' {
  if (typeof window === 'undefined') return 'main-domain';

  const host = window.location.host;
  const parts = host.split('.');

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    if (parts.length >= 2 && !RESERVED_SUBDOMAINS.includes(parts[0] as any) && parts[0] !== 'localhost') {
      return 'school-subdomain';
    }
    return 'main-domain';
  }

  if (parts.length >= 3 && !RESERVED_SUBDOMAINS.includes(parts[0] as any)) {
    return 'school-subdomain';
  }

  return 'main-domain';
}

/**
 * Vérifie si un utilisateur a une accréditation donnée.
 */
export function hasAccreditation(role: string, accreditation: AccreditationLevel): boolean {
  const entry = ROLE_TO_ENTRY.get(role);
  if (!entry) return false;
  if (!entry.accreditations) return false;
  return entry.accreditations.includes(accreditation) || entry.accreditations.includes('ALL_LEVELS');
}

/**
 * Retourne les permissions d'un rôle.
 */
export function getPermissionsForRole(role: string): string[] {
  const entry = ROLE_TO_ENTRY.get(role);
  return entry?.permissions || [];
}

/**
 * Vérifie si un rôle a une permission donnée.
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes('ALL') || permissions.includes(permission);
}

/**
 * Retourne le libellé français affichable d'un rôle technique.
 *
 * Utilisé partout dans le frontend pour afficher le rôle d'un utilisateur
 * (tableaux de bord, listes d'utilisateurs, devices, etc.) sans jamais
 * exposer la valeur technique brute en anglais (PROMOTER, PLATFORM_OWNER, ...).
 *
 * 1. Cherche d'abord dans ROLE_TO_ENTRY (mapping canonique).
 * 2. Cherche ensuite dans le dictionnaire des rôles legacy / variations.
 * 3. Fallback : retourne le rôle tel quel.
 *
 * Exemples :
 *   getRoleDisplayLabel('PROMOTER')        → 'Promoteur / Fondateur'
 *   getRoleDisplayLabel('PLATFORM_OWNER')  → 'Propriétaire de la Plateforme'
 *   getRoleDisplayLabel('director')        → 'Directeur'
 *   getRoleDisplayLabel('SUPER_DIRECTOR')  → 'Super Directeur'
 */
const ROLE_LABEL_FALLBACK: Record<string, string> = {
  // Rôles legacy / variations courantes
  'admin': 'Administrateur',
  'director': 'Directeur',
  'teacher': 'Enseignant',
  'secretary': 'Secrétaire',
  'accountant': 'Comptable',
  'parent': 'Parent',
  'student': 'Élève',
  'SUPER_ADMIN': 'Super Administrateur',
  'SUPER_DIRECTOR': 'Super Directeur',
  'DIRECTEUR': 'Directeur',
  'DIRECTEUR_GENERAL': 'Directeur Général',
  'DIRECTEUR_ETABLISSEMENT': "Directeur d'Établissement",
  'ENSEIGNANT': 'Enseignant',
  'PROMOTEUR': 'Promoteur / Fondateur',
  'SECRETAIRE': 'Secrétaire',
  'SECRETAIRE_COMPTABLE': 'Secrétaire-Comptable',
  'COMPTABLE': 'Comptable',
  'CENSEUR': 'Censeur',
  'SURVEILLANT': 'Surveillant',
  'ECONOME': 'Économe',
  'CAISSIER': 'Caissier',
  'SCOLARITE': 'Scolarité',
  'PATRONAT_ADMIN': 'Administrateur Patronat',
  'PATRONAT_USER': 'Utilisateur Patronat',
};

export function getRoleDisplayLabel(role: string | undefined | null): string {
  if (!role) return '';
  // 1. Mapping canonique (PROMOTER, SCHOOL_OWNER, PLATFORM_OWNER, etc.)
  const entry = ROLE_TO_ENTRY.get(role);
  if (entry?.functionLabel) return entry.functionLabel;
  // 2. Fallback legacy / variations
  const fallback = ROLE_LABEL_FALLBACK[role];
  if (fallback) return fallback;
  // 3. Dernier recours : retourner le rôle tel quel
  return role;
}

/**
 * Retourne les modules de la sidebar visibles selon le rôle et le portail.
 * Utilisé par PilotageSidebar pour filtrer les éléments de navigation.
 */
export function getVisibleModulesForRole(role: string): {
  showPlatformModules: boolean;
  showDirectionModules: boolean;
  showFinanceModules: boolean;
  showPedagogyModules: boolean;
  showHrModules: boolean;
  showCommunicationModules: boolean;
  showStudentModules: boolean;
  showExamModules: boolean;
  showParentModules: boolean;
  showSettingsModules: boolean;
  showSupplementaryModules: boolean;
} {
  const portal = getPortalForRole(role);
  const entry = ROLE_TO_ENTRY.get(role);
  const hasAll = entry?.permissions?.includes('ALL') || entry?.permissions?.includes('ALL_VIEW') || entry?.permissions?.includes('ALL_MANAGE');

  // Plateforme : accès à tous les modules plateforme
  if (portal === 'PLATFORM') {
    return {
      showPlatformModules: true,
      showDirectionModules: true,
      showFinanceModules: true,
      showPedagogyModules: true,
      showHrModules: true,
      showCommunicationModules: true,
      showStudentModules: true,
      showExamModules: true,
      showParentModules: false,
      showSettingsModules: true,
      showSupplementaryModules: true,
    };
  }

  // Enseignant : accès limité aux modules pédagogiques
  if (portal === 'TEACHER') {
    return {
      showPlatformModules: false,
      showDirectionModules: false,
      showFinanceModules: false,
      showPedagogyModules: true,
      showHrModules: false,
      showCommunicationModules: true,
      showStudentModules: true,
      showExamModules: true,
      showParentModules: false,
      showSettingsModules: false,
      showSupplementaryModules: false,
    };
  }

  // Parent / Élève : accès très limité
  if (portal === 'PARENT') {
    return {
      showPlatformModules: false,
      showDirectionModules: false,
      showFinanceModules: role === 'FINANCIAL_RESPONSIBLE' || role === 'PARENT' || role === 'PARENT_PRIMARY' || role === 'LEGAL_GUARDIAN',
      showPedagogyModules: false,
      showHrModules: false,
      showCommunicationModules: true,
      showStudentModules: true,
      showExamModules: role === 'STUDENT' || role === 'CLASS_DELEGATE',
      showParentModules: true,
      showSettingsModules: false,
      showSupplementaryModules: false,
    };
  }

  // Public : aucun module (pas d'authentification)
  if (portal === 'PUBLIC') {
    return {
      showPlatformModules: false,
      showDirectionModules: false,
      showFinanceModules: false,
      showPedagogyModules: false,
      showHrModules: false,
      showCommunicationModules: false,
      showStudentModules: false,
      showExamModules: false,
      showParentModules: false,
      showSettingsModules: false,
      showSupplementaryModules: false,
    };
  }

  // École : accès selon le rôle et les accréditations
  return {
    showPlatformModules: false,
    showDirectionModules: hasAll || ['PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR'].includes(role),
    showFinanceModules: hasAll || ['PROMOTER', 'CFO', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CASHIER', 'RECOVERY_MANAGER'].includes(role),
    showPedagogyModules: hasAll || ['PROMOTER', 'PEDAGOGIC_DIRECTOR', 'CENSOR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE', 'PEDAGOGIC_COORDINATOR'].includes(role),
    showHrModules: hasAll || ['PROMOTER', 'HR_MANAGER', 'PAYROLL_MANAGER'].includes(role),
    showCommunicationModules: hasAll || ['PROMOTER', 'COMMUNICATION_MANAGER', 'COMMUNICATION_AGENT', 'SCHOOL_LIFE_MANAGER'].includes(role),
    showStudentModules: hasAll || true, // La plupart des rôles école ont accès aux élèves
    showExamModules: hasAll || ['PROMOTER', 'CENSOR', 'EXAM_MANAGER', 'RESP_SECONDAIRE', 'PEDAGOGIC_COORDINATOR'].includes(role),
    showParentModules: false,
    showSettingsModules: hasAll || ['PROMOTER', 'IT_MANAGER', 'SETTINGS_MANAGER'].includes(role),
    showSupplementaryModules: !!hasAll,
  };
}

// ─── Exports nominaux pour utilisation directe ──────────────────────────────

export {
  PLATFORM_ROLES,
  SCHOOL_ROLES,
  TEACHER_ROLES,
  PARENT_ROLES,
  PUBLIC_ROLES,
  ALL_ROLES,
  ROLES_BY_PORTAL,
  LEGACY_ROLE_MAP,
};
