/**
 * Types globaux pour Academia Hub Next.js App
 */

/**
 * États d'abonnement normalisés pour un établissement
 */
export type SubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE_TRIAL'
  | 'ACTIVE_SUBSCRIBED'
  | 'SUSPENDED'
  | 'TERMINATED';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  subdomain: string;
  /**
   * Statut général (legacy + nouveaux états)
   * - active / trial / suspended / cancelled (backend existant)
   * - PENDING / ACTIVE_TRIAL / ACTIVE_SUBSCRIBED / SUSPENDED / TERMINATED (nouveau modèle)
   */
  status: 'active' | 'suspended' | 'trial' | 'cancelled' | SubscriptionStatus;
  /**
   * Statut d'abonnement normalisé côté application
   */
  subscriptionStatus: SubscriptionStatus;
  /**
   * Fin de la période d'essai (ISO string)
   */
  trialEndsAt?: string;
  /**
   * Prochaine échéance de paiement (ISO string)
   */
  nextPaymentDueAt?: string;
  /**
   * Dernier paiement réussi (ISO string)
   */
  lastPaymentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Rôles utilisateur
 */
export type UserRole = 
  | 'admin' 
  | 'director' 
  | 'teacher' 
  | 'secretary' 
  | 'accountant'
  // Portail Plateforme
  | 'PLATFORM_OWNER'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'PLATFORM_BILLING'
  | 'PLATFORM_SUPPORT'
  | 'PLATFORM_DEVOPS'
  | 'PLATFORM_AUDITOR'
  // Portail École
  | 'SCHOOL_OWNER'
  | 'SCHOOL_ADMIN'
  | 'RESP_SECONDAIRE'
  | 'RESP_PRIMAIRE'
  | 'RESP_MATERNELLE'
  | 'SCOLARITE'
  | 'CAISSIER'
  | 'COMPTABLE'
  | 'ECONOME'
  | 'DIRECTEUR_GENERAL'
  | 'DIRECTEUR_ETABLISSEMENT'
  | 'CENSEUR'
  | 'SURVEILLANT_GENERAL'
  // Portail Enseignant
  | 'TEACHER'
  | 'TEACHER_RESP'
  // Portail Parent / Élève
  | 'PARENT'
  | 'STUDENT'
  // Rôles Spéciaux
  | 'SUPER_DIRECTOR'
  | 'SUPER_ADMIN';

export type PortalType = 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC';

/**
 * Groupe Scolaire (regroupe plusieurs établissements/tenants)
 */
export interface SchoolGroup {
  id: string;
  name: string;
  ownerId: string; // ID du promoteur (SUPER_DIRECTOR)
  tenantIds: string[]; // Liste des IDs des tenants (établissements) du groupe
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  portal: PortalType;
  function?: string; // Fonction métier spécifique (ex: "Censeur", "Comptable")
  accreditations?: ('MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE')[];
  levelScopes?: string[]; // IDs des niveaux autorisés
  classScopes?: string[]; // IDs des classes autorisées
  tenantId: string;
  permissions: string[];
  accessibleTenants?: Tenant[];
  schoolGroupId?: string;
  staffId?: string;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  tenant: Tenant;
  token: string;
  expiresAt: string;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * Facturation & paiements
 */

export type InvoiceStatus = 'ISSUED' | 'PAID' | 'CANCELLED'; // Pas de brouillon côté SaaS, uniquement des factures émises

export interface Invoice {
  id: string;
  tenantId: string;
  number: string; // Numérotation unique, générée côté backend
  amount: number;
  currency: string; // ex: 'XOF'
  description: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
  createdAt: string;
}

export type PaymentMethod = 'FEDAPAY' | 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY';

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider: 'FEDAPAY';
  providerReference: string; // ID paiement Fedapay
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  paidAt?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  tenantId: string;
  invoiceId: string;
  paymentId: string;
  number: string; // Numérotation unique, immuable
  issuedAt: string;
  pdfUrl: string; // URL sécurisée signée, générée par le backend
  // Métadonnées minimales pour l'affichage institutionnel
  schoolName?: string;
  schoolAddress?: string;
}

