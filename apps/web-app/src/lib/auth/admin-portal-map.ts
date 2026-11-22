/**
 * ============================================================================
 * ADMIN PORTAL MAP — Portails administratifs dédiés (un shell par métier)
 * ============================================================================
 *
 * SOURCE DE VÉRITÉ UNIQUE pour les portails administratifs dédiés :
 *   - Directeur        → /app/director            (shell indigo)
 *   - Secrétaire       → /app/secretaire          (shell sky)
 *   - Secrétaire-Compt. → /app/secretaire-comptable (shell emerald)
 *   - Comptable        → /app/comptable           (shell teal)
 *   - Surveillant      → /app/surveillant         (shell amber)
 *   - Censeur          → /app/censeur             (shell violet)
 *
 * PRINCIPE (validation utilisateur) :
 *   Chaque métier de l'administration a SON PROPRE shell — sa sidebar, son
 *   thème, sa navigation écrite en dur, son tableau de bord d'accueil —
 *   exactement comme les portails Enseignant et Parent. Plus aucun filtrage
 *   de menus par rôle : les modules de chaque portail sont déclarés.
 *
 * STRATÉGIE DE RENDU :
 *   Le shell est appliqué PAR RÔLE dans le layout racine (app/app/layout.tsx) :
 *   toutes les routes /app/* d'un rôle migré s'affichent dans SON shell,
 *   y compris les pages métier partagées (/app/pedagogy, /app/exams…).
 *   → 86 pages réutilisées telles quelles, zéro façade à dupliquer.
 *   → Les modules profonds (exams, finance, hr) conservent leurs propres
 *     sous-navigations et contextes, intacts.
 *
 * MIGRATION (strangler pattern — ordre validé par l'utilisateur) :
 *   directeur → secrétaire → secrétaire-comptable → comptable →
 *   surveillant → censeur. ✅ Les 6 portails sont désormais ACTIFS —
 *   chaque métier de l'administration atterrit sur SON UI à la connexion.
 *
 * ⭐ RÈGLE D'UNION (validation utilisateur) : le SECRÉTAIRE-COMPTABLE cumule
 *   les DEUX métiers — ses modules = l'union complète des modules du
 *   SECRÉTAIRE et du COMPTABLE (scolarité + finances + paie + communication).
 *   Le secrétaire « simple » n'a QUE les modules secrétaire ; le comptable
 *   « simple » n'a QUE les modules comptable.
 *
 * UI PRINCIPALE PARTAGÉE (PilotageLayout) — réservée à :
 *   - le PROMOTEUR et les rôles full-access (filet de sécurité validé :
 *     accès complet à tous les modules + visite de tous les portails),
 *   - les rôles auxiliaires non spécialisés (RESP_*, PEDAGOGIC_*,
 *     BOARD_PRESIDENT… — pas de métier dédié, à traiter au cas par cas),
 *   - les rôles plateforme (back-office /platform dédié).
 *
 * DOUBLE CASQUETTE :
 *   Le portail CHOISI à la connexion (session.portalType) prime toujours :
 *   un directeur qui se connecte via le portail Enseignant (matricule)
 *   atterrit sur /app/teacher — la résolution du shell admin n'intervient
 *   que pour le portail ÉCOLE (voir getEffectivePortal dans role-portal-map).
 * ============================================================================
 */

import { getPortalForRole } from './role-portal-map';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AdminPortalKey =
  | 'director'
  | 'secretaire'
  | 'secretaire-comptable'
  | 'comptable'
  | 'surveillant'
  | 'censeur';

/**
 * Icônes de navigation (clés string → sérialisables entre server et client).
 * Le registre des composants lucide correspondants vit dans AdminPortalShell.
 */
export type AdminPortalIcon =
  | 'LayoutDashboard'
  | 'Brain'
  | 'School'
  | 'Users'
  | 'GraduationCap'
  | 'Shield'
  | 'Wallet'
  | 'UserCog'
  | 'MessageSquare'
  | 'CalendarDays'
  | 'ClipboardCheck'
  | 'Receipt'
  // ⭐ 2026-09-21 — module Réception des épreuves (Préparation d'examen)
  | 'NotebookPen'
  // ⭐ 2026-09-27 — module Patronats fédérés (validation des rattachements
  //    patronat côté école — Academia Federis)
  | 'Network'
  // ⭐ 2026-11-21 — module self-service « Ma Présence & Congés » du personnel
  //    (présence GPS, heures supp., demandes de congé/absence)
  | 'CalendarCheck';