/**
 * KPI Direction & Bilans
 *
 * Ces types décrivent les agrégations renvoyées par le backend
 * pour le module Bilans & Indicateurs, en lecture seule.
 */

export interface DirectionKpiSummary {
  totalStudents: number;
  totalTeachers: number;
  periodLabel: string; // ex: "Année 2024-2025" ou "Mois en cours"
  // Recettes globales sur la période
  totalRevenue: number;
  currency: string; // ex: 'XOF'
  // Taux de recouvrement (0-100)
  recoveryRate: number;
  // Présence enseignants (0-100)
  teacherPresenceRate: number;
  // Indicateur synthétique d'activité examens (0-100)
  examsActivityIndex: number;
}

export interface RevenueByPeriodPoint {
  period: string; // ex: "Jan", "Fév 2025", "T1 2025"
  amount: number;
}

export interface ModuleKpi {
  module: 'SCOLARITY' | 'FINANCE' | 'HR' | 'EXAMS';
  label: string;
  indicators: {
    name: string;
    value: number;
    unit?: string; // ex: '%', 'élèves', 'F CFA'
  }[];
}

export interface DirectionKpiResponse {
  summary: DirectionKpiSummary;
  revenueByPeriod: RevenueByPeriodPoint[];
  moduleKpis: ModuleKpi[];
}

/**
 * KPI Spécifiques pour ORION
 */
export interface KpiFinancialMonthly {
  period: string;
  variationPercent: number;
  revenueExpected?: number;
  revenueCollected?: number;
  collectionRate?: number;
}

export interface KpiHrMonthly {
  period: string;
  absenceRate: number;
  teachersAbsent?: number;
  teachersTotal?: number;
}

export interface KpiPedagogyTerm {
  term: string;
  averageScore: number;
  passRate: number;
  attendanceRate: number;
}

export interface KpiSystemHealth {
  period: string;
  dataCompleteness: number;
  syncStatus: 'UP_TO_DATE' | 'DELAYED' | 'FAILED';
}

/**
 * Bilans consolidés multi-écoles (lecture seule, agrégation explicite)
 * Uniquement pour les SUPER_DIRECTOR
 */
export interface ConsolidatedKpiResponse {
  /**
   * Nombre total d'établissements dans le groupe
   */
  totalSchools: number;
  /**
   * Agrégations consolidées (somme des valeurs de tous les tenants du groupe)
   */
  consolidated: {
    totalStudents: number;
    totalTeachers: number;
    totalRevenue: number;
    currency: string;
    averageRecoveryRate: number; // Moyenne pondérée
    averageTeacherPresenceRate: number; // Moyenne pondérée
  };
  /**
   * KPI par établissement (données isolées, pas de mélange)
   */
  bySchool: Array<{
    tenantId: string;
    schoolName: string;
    subdomain: string;
    kpi: DirectionKpiSummary;
  }>;
  /**
   * Période de référence
   */
  periodLabel: string;
}

/**
 * Synchronisation Offline-First
 * 
 * Types pour le moteur de synchronisation entre Desktop (SQLite) et Web SaaS (PostgreSQL)
 * Utilise le Outbox Pattern pour garantir la cohérence
 */

/**
 * Type d'opération de synchronisation
 */
export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Entité synchronisable
 */
export type SyncEntityType = 
  // ─── Élèves & Scolarité ───
  | 'STUDENT'
  | 'GUARDIAN'
  | 'STUDENT_GUARDIAN'
  // ─── Personnel, RH & Paie ───
  | 'TEACHER'
  | 'STAFF'
  | 'CONTRACT'
  | 'CONTRACT_AMENDMENT'
  | 'LEAVE_REQUEST'
  | 'STAFF_ALLOWANCE'
  | 'STAFF_SCHEDULE'
  | 'STAFF_ATTENDANCE'
  | 'STAFF_EVALUATION'
  | 'STAFF_DOCUMENT'
  | 'STAFF_ASSIGNMENT'
  | 'OVERTIME_RECORD'
  | 'SALARY_PAYMENT'
  | 'SALARY_SLIP'
  | 'PAYROLL'
  | 'PAYROLL_ITEM'
  | 'PAYROLL_PERIOD'
  // ─── Classes & Structure ───
  | 'CLASS'
  | 'CLASS_STUDENT'
  | 'CLASS_SUBJECT'
  | 'SUBJECT'
  | 'SCHOOL_LEVEL'
  | 'ACADEMIC_YEAR'
  | 'ACADEMIC_PERIOD'
  // ─── Examens, Notes & Bulletins ───
  | 'EXAM'
  | 'GRADE'
  | 'EXAM_CANDIDATE'
  | 'EXAM_RESULT'
  | 'EXAM_SCORE'
  | 'EXAM_SESSION'
  | 'EXAM_PV'
  | 'EXAM_COMPOSITION'
  | 'EXAM_DELIBERATION'
  | 'REPORT_CARD'
  | 'REPORT_CARD_ITEM'
  | 'EVALUATION'
  | 'GRADE_CALCULATION'
  | 'STUDENT_PERIOD_AVERAGE'
  | 'STUDENT_SUBJECT_AVERAGE'
  // ─── Finances & Économat ───
  | 'PAYMENT'
  | 'INVOICE'
  | 'FEE_STRUCTURE'
  | 'FEE_CONFIGURATION'
  | 'FEE_DEFINITION'
  | 'FEE_REGIME'
  | 'EXPENSE'
  | 'FINANCE_SETTING'
  | 'FINANCE_TRANSACTION'
  | 'FINANCE_BUDGET'
  | 'TREASURY_MOVEMENT'
  | 'TUITION_INSTALLMENT'
  | 'TUITION_PAYMENT'
  | 'PAYMENT_PLAN'
  | 'PAYMENT_FLOW'
  // ─── Organisation Pédagogique ───
  | 'ATTENDANCE'
  | 'ABSENCE'
  | 'HOMEWORK'
  | 'HOMEWORK_ENTRY'
  | 'HOMEWORK_SUBMISSION'
  | 'PEDAGOGICAL_FILE'
  | 'CLASS_DIARY'
  | 'LESSON_PLAN'
  | 'LESSON_JOURNAL'
  | 'LESSON_JOURNAL_ENTRY'
  | 'WEEKLY_SEMAINIER'
  | 'TEACHER_CLASS_ASSIGNMENT'
  | 'ACADEMIC_SERIES'
  | 'SERIES_SUBJECT'
  | 'TEACHER_PROFILE'
  | 'PEDAGOGICAL_MATERIAL'
  | 'MATERIAL_STOCK'
  | 'MATERIAL_MOVEMENT'
  | 'TEACHER_MATERIAL_ASSIGNMENT'
  | 'TEACHING_ASSIGNMENT'
  | 'SUBJECT_PROGRAM'
  | 'TIMETABLE'
  | 'TIMETABLE_ENTRY'
  | 'ACADEMIC_CLASS'
  | 'ACADEMIC_CYCLE'
  | 'ACADEMIC_LEVEL'
  // ─── Discipline & Incidents ───
  | 'DISCIPLINARY_INCIDENT'
  | 'INCIDENT'
  // ─── Réunions ───
  | 'MEETING'
  | 'MEETING_PARTICIPANT'
  | 'MEETING_AGENDA_ITEM'
  | 'MEETING_MINUTE'
  // ─── Communication ───
  | 'MESSAGE'
  | 'MESSAGE_RECIPIENT'
  | 'MESSAGE_TEMPLATE'
  | 'ANNOUNCEMENT'
  | 'SMS_LOG'
  | 'EMAIL_LOG'
  | 'PUSH_NOTIFICATION'
  | 'COMMUNICATION_CHANNEL'
  | 'NOTIFICATION'
  | 'ALERT'
  // ─── Agrégation & Décision ───
  | 'AGGREGATION_RESULT'
  | 'AGGREGATION_SESSION'
  | 'AGGREGATION_DECISION'
  | 'RANKING'
  | 'HONOR_ROLL'
  // ─── ORION (Pilotage Direction) ───
  | 'ORION_ALERT'
  | 'ORION_INSIGHT'
  | 'ORION_FORECAST'
  | 'ORION_SETTINGS'
  // ─── Paramètres / Settings ───
  | 'SCHOOL_ACADEMIC_SETTING'
  | 'SCHOOL_SETTINGS'
  | 'TENANT_IDENTITY_PROFILE'
  | 'SETTINGS_PEDAGOGICAL_STRUCTURE'
  | 'SETTINGS_BILINGUAL'
  | 'TENANT_FEATURE'
  | 'SECURITY_SETTINGS'
  | 'OFFLINE_SYNC_SETTINGS'
  | 'SETTINGS_COMMUNICATION'
  | 'TENANT_STAMP'
  | 'TENANT_SIGNATURE'
  | 'ROLE'
  | 'PERMISSION'
  | 'SETTINGS_HISTORY'
  // ─── Cantine ───
  | 'CANTEEN_SETTINGS'
  | 'CANTEEN_MENU'
  | 'CANTEEN_MEAL_SERVICE'
  | 'CANTEEN_ATTENDANCE'
  | 'CANTEEN_SUBSCRIPTION'
  | 'CANTEEN_PAYMENT'
  // ─── Transport ───
  | 'VEHICLE'
  | 'ROUTE'
  | 'TRANSPORT_DRIVER'
  | 'TRANSPORT_TRIP'
  | 'TRANSPORT_ASSIGNMENT'
  | 'TRANSPORT_SETTINGS'
  // ─── Infirmerie ───
  | 'INFIRMARY_VISIT'
  | 'INFIRMARY_MEDICAL_RECORD'
  | 'INFIRMARY_MEDICATION_STOCK'
  | 'INFIRMARY_SETTINGS'
  // ─── QHSE ───
  | 'QHSE_AUDIT'
  | 'QHSE_INCIDENT'
  | 'QHSE_RISK'
  | 'QHSE_ACTION_PLAN'
  | 'QHSE_SETTING'
  // ─── EduCast ───
  | 'EDUCAST_CONTENT'
  | 'EDUCAST_CHANNEL'
  | 'EDUCAST_PLAYLIST'
  | 'EDUCAST_SETTINGS'
  // ─── Boutique / Shop ───
  | 'SHOP_PRODUCT'
  | 'SHOP_CATEGORY'
  | 'SHOP_ORDER'
  | 'SHOP_SALE'
  | 'SHOP_SETTINGS'
  // ─── Bibliothèque ───
  | 'LIBRARY_BOOK'
  | 'LIBRARY_LOAN'
  | 'LIBRARY_RESERVATION'
  | 'LIBRARY_SETTINGS'
  // ─── Divers / Legacy ───
  | 'SESSION'
  | 'LOAN'
  | 'REPORT'
  | 'MODULE';