export interface AdminPortalModule {
  /** Route cible (routes métier partagées ou home du portail) */
  path: string;
  label: string;
  /** ⭐ P4-final : libellé anglais (piste anglophone → UI 100% EN) */
  labelEn?: string;
  icon: AdminPortalIcon;
  desc: string;
  /** ⭐ P4-final : description anglaise */
  descEn?: string;
  /** Feature flag du tenant (module activé ?) — filtrage tenant, pas par rôle */
  featureCode?: string;
  /** Module spécifique au niveau Secondaire (ex: Vie Scolaire) */
  requiresSecondary?: boolean;
}

export type AdminPortalAccent = 'indigo' | 'sky' | 'emerald' | 'teal' | 'amber' | 'violet';

export interface AdminPortalConfig {
  key: AdminPortalKey;
  /** Chemin de la home du portail (cible de la redirection post-login) */
  path: string;
  /** Libellé du portail (header + fallback titre) */
  label: string;
  /** ⭐ P4-final : libellé anglais du portail */
  labelEn: string;
  /** Libellé du métier (badge profil dans la sidebar) */
  roleLabel: string;
  /** ⭐ P4-final : libellé anglais du métier */
  roleLabelEn: string;
  accent: AdminPortalAccent;
  /** Onglet de login à rouvrir après déconnexion */
  loginPortal: string;
  /** Navigation du portail — ÉCRITE EN DUR, volontairement */
  modules: AdminPortalModule[];
  /** Rôles DB qui vivent dans ce portail (variantes FR/EN + niveau-spécifiques) */
  roles: string[];
  /**
   * Portail migré (shell actif) ou déclaré (prêt pour une prochaine phase).
   * Un portail non actif ne redirige personne : son rôle reste sur l'UI partagée.
   */
  active: boolean;
}

// ─── Rôles par métier ───────────────────────────────────────────────────────

/** Directeurs (toutes variantes FR/EN + niveau-spécifiques) */
const DIRECTOR_ROLES = [
  'DIRECTEUR', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
  'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI',
  'DIRECTOR', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
  'PROVISEUR', 'DIRECTEUR_DES_ETUDES',
];

/** Secrétaires / Scolarité */
const SECRETARY_ROLES = [
  'SECRETAIRE', 'SECRETAIRE_GENERAL',
  'SECRETAIRE_MATERNELLE', 'SECRETAIRE_PRIMAIRE', 'SECRETAIRE_SECONDAIRE', 'SECRETAIRE_MAT_PRI',
  'SECRETARY', 'SCOLARITE', 'RESP_SCOLARITE',
];

/** Secrétaires-comptables */
const SECRETARY_COMPTABLE_ROLES = [
  'SECRETAIRE_COMPTABLE',
  'SECRETAIRE_COMPTABLE_MATERNELLE', 'SECRETAIRE_COMPTABLE_PRIMAIRE',
  'SECRETAIRE_COMPTABLE_SECONDAIRE', 'SECRETAIRE_COMPTABLE_MAT_PRI',
  // ⭐ v4.2.0 — alias EN (la DB stocke les libellés FR, mais le type
  //    UserRole du front et certains flux d'import utilisent l'anglais :
  //    sans lui, le rôle retombait sur l'UI complète partagée).
  'SECRETARY_ACCOUNTANT',
];

/** Comptabilité & finances (hors secrétaires-comptables) */
const COMPTABLE_ROLES = [
  'COMPTABLE', 'ACCOUNTANT', 'ECONOME', 'INTENDANT',
  'CFO', 'FINANCE_MANAGER', 'CASHIER', 'CAISSIER', 'RECOVERY_MANAGER',
];

/** Vie scolaire */
const SURVEILLANT_ROLES = [
  'SURVEILLANT', 'SURVEILLANT_GENERAL', 'GENERAL_MONITOR',
];

/** Censeurs */
const CENSEUR_ROLES = ['CENSEUR', 'CENSOR'];

/**
 * ⭐ Rôles full-access — filet de sécurité (validation utilisateur) :
 * ils conservent l'UI complète partagée (PilotageLayout) et peuvent visiter
 * tous les portails dédiés. SUPER_DIRECTOR = promoteur multi-écoles (à venir).
 */
const ADMIN_FULL_ACCESS_ROLES = [
  'PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
  'SUPER_DIRECTOR', 'SUPER_ADMIN', 'admin',
  'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
];

/**
 * ⭐ 2026-11-21 — Module self-service « Ma Présence & Congés » du personnel.
 *
 * Partagé par TOUS les portails administratifs (directeur, secrétaire,
 * secrétaire-comptable, comptable, surveillant, censeur) : chaque membre du
 * personnel pointe SA présence, déclare ses heures supp. et soumet SES
 * demandes de congé/absence — le RH reçoit, approuve/refuse, et le personnel
 * est notifié (cloche). Tout est synchronisé avec le module RH (Présences /
 * Congés & Absences — les présences alimentent la paie).
 * Les enseignants ont l'équivalent dans leur portail (/app/teacher/presence).
 */
const MY_PRESENCE_MODULE: AdminPortalModule = {
  path: '/app/my-presence',
  label: 'Ma Présence & Congés',
  labelEn: 'My Attendance & Leaves',
  icon: 'CalendarCheck',
  desc: 'Pointer ma présence, heures supp., demandes de congé/absence',
  descEn: 'Check in, overtime, leave & absence requests',
};

/**
 * ⭐ 22/11/2026 — Module self-service « Ma Paie » du personnel.
 *
 * Chaque membre du personnel consulte SES fiches de paie / états de paiement
 * émis par le RH (liste par période, net à payer) et télécharge le PDF
 * archivé (scellé SHA-256) — il est notifié dans la cloche à chaque émission
 * mensuelle. Les enseignants ont l'équivalent dans leur portail
 * (/app/teacher/paie).
 */
const MY_PAYSLIPS_MODULE: AdminPortalModule = {
  path: '/app/my-paie',
  label: 'Ma Paie',
  labelEn: 'My Payroll',
  icon: 'Wallet',
  desc: 'Mes fiches de paie et états de paiement — téléchargement PDF',
  descEn: 'My payslips and payment statements — PDF download',
};

// ─── Définition des portails ────────────────────────────────────────────────