/**
 * État d'un événement dans l'Outbox
 */
export type OutboxEventStatus = 
  | 'PENDING'      // En attente d'envoi
  | 'SENT'         // Envoyé au serveur
  | 'ACKNOWLEDGED' // Confirmé par le serveur
  | 'FAILED'       // Échec d'envoi
  | 'CONFLICT';    // Conflit détecté

/**
 * Événement Outbox (Desktop → Server)
 * 
 * Pattern Outbox : chaque modification locale est enregistrée
 * dans une table outbox avant d'être synchronisée
 */
export interface OutboxEvent {
  id: string; // UUID généré côté Desktop
  tenantId: string;
  entityType: SyncEntityType;
  entityId: string; // ID de l'entité modifiée
  operation: SyncOperationType;
  /**
   * Données de l'entité (JSON)
   * Pour CREATE/UPDATE : données complètes
   * Pour DELETE : seulement l'ID
   */
  payload: Record<string, any>;
  /**
   * Version locale (timestamp ou version number)
   * Utilisé pour la détection de conflits
   */
  localVersion: number;
  /**
   * Timestamp de création côté Desktop
   */
  createdAt: string;
  /**
   * Timestamp de dernière tentative d'envoi
   */
  lastAttemptAt?: string;
  /**
   * Nombre de tentatives d'envoi
   */
  attemptCount: number;
  status: OutboxEventStatus;
  /**
   * Message d'erreur si échec
   */
  errorMessage?: string;
}

/**
 * Requête de synchronisation montante (Desktop → Server)
 */
export interface SyncUpRequest {
  /**
   * ID du client Desktop (identifiant unique de l'installation)
   */
  clientId: string;
  /**
   * Liste des événements à synchroniser
   */
  events: OutboxEvent[];
  /**
   * Timestamp de la dernière synchronisation réussie
   * Permet au serveur de savoir quels changements envoyer en retour
   */
  lastSyncTimestamp?: string;
}

/**
 * Réponse de synchronisation montante
 */
export interface SyncUpResponse {
  /**
   * Événements acceptés (avec leur ID serveur)
   */
  acknowledged: Array<{
    outboxEventId: string; // ID original côté Desktop
    serverEventId: string; // ID généré côté serveur
    entityId: string;      // ID final de l'entité (peut différer si création)
    serverVersion: number; // Version serveur
  }>;
  /**
   * Événements en conflit
   */
  conflicts: Array<{
    outboxEventId: string;
    reason: string;
    serverData?: Record<string, any>; // Données serveur pour résolution
  }>;
  /**
   * Événements rejetés (erreur de validation)
   */
  rejected: Array<{
    outboxEventId: string;
    reason: string;
  }>;
  /**
   * Timestamp de synchronisation (pour la prochaine sync)
   */
  syncTimestamp: string;
}

/**
 * Requête de synchronisation descendante (Server → Desktop)
 */
export interface SyncDownRequest {
  /**
   * ID du client Desktop
   */
  clientId: string;
  /**
   * Timestamp de la dernière synchronisation réussie
   * Le serveur renvoie tous les changements depuis ce timestamp
   */
  lastSyncTimestamp: string;
  /**
   * Liste des entités à synchroniser (optionnel, si vide = toutes)
   */
  entityTypes?: SyncEntityType[];
}

/**
 * Changement serveur à appliquer côté Desktop
 */
export interface ServerChange {
  id: string; // ID serveur de l'événement
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  /**
   * Données de l'entité (JSON)
   */
  payload: Record<string, any>;
  /**
   * Version serveur
   */
  serverVersion: number;
  /**
   * Timestamp de modification côté serveur
   */
  modifiedAt: string;
}

/**
 * Réponse de synchronisation descendante
 */
export interface SyncDownResponse {
  /**
   * Changements à appliquer côté Desktop
   */
  changes: ServerChange[];
  /**
   * Timestamp de synchronisation
   */
  syncTimestamp: string;
  /**
   * Indique s'il y a plus de changements (pagination)
   */
  hasMore: boolean;
}

/**
 * Journal de synchronisation (audit trail)
 */
export interface SyncLog {
  id: string;
  tenantId: string;
  clientId: string;
  direction: 'UP' | 'DOWN';
  /**
   * Nombre d'événements synchronisés
   */
  eventsCount: number;
  /**
   * Nombre de conflits détectés
   */
  conflictsCount: number;
  /**
   * Statut global de la synchronisation
   */
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  /**
   * Timestamp de début
   */
  startedAt: string;
  /**
   * Timestamp de fin
   */
  completedAt?: string;
  /**
   * Durée en millisecondes
   */
  duration?: number;
  /**
   * Message d'erreur si échec
   */
  errorMessage?: string;
}

/**
 * Résumé de synchronisation (pour affichage dans l'UI)
 */
export interface SyncSummary {
  /**
   * Nombre d'événements en attente de synchronisation
   */
  pendingEvents: number;
  /**
   * Dernière synchronisation réussie
   */
  lastSyncAt?: string;
  /**
   * Nombre de conflits non résolus
   */
  unresolvedConflicts: number;
  /**
   * Statut de connectivité
   */
  isOnline: boolean;
  /**
   * Progression de la synchronisation en cours (0-100)
   */
  syncProgress?: number;
}