export const ADMIN_PORTALS: Record<AdminPortalKey, AdminPortalConfig> = {
  director: {
    key: 'director',
    path: '/app/director',
    label: 'Portail Directeur',
    labelEn: 'Director Portal',
    roleLabel: 'Directeur',
    roleLabelEn: 'Director',
    accent: 'indigo',
    loginPortal: 'school',
    active: true,
    roles: DIRECTOR_ROLES,
    modules: [
      { path: '/app/director', label: 'Tableau de bord', labelEn: 'Dashboard', icon: 'LayoutDashboard', desc: "Pilotage global de l'établissement", descEn: "School-wide overview and steering" },
      // ⭐ Self-service personnel : présence, heures supp., congés/absences
      MY_PRESENCE_MODULE,
      // ⭐ Self-service personnel : fiches de paie / états de paiement (PDF)
      MY_PAYSLIPS_MODULE,
      { path: '/app/director/oversight', label: 'Espace Directeur', labelEn: 'Director Space', icon: 'Brain', desc: 'Score de risque croisé + décrochage (Secondaire)', descEn: 'Cross risk score + dropout (Secondary)', requiresSecondary: true },
      { path: '/app/pedagogy', label: 'Organisation Pédagogique', labelEn: 'Pedagogical Organisation', icon: 'School', desc: 'Planification, cahiers, validation des documents', descEn: 'Planning, notebooks, document approval', featureCode: 'PEDAGOGY' },
      { path: '/app/students', label: 'Élèves & Scolarité', labelEn: 'Students & Enrollment', icon: 'Users', desc: 'Inscriptions, dossiers, effectifs', descEn: 'Admissions, records, headcount', featureCode: 'STUDENTS' },
      { path: '/app/exams', label: 'Examens, Notes & Bulletins', labelEn: 'Exams, Grades & Report Cards', icon: 'GraduationCap', desc: 'Évaluations, saisie, validation, bulletins', descEn: 'Assessments, grading, validation, report cards', featureCode: 'EXAMS' },
      { path: '/app/discipline', label: 'Vie Scolaire', labelEn: 'School Life', icon: 'Shield', desc: 'Sanctions, conduite, assiduité (Secondaire)', descEn: 'Sanctions, conduct, attendance (Secondary)', requiresSecondary: true },
      { path: '/app/finance', label: 'Finances & Économat', labelEn: 'Finance & Store', icon: 'Wallet', desc: 'Frais, encaissements, trésorerie', descEn: 'Fees, collections, treasury', featureCode: 'FINANCE' },
      { path: '/app/hr', label: 'Personnel, RH & Paie', labelEn: 'Staff, HR & Payroll', icon: 'UserCog', desc: 'Staff, contrats, paie, CNSS', descEn: 'Staff, contracts, payroll, CNSS', featureCode: 'HR_PAYROLL' },
      { path: '/app/communication', label: 'Helm Connect', labelEn: 'Helm Connect', icon: 'MessageSquare', desc: 'Communication & collaboration', descEn: 'Communication & collaboration', featureCode: 'COMMUNICATION' },
      // ⭐ 2026-09-27 — PATRONATS FÉDÉRÉS : validation par l'école des demandes
      //    de rattachement émises par les patronats (Academia Federis)
      { path: '/app/federis', label: 'Patronats & Examens fédérés', labelEn: 'Federated Patronats & Exams', icon: 'Network', desc: "Demandes de rattachement des patronats — validation, examens nationaux", descEn: 'Patronat link requests — approval, national exams' },
    ],
  },

  secretaire: {
    key: 'secretaire',
    path: '/app/secretaire',
    label: 'Portail Secrétaire',
    labelEn: 'Secretary Portal',
    roleLabel: 'Secrétaire',
    roleLabelEn: 'Secretary',
    accent: 'sky',
    loginPortal: 'school',
    active: true,
    roles: SECRETARY_ROLES,
    modules: [
      // ⭐ FIX 2026-09-07 (demande promoteur) : la home du portail est le
      // TABLEAU DE BORD (PilotageDashboardV2 — même tableau de bord que /app),
      // pas l'outil métier directement. Le quotidien « Élèves & Scolarité »
      // reste le module n°2, à un clic.
      { path: '/app/secretaire', label: 'Tableau de bord', labelEn: 'Dashboard', icon: 'LayoutDashboard', desc: 'KPIs effectifs, finances, alertes', descEn: 'Headcount, finance KPIs, alerts' },
      // ⭐ Self-service personnel : présence, heures supp., congés/absences
      MY_PRESENCE_MODULE,
      // ⭐ Self-service personnel : fiches de paie / états de paiement (PDF)
      MY_PAYSLIPS_MODULE,
      { path: '/app/students', label: 'Élèves & Scolarité', labelEn: 'Students & Enrollment', icon: 'Users', desc: 'Inscriptions, dossiers, effectifs', descEn: 'Admissions, records, headcount', featureCode: 'STUDENTS' },
      // ⭐ 2026-09-21 — MODULE PRÉPARATION D'EXAMEN : réception des épreuves
      //    d'évaluation envoyées par les enseignants après validation direction.
      //    Hiérarchisées par classe, trimestre et mois — visualisation + impression.
      { path: '/app/exam-reception', label: 'Réception des épreuves', labelEn: 'Exam Papers Reception', icon: 'NotebookPen', desc: "Épreuves d'évaluation reçues — visualisation et impression", descEn: 'Received assessment papers — view and print' },
      { path: '/app/exams', label: 'Examens, Notes & Bulletins', labelEn: 'Exams, Grades & Report Cards', icon: 'GraduationCap', desc: 'Bulletins, impressions', descEn: 'Report cards, printing', featureCode: 'EXAMS' },
      { path: '/app/communication', label: 'Helm Connect', labelEn: 'Helm Connect', icon: 'MessageSquare', desc: 'Communication & collaboration', descEn: 'Communication & collaboration', featureCode: 'COMMUNICATION' },
      // ⭐ 2026-09-27 — PATRONATS FÉDÉRÉS : le secrétariat traite les demandes
      //    de rattachement des patronats (accusés de réception, PV)
      { path: '/app/federis', label: 'Patronats & Examens fédérés', labelEn: 'Federated Patronats & Exams', icon: 'Network', desc: "Demandes de rattachement des patronats — validation, examens nationaux", descEn: 'Patronat link requests — approval, national exams' },
    ],
  },

  'secretaire-comptable': {
    key: 'secretaire-comptable',
    path: '/app/secretaire-comptable',
    label: 'Portail Secrétaire-Comptable',
    labelEn: 'Secretary-Accountant Portal',
    roleLabel: 'Secrétaire-Comptable',
    roleLabelEn: 'Secretary-Accountant',
    accent: 'emerald',
    loginPortal: 'school',
    active: true,
    roles: SECRETARY_COMPTABLE_ROLES,
    modules: [
      //  FIX 2026-09-07 (demande promoteur) : la home du portail est le
      // TABLEAU DE BORD (PilotageDashboardV2 — même tableau de bord unifié
      // que /app, cohérent avec l'union des deux métiers), pas l'outil
      // Encaissements directement. L'outil Encaissements reste le module n°2,
      // à un clic.
      { path: '/app/secretaire-comptable', label: 'Tableau de bord', labelEn: 'Dashboard', icon: 'LayoutDashboard', desc: 'KPIs effectifs, finances, alertes', descEn: 'Headcount, finance KPIs, alerts' },
      // ⭐ Self-service personnel : présence, heures supp., congés/absences
      MY_PRESENCE_MODULE,
      // ⭐ Self-service personnel : fiches de paie / états de paiement (PDF)
      MY_PAYSLIPS_MODULE,
      // UNION DES DEUX MÉTIERS (validation utilisateur) : le secrétaire-
      // comptable a TOUT ce que le secrétaire a ET TOUT ce que le comptable
      // a. Outil quotidien : Encaissements (TransactionsContent partagé —
      // le même que /app/finance/payments).
      { path: '/app/finance/payments', label: 'Encaissements', labelEn: 'Collections', icon: 'Receipt', desc: 'Saisie des encaissements de frais', descEn: 'Fee collection entry' },
      // Côté COMPTABLE : tableau de bord financier (page du portail comptable,
      // rendue dans SON shell — zéro duplication).
      { path: '/app/comptable', label: 'Tableau de bord financier', labelEn: 'Financial Dashboard', icon: 'LayoutDashboard', desc: "Vue financière de l'établissement", descEn: "School's financial view" },
      // Côté SECRÉTAIRE : l'outil Élèves & Scolarité (même composant que la
      // home du portail secrétaire — /app/secretaire et /app/students rendent
      // StudentsModulePage).
      { path: '/app/students', label: 'Élèves & Scolarité', labelEn: 'Students & Enrollment', icon: 'Users', desc: 'Inscriptions, dossiers, effectifs', descEn: 'Admissions, records, headcount', featureCode: 'STUDENTS' },
      // ⭐ 2026-09-21 — MODULE PRÉPARATION D'EXAMEN (côté secrétaire de l'union) :
      //    réception des épreuves d'évaluation — classe → trimestre → mois.
      { path: '/app/exam-reception', label: 'Réception des épreuves', labelEn: 'Exam Papers Reception', icon: 'NotebookPen', desc: "Épreuves d'évaluation reçues — visualisation et impression", descEn: 'Received assessment papers — view and print' },
      // Côté COMPTABLE : module Finances & Économat complet.
      { path: '/app/finance', label: 'Finances & Économat', labelEn: 'Finance & Store', icon: 'Wallet', desc: 'Frais, recouvrement, trésorerie', descEn: 'Fees, recovery, treasury', featureCode: 'FINANCE' },
      // Côté SECRÉTAIRE + COMPTABLE : examens (saisie des notes, bulletins).
      { path: '/app/exams', label: 'Examens, Notes & Bulletins', labelEn: 'Exams, Grades & Report Cards', icon: 'GraduationCap', desc: 'Bulletins, impressions', descEn: 'Report cards, printing', featureCode: 'EXAMS' },
      // Paie : le secrétaire-comptable gère la paie dans l'UI partagée
      //    actuelle (HR_ROLES inclut SECRETAIRE_COMPTABLE) — parité conservée.
      { path: '/app/hr', label: 'Personnel, RH & Paie', labelEn: 'Staff, HR & Payroll', icon: 'UserCog', desc: 'Staff, contrats, paie, CNSS', descEn: 'Staff, contracts, payroll, CNSS', featureCode: 'HR_PAYROLL' },
      { path: '/app/communication', label: 'Helm Connect', labelEn: 'Helm Connect', icon: 'MessageSquare', desc: 'Communication & collaboration', descEn: 'Communication & collaboration', featureCode: 'COMMUNICATION' },
    ],
  },

  comptable: {
    key: 'comptable',
    path: '/app/comptable',
    label: 'Portail Comptable',
    labelEn: 'Accountant Portal',
    roleLabel: 'Comptable',
    roleLabelEn: 'Accountant',
    accent: 'teal',
    loginPortal: 'school',
    active: true,
    roles: COMPTABLE_ROLES,
    modules: [
      { path: '/app/comptable', label: 'Tableau de bord', labelEn: 'Dashboard', icon: 'LayoutDashboard', desc: "Vue financière de l'établissement", descEn: "School's financial view" },
      // ⭐ Self-service personnel : présence, heures supp., congés/absences
      MY_PRESENCE_MODULE,
      // ⭐ Self-service personnel : fiches de paie / états de paiement (PDF)
      MY_PAYSLIPS_MODULE,
      { path: '/app/finance', label: 'Finances & Économat', labelEn: 'Finance & Store', icon: 'Wallet', desc: 'Frais, encaissements, trésorerie, audit', descEn: 'Fees, collections, treasury, audit', featureCode: 'FINANCE' },
      { path: '/app/students', label: 'Élèves & Scolarité', labelEn: 'Students & Enrollment', icon: 'Users', desc: 'Effectifs, dossiers', descEn: 'Headcount, records', featureCode: 'STUDENTS' },
      { path: '/app/exams', label: 'Examens, Notes & Bulletins', labelEn: 'Exams, Grades & Report Cards', icon: 'GraduationCap', desc: 'Bulletins, impressions', descEn: 'Report cards, printing', featureCode: 'EXAMS' },
      { path: '/app/communication', label: 'Helm Connect', labelEn: 'Helm Connect', icon: 'MessageSquare', desc: 'Communication & collaboration', descEn: 'Communication & collaboration', featureCode: 'COMMUNICATION' },
    ],
  },

  surveillant: {
    key: 'surveillant',
    path: '/app/surveillant',
    label: 'Portail Surveillant',
    labelEn: 'Head Monitor Portal',
    roleLabel: 'Surveillant',
    roleLabelEn: 'Head Monitor',
    accent: 'amber',
    loginPortal: 'school',
    active: true,
    roles: SURVEILLANT_ROLES,
    modules: [
      { path: '/app/surveillant', label: 'Tableau de bord', labelEn: 'Dashboard', icon: 'LayoutDashboard', desc: 'Vue vie scolaire', descEn: 'School life overview' },
      // ⭐ Self-service personnel : présence, heures supp., congés/absences
      MY_PRESENCE_MODULE,
      // ⭐ Self-service personnel : fiches de paie / états de paiement (PDF)
      MY_PAYSLIPS_MODULE,
      { path: '/app/students', label: 'Élèves & Scolarité', labelEn: 'Students & Enrollment', icon: 'Users', desc: 'Effectifs, dossiers', descEn: 'Headcount, records', featureCode: 'STUDENTS' },
      { path: '/app/discipline', label: 'Vie Scolaire', labelEn: 'School Life', icon: 'Shield', desc: 'Sanctions, conduite, assiduité (Secondaire)', descEn: 'Sanctions, conduct, attendance (Secondary)', requiresSecondary: true },
      // ⭐ Parité d'accès : le surveillant général accède à l'Espace Censeur
      //    (visites de classes, conseils de classe) dans l'UI partagée.
      { path: '/app/censeur', label: 'Espace Censeur', labelEn: 'Censor Space', icon: 'ClipboardCheck', desc: 'Visites de classes, conseils de classe (Secondaire)', descEn: 'Class visits, class councils (Secondary)', requiresSecondary: true },
      { path: '/app/exams', label: 'Examens, Notes & Bulletins', labelEn: 'Exams, Grades & Report Cards', icon: 'GraduationCap', desc: 'Surveillance des examens', descEn: 'Exam invigilation', featureCode: 'EXAMS' },
      { path: '/app/communication', label: 'Helm Connect', labelEn: 'Helm Connect', icon: 'MessageSquare', desc: 'Communication & collaboration', descEn: 'Communication & collaboration', featureCode: 'COMMUNICATION' },
    ],
  },

  censeur: {
    key: 'censeur',
    path: '/app/censeur',
    label: 'Portail Censeur',
    labelEn: 'Censor Portal',
    roleLabel: 'Censeur',
    roleLabelEn: 'Censor',
    accent: 'violet',
    loginPortal: 'school',
    active: true,
    roles: CENSEUR_ROLES,
    modules: [
      // ⭐ La home du portail est l'Espace Censeur (workspace dédié existant :
      //    visites de classes, conseils de classe, fraudes aux examens).
      { path: '/app/censeur', label: 'Espace Censeur', labelEn: 'Censor Space', icon: 'ClipboardCheck', desc: 'Visites de classes, conseils de classe, fraudes', descEn: 'Class visits, class councils, exam fraud' },
      // ⭐ Self-service personnel : présence, heures supp., congés/absences
      MY_PRESENCE_MODULE,
      // ⭐ Self-service personnel : fiches de paie / états de paiement (PDF)
      MY_PAYSLIPS_MODULE,
      { path: '/app/pedagogy', label: 'Organisation Pédagogique', labelEn: 'Pedagogical Organisation', icon: 'School', desc: 'Planification, cahiers, contrôle', descEn: 'Planning, notebooks, oversight', featureCode: 'PEDAGOGY' },
      { path: '/app/exams', label: 'Examens, Notes & Bulletins', labelEn: 'Exams, Grades & Report Cards', icon: 'GraduationCap', desc: 'Évaluations, fraudes, validation', descEn: 'Assessments, fraud, validation', featureCode: 'EXAMS' },
      { path: '/app/discipline', label: 'Vie Scolaire', labelEn: 'School Life', icon: 'Shield', desc: 'Conduite, sanctions (Secondaire)', descEn: 'Conduct, sanctions (Secondary)', requiresSecondary: true },
      { path: '/app/students', label: 'Élèves & Scolarité', labelEn: 'Students & Enrollment', icon: 'Users', desc: 'Effectifs, dossiers', descEn: 'Headcount, records', featureCode: 'STUDENTS' },
      { path: '/app/communication', label: 'Helm Connect', labelEn: 'Helm Connect', icon: 'MessageSquare', desc: 'Communication & collaboration', descEn: 'Communication & collaboration', featureCode: 'COMMUNICATION' },
    ],
  },
};