/**
 * Témoignages Clients
 * 
 * Système de témoignages avec validation manuelle obligatoire
 * Contrôle éditorial strict pour maintenir la crédibilité
 */

/**
 * Statut d'un témoignage
 */
export type TestimonialStatus = 
  | 'PENDING'    // Soumis, en attente de validation
  | 'APPROVED'   // Validé et publié
  | 'REJECTED'   // Rejeté (non publié)
  | 'ARCHIVED';  // Archivé (anciennement publié)

/**
 * Témoignage client
 */
export interface Testimonial {
  id: string;
  tenantId: string; // École qui a soumis le témoignage
  /**
   * Informations du témoin
   */
  authorName: string;
  authorFunction: string; // Ex: "Directeur", "Promoteur", "Secrétaire Général"
  authorPhotoUrl?: string; // URL de la photo (optionnel)
  schoolName: string; // Nom de l'établissement
  schoolCity?: string; // Ville de l'établissement
  
  /**
   * Contenu du témoignage
   */
  content: string; // Texte du témoignage
  rating: number; // Note de 1 à 5
  
  /**
   * Validation et publication
   */
  status: TestimonialStatus;
  submittedAt: string; // Date de soumission
  reviewedAt?: string; // Date de validation/rejet
  reviewedBy?: string; // ID de l'admin qui a validé/rejeté
  rejectionReason?: string; // Raison du rejet si applicable
  
  /**
   * Métadonnées
   */
  featured: boolean; // Témoignage mis en avant
  displayOrder: number; // Ordre d'affichage
  createdAt: string;
  updatedAt: string;
}

/**
 * Requête de soumission d'un témoignage
 */
export interface TestimonialSubmission {
  authorName: string;
  authorFunction: string;
  authorPhotoUrl?: string;
  schoolName: string;
  schoolCity?: string;
  content: string;
  rating: number;
}

/**
 * Réponse après soumission
 */
export interface TestimonialSubmissionResponse {
  success: boolean;
  testimonialId: string;
  message: string;
}

/**
 * Panel Super Admin
 * 
 * Système de gestion globale pour le fondateur (YEHI OR Tech)
 * Accès ultra sécurisé avec journalisation complète
 */

/**
 * Vue globale d'un tenant pour le Super Admin
 */
export interface AdminTenantView {
  id: string;
  name: string;
  subdomain: string;
  slug: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string;
  nextPaymentDueAt?: string;
  lastPaymentAt?: string;
  createdAt: string;
  updatedAt: string;
  // Statistiques
  studentCount: number;
  teacherCount: number;
  monthlyRevenue: number;
  lastActivityAt?: string;
  // Groupe scolaire (si applicable)
  groupId?: string;
  groupName?: string;
}

/**
 * Statistiques globales pour le Super Admin
 */
export interface GlobalStats {
  totalTenants: number;
  activeSubscriptions: number;
  trialTenants: number;
  suspendedTenants: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalStudents: number;
  totalTeachers: number;
  // Répartition par statut
  tenantsByStatus: Record<SubscriptionStatus, number>;
  // Activité
  newTenantsLast30Days: number;
  churnedTenantsLast30Days: number;
}

/**
 * Action d'audit (journalisation)
 */
export type AdminActionType = 
  | 'TENANT_SUSPEND'
  | 'TENANT_ACTIVATE'
  | 'TENANT_TERMINATE'
  | 'SUBSCRIPTION_MODIFY'
  | 'TESTIMONIAL_APPROVE'
  | 'TESTIMONIAL_REJECT'
  | 'CONTENT_UPDATE'
  | 'USER_ACCESS_REVOKE'
  | 'SETTINGS_UPDATE';

/**
 * Journal d'audit (audit trail)
 */
export interface AdminAuditLog {
  id: string;
  adminId: string; // ID du Super Admin
  adminEmail: string; // Email du Super Admin (pour traçabilité)
  action: AdminActionType;
  targetType: 'TENANT' | 'TESTIMONIAL' | 'CONTENT' | 'USER' | 'SETTINGS';
  targetId: string; // ID de l'entité concernée
  description: string; // Description de l'action
  metadata?: Record<string, any>; // Données supplémentaires (JSON)
  ipAddress?: string; // Adresse IP de l'admin
  userAgent?: string; // User agent du navigateur
  createdAt: string;
}

/**
 * Requête de suspension/activation d'un tenant
 */
export interface TenantActionRequest {
  tenantId: string;
  reason: string; // Raison obligatoire pour traçabilité
  notifyTenant?: boolean; // Notifier l'établissement par email
}

/**
 * Requête de modification d'abonnement
 */
export interface SubscriptionModificationRequest {
  tenantId: string;
  newStatus: SubscriptionStatus;
  reason: string;
  effectiveDate?: string; // Date d'effet (optionnel, défaut: immédiat)
  notifyTenant?: boolean;
}

/**
 * Vue consolidée pour le dashboard Super Admin
 */
export interface AdminDashboardData {
  stats: GlobalStats;
  recentTenants: AdminTenantView[];
  recentActivity: AdminAuditLog[];
  pendingTestimonials: number;
  systemHealth: {
    apiStatus: 'healthy' | 'degraded' | 'down';
    databaseStatus: 'healthy' | 'degraded' | 'down';
    lastCheckAt: string;
  };
}

/**
 * ORION - Assistant de Direction Institutionnel
 * 
 * Architecture en 4 couches :
 * 1. Couche Données : Vues agrégées et KPI stabilisés uniquement
 * 2. Couche Logique : Règles explicites, aucune probabilité non contrôlée
 * 3. Couche Interprétation : Faits, interprétation, vigilance
 * 4. Couche Présentation : Ton institutionnel, concis, professionnel
 * 
 * CONTRAINTES ABSOLUES :
 * - 100% lecture seule
 * - Aucune modification de données
 * - Aucune exécution d'action
 * - Aucune supposition
 * - Uniquement données réelles et agrégées
 */

/**
 * Niveau d'alerte ORION (hiérarchisé)
 */
export type OrionAlertLevel = 
  | 'INFO'      // Information
  | 'ATTENTION' // Point d'attention
  | 'CRITIQUE'; // Situation critique

/**
 * Alerte ORION
 */
export interface OrionAlert {
  id: string;
  level: OrionAlertLevel;
  category: 'FINANCIAL' | 'ACADEMIC' | 'OPERATIONAL' | 'COMPLIANCE';
  title: string;
  /**
   * Faits observés (données réelles uniquement)
   */
  facts: string[];
  /**
   * Interprétation structurée
   */
  interpretation: string;
  /**
   * Point de vigilance
   */
  vigilance: string;
  /**
   * Données sources (références aux KPI)
   */
  dataSources: {
    kpi: string;
    value: number;
    period: string;
    comparison?: {
      previousValue: number;
      change: number;
      changePercent: number;
    };
  }[];
  createdAt: string;
  acknowledgedAt?: string;
}

/**
 * Résumé mensuel ORION
 */
export interface OrionMonthlySummary {
  id: string;
  tenantId: string;
  period: string; // Format: "YYYY-MM" (ex: "2025-01")
  /**
   * Faits observés (données réelles)
   */
  facts: {
    financial: {
      totalRevenue: number;
      recoveryRate: number;
      pendingPayments: number;
      pendingAmount: number;
    };
    academic: {
      totalStudents: number;
      totalClasses: number;
      averageAttendance: number;
      examsCompleted: number;
    };
    operational: {
      totalTeachers: number;
      teacherPresenceRate: number;
      activeModules: number;
    };
  };
  /**
   * Interprétation structurée
   */
  interpretation: {
    overview: string; // Vue d'ensemble factuelle
    trends: Array<{
      metric: string;
      direction: 'UP' | 'DOWN' | 'STABLE';
      magnitude: number; // Pourcentage de changement
      description: string; // Description factuelle
    }>;
    highlights: string[]; // Points clés (3-5 maximum)
  };
  /**
   * Points de vigilance
   */
  vigilance: OrionAlert[];
  /**
   * Données KPI sources
   */
  kpiData: DirectionKpiSummary;
  generatedAt: string;
}