// ─── Fonctions utilitaires ──────────────────────────────────────────────────

/**
 * Retourne le portail administratif dédié ACTIF pour un rôle donné,
 * ou null si le rôle n'est pas migré (→ UI partagée PilotageLayout).
 *
 * Ordre de résolution :
 *   1. Rôles plateforme → null (back-office /platform dédié)
 *   2. Full-access (promoteur, admins) → null (UI complète partagée, filet de sécurité)
 *   3. Lookup exact dans les portails actifs
 *   4. Fallback par préfixe — le backend génère des variantes niveau-spécifiques
 *      (ex: DIRECTEUR_SEC, SECRETAIRE_COMPTABLE_MAT_PRI…) mappées robustement
 */
export function getAdminShellForRole(role: string | undefined | null): AdminPortalConfig | null {
  if (!role) return null;

  // 1. Les rôles plateforme vivent dans le back-office /platform
  if (getPortalForRole(role) === 'PLATFORM') return null;

  // 2. Filet de sécurité promoteur / admins : UI complète partagée
  if (ADMIN_FULL_ACCESS_ROLES.includes(role)) return null;

  const r = role.toUpperCase();

  // 3. Lookup exact (portails actifs uniquement)
  for (const portal of Object.values(ADMIN_PORTALS)) {
    if (portal.active && portal.roles.includes(role)) return portal;
  }

  // 4. Fallback par préfixe — uniquement si le portail cible est actif
  if (r.startsWith('DIRECTEUR') || r.startsWith('DIRECTOR') || r === 'PROVISEUR') {
    return ADMIN_PORTALS.director.active ? ADMIN_PORTALS.director : null;
  }
  if (r.startsWith('SECRETAIRE_COMPTABLE') || r === 'SECRETARY_ACCOUNTANT' || r.startsWith('SECRETARY_ACCOUNTANT_')) {
    return ADMIN_PORTALS['secretaire-comptable'].active ? ADMIN_PORTALS['secretaire-comptable'] : null;
  }
  if (r.startsWith('SECRETAIRE')) {
    return ADMIN_PORTALS.secretaire.active ? ADMIN_PORTALS.secretaire : null;
  }
  if (r.startsWith('COMPTABLE') || r === 'ACCOUNTANT' || r === 'ECONOME' || r === 'INTENDANT') {
    return ADMIN_PORTALS.comptable.active ? ADMIN_PORTALS.comptable : null;
  }
  if (r.startsWith('SURVEILLANT') || r === 'GENERAL_MONITOR') {
    return ADMIN_PORTALS.surveillant.active ? ADMIN_PORTALS.surveillant : null;
  }
  if (r.startsWith('CENSEUR') || r === 'CENSOR') {
    return ADMIN_PORTALS.censeur.active ? ADMIN_PORTALS.censeur : null;
  }

  return null;
}