/**
 * Requête ORION (question en langage naturel)
 */
export interface OrionQuery {
  id: string;
  tenantId: string;
  userId: string;
  query: string;
  /**
   * Contexte métier fourni à ORION
   */
  context: {
    period: string;
    focus?: string; // ex: "finance", "scolarité"
  };
  /**
   * Réponse structurée
   */
  response: {
    text: string;
    facts: string[];
    dataPoints?: Array<{ label: string; value: any; unit?: string }>;
    suggestedQueries?: string[];
  };
  createdAt: string;
}

/**
 * ORION - Règles et Moteur
 */
export type RuleOperator = '<' | '<=' | '>' | '>=' | '==' | '!=';

export interface OrionRule {
  id: string;
  enabled: boolean;
  category: 'FINANCE' | 'RH' | 'PEDAGOGY' | 'SYSTEM';
  severity: 'CRITICAL' | 'WARNING' | 'ALERT' | 'INFO';
  condition: {
    metric: string;
    operator: RuleOperator;
    value: number;
  };
  message: string;
  description?: string;
}

export interface OrionRulesVersion {
  version: string;
  rules: OrionRule[];
}

/**
 * ORION - Réponse et Historique
 */
export interface OrionResponse {
  answer: {
    facts: string[];
    interpretation: string;
    vigilance: string | null;
  };
  confidence: number;
  dataSufficient: boolean;
  dataSources: Array<{
    kpi: string;
    value: number;
    period: string;
    source: 'DirectionKpiSummary' | 'Custom';
  }>;
}

export interface OrionQueryRequest {
  query: string;
  context?: {
    period?: string;
    focus?: 'finance' | 'scolarité' | 'rh' | 'global';
  };
}

export interface OrionAnalysisHistory {
  id: string;
  tenantId: string;
  userId: string;
  type: 'QUERY' | 'MONTHLY_SUMMARY' | 'ALERT';
  content: {
    title: string;
    facts: string[];
    interpretation: string;
    vigilance?: string;
  };
  dataSources: Array<{
    kpi: string;
    value: number;
    period: string;
    source: 'DirectionKpiSummary' | 'Custom';
  }>;
  createdAt: string;
}

export interface OrionConfig {
  enabled: boolean;
  llmProvider: 'openai' | 'anthropic' | 'local';
  llmModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  lastUpdated: string;
}

/**
 * ATLAS - Intelligence de Soutien Pédagogique
 * 
 * Spécialisé dans :
 * - Analyse des plans de cours
 * - Recommandations pédagogiques
 * - Support aux enseignants
 */

export interface AtlasMessage {
  id: string;
  tenantId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  /**
   * Références pédagogiques (livres, chapitres, etc.)
   */
  references?: Array<{
    type: 'MATERIAL' | 'CURRICULUM' | 'EXTERNAL';
    title: string;
    url?: string;
  }>;
  createdAt: string;
}

/**
 * Structure Académique & Cycles
 */

export interface SchoolCycle {
  id: string;
  name: string;
  code: string;
  levelId: string;
  order: number;
}

export interface SchoolLevel {
  id: string;
  name: string;
  code: string;
  cycles: SchoolCycle[];
}

export interface AcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'UPCOMING';
}

/**
 * Matières & Programmes
 */

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  coefficient?: number;
  category?: 'GENERAL' | 'TECHNICAL' | 'LITERARY' | 'SCIENTIFIC';
}

export interface PedagogicalMaterial {
  id: string;
  name: string;
  code: string;
  category: 'BOOK' | 'KIT' | 'EQUIPMENT' | 'TECH' | 'OTHER';
  description?: string;
  isActive: boolean;
  subjectId?: string;
  subject?: Subject;
}

/**
 * Module Pédagogique - Événements & Planning
 */

export interface LessonPlan {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  title: string;
  objectives: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt?: string;
  approvedAt?: string;
}

export interface ClassJournalEntry {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  content: string;
  observations?: string;
}

/**
 * Notifications & Alertes Système
 */

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'SYNC';
  read: boolean;
  createdAt: string;
  link?: string;
}