/**
 * Home du portail dédié pour la redirection post-login
 * (utilisé par /app/page.tsx : un directeur connecté via le portail École
 * atterrit directement sur /app/director).
 */
export function getAdminPortalHomeForRole(role: string | undefined | null): string | null {
  return getAdminShellForRole(role)?.path ?? null;
}

/**
 * Garde d'accès à un portail dédié (défense en profondeur du shell) :
 *   - rôles du portail (lookup exact OU préfixe, actif ou non)
 *   - UNION : le secrétaire-comptable accède aux portails secrétaire et
 *     comptable en plus du sien (il cumule les deux métiers)
 *   - rôles full-access (promoteur, admins — filet de sécurité)
 * Renvoie false pour les rôles d'un autre métier et les rôles plateforme.
 */
export function canRoleAccessAdminPortal(role: string | undefined | null, key: AdminPortalKey): boolean {
  if (!role) return false;

  const portal = ADMIN_PORTALS[key];
  if (!portal) return false;

  // Filet de sécurité promoteur / admins : accès à TOUS les portails dédiés
  if (ADMIN_FULL_ACCESS_ROLES.includes(role)) return true;

  if (portal.roles.includes(role)) return true;

  // ⭐ UNION (validation utilisateur) : le secrétaire-comptable cumule les
  //    deux métiers — il a accès aux portails SECRÉTAIRE et COMPTABLE en plus
  //    du sien (le layout continue de résoudre SON shell en priorité : la
  //    résolution getAdminShellForRole passe toujours par secretaire-comptable
  //    d'abord, cf. ordre des préfixes ci-dessous).
  const r = role.toUpperCase();
  if (r.startsWith('SECRETAIRE_COMPTABLE')) {
    return key === 'secretaire-comptable' || key === 'secretaire' || key === 'comptable';
  }

  // Fallback par préfixe (variantes niveau-spécifiques générées côté backend)
  if (key === 'director') {
    return r.startsWith('DIRECTEUR') || r.startsWith('DIRECTOR') || r === 'PROVISEUR';
  }
  if (key === 'secretaire-comptable') return r.startsWith('SECRETAIRE_COMPTABLE');
  if (key === 'secretaire') return r.startsWith('SECRETAIRE') && !r.startsWith('SECRETAIRE_COMPTABLE');
  if (key === 'comptable') {
    return r.startsWith('COMPTABLE') || r === 'ACCOUNTANT' || r === 'ECONOME' || r === 'INTENDANT';
  }
  if (key === 'surveillant') return r.startsWith('SURVEILLANT') || r === 'GENERAL_MONITOR';
  if (key === 'censeur') return r.startsWith('CENSEUR') || r === 'CENSOR';
  return false;
}
