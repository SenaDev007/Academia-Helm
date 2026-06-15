/// ============================================================================
/// MODULE CONFIGURATION — Academia Hub Mobile
/// ============================================================================
///
/// Defines the modules, sub-tabs, and visibility rules per portal.
/// 5 Portals: PLATFORM, SCHOOL, TEACHER, PARENT, PUBLIC
/// No Federis — Academia Federis is a separate application.
///
/// DYNAMIC SYNC: This module also provides [mergeWithRemoteConfig] which
/// merges the hardcoded modules with the remote API configuration, enabling
/// the mobile app to dynamically update when the web app changes.
/// ============================================================================

import 'user_role.dart';

// ─── SubTab ──────────────────────────────────────────────────────────────────

/// A single tab within a module.
class SubTab {
  final String id;
  final String label;
  final String icon;
  final String route;

  const SubTab({
    required this.id,
    required this.label,
    required this.icon,
    required this.route,
  });
}

// ─── ModuleConfig ────────────────────────────────────────────────────────────

/// Configuration for a module (e.g. "Students", "Finance").
class ModuleConfig {
  final String id;
  final String label;
  final String icon;
  final String route;
  final List<PortalType> portals;
  final List<SubTab> subTabs;

  /// Optional feature code that gates this module's visibility.
  /// If set, the module is only visible when this feature is enabled
  /// in the remote configuration.
  final String? featureCode;

  const ModuleConfig({
    required this.id,
    required this.label,
    required this.icon,
    required this.route,
    required this.portals,
    this.subTabs = const [],
    this.featureCode,
  });

  /// Whether this module is visible for the given portal.
  bool isVisibleFor(PortalType portal) => portals.contains(portal);

  /// Creates a copy of this ModuleConfig with optional overrides.
  /// Used by the dynamic merge system to override local values with remote ones.
  ModuleConfig copyWith({
    String? id,
    String? label,
    String? icon,
    String? route,
    List<PortalType>? portals,
    List<SubTab>? subTabs,
    String? featureCode,
  }) {
    return ModuleConfig(
      id: id ?? this.id,
      label: label ?? this.label,
      icon: icon ?? this.icon,
      route: route ?? this.route,
      portals: portals ?? this.portals,
      subTabs: subTabs ?? this.subTabs,
      featureCode: featureCode ?? this.featureCode,
    );
  }
}

// ─── Module Definitions ─────────────────────────────────────────────────────

/// Dashboard module — available in all authenticated portals.
const dashboardModule = ModuleConfig(
  id: 'dashboard',
  label: 'Tableau de bord',
  icon: 'layout-dashboard',
  route: '/dashboard',
  portals: [
    PortalType.platform,
    PortalType.school,
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'overview', label: 'Vue d\'ensemble', icon: 'bar-chart-3', route: '/dashboard/overview'),
    SubTab(id: 'stats', label: 'Statistiques', icon: 'trending-up', route: '/dashboard/stats'),
  ],
);

/// Students module — school, teacher, parent portals.
const studentsModule = ModuleConfig(
  id: 'students',
  label: 'Élèves',
  icon: 'graduation-cap',
  route: '/students',
  portals: [
    PortalType.school,
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'students-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/students/dashboard'),
    SubTab(id: 'students-list', label: 'Liste', icon: 'users', route: '/students/list'),
    SubTab(id: 'students-enrollments', label: 'Inscriptions', icon: 'user-plus', route: '/students/enrollments'),
    SubTab(id: 'students-attendance', label: 'Présence', icon: 'calendar-check', route: '/students/attendance'),
    SubTab(id: 'students-grades', label: 'Notes', icon: 'file-text', route: '/students/grades'),
    SubTab(id: 'students-discipline', label: 'Discipline', icon: 'shield', route: '/students/discipline'),
    SubTab(id: 'students-health', label: 'Santé', icon: 'heart', route: '/students/health'),
    SubTab(id: 'students-transports', label: 'Transports', icon: 'bus', route: '/students/transports'),
    SubTab(id: 'students-canteen', label: 'Cantine', icon: 'utensils', route: '/students/canteen'),
    SubTab(id: 'students-documents', label: 'Documents', icon: 'folder', route: '/students/documents'),
    SubTab(id: 'students-communications', label: 'Communications', icon: 'message-circle', route: '/students/communications'),
    SubTab(id: 'students-scholarships', label: 'Bourses', icon: 'award', route: '/students/scholarships'),
    SubTab(id: 'students-activities', label: 'Activités', icon: 'activity', route: '/students/activities'),
    SubTab(id: 'students-alumni', label: 'Anciens', icon: 'graduation-cap', route: '/students/alumni'),
    SubTab(id: 'students-reports', label: 'Rapports', icon: 'bar-chart', route: '/students/reports'),
    SubTab(id: 'students-archive', label: 'Archive', icon: 'archive', route: '/students/archive'),
    SubTab(id: 'students-orion', label: 'Orion', icon: 'sparkles', route: '/students/orion'),
  ],
);

/// Grades / Notes module — school, teacher, parent portals.
const gradesModule = ModuleConfig(
  id: 'grades',
  label: 'Notes',
  icon: 'file-text',
  route: '/grades',
  portals: [
    PortalType.school,
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'list', label: 'Liste des notes', icon: 'list', route: '/grades/list'),
    SubTab(id: 'bulletins', label: 'Bulletins', icon: 'file-badge', route: '/grades/bulletins'),
    SubTab(id: 'averages', label: 'Moyennes', icon: 'bar-chart', route: '/grades/averages'),
  ],
);

/// Finance module — school and parent portals.
const financeModule = ModuleConfig(
  id: 'finance',
  label: 'Finance',
  icon: 'banknote',
  route: '/finance',
  portals: [
    PortalType.school,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'finance-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/finance/dashboard'),
    SubTab(id: 'finance-payments', label: 'Paiements', icon: 'credit-card', route: '/finance/payments'),
    SubTab(id: 'finance-invoices', label: 'Factures', icon: 'receipt', route: '/finance/invoices'),
    SubTab(id: 'finance-receipts', label: 'Reçus', icon: 'file-check', route: '/finance/receipts'),
    SubTab(id: 'finance-budget', label: 'Budget', icon: 'pie-chart', route: '/finance/budget'),
    SubTab(id: 'finance-salary', label: 'Paie', icon: 'banknote', route: '/finance/salary'),
    SubTab(id: 'finance-expenses', label: 'Dépenses', icon: 'trending-down', route: '/finance/expenses'),
    SubTab(id: 'finance-reports', label: 'Rapports', icon: 'bar-chart', route: '/finance/reports'),
    SubTab(id: 'finance-audit', label: 'Audit', icon: 'shield-check', route: '/finance/audit'),
    SubTab(id: 'finance-settings', label: 'Paramètres', icon: 'settings', route: '/finance/settings'),
    SubTab(id: 'finance-orion', label: 'Orion', icon: 'sparkles', route: '/finance/orion'),
  ],
);

/// Pedagogy module — school and teacher portals.
const pedagogyModule = ModuleConfig(
  id: 'pedagogy',
  label: 'Pédagogie',
  icon: 'book-open',
  route: '/pedagogy',
  portals: [
    PortalType.school,
    PortalType.teacher,
  ],
  subTabs: [
    SubTab(id: 'pedagogy-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/pedagogy/dashboard'),
    SubTab(id: 'pedagogy-planning', label: 'Progression', icon: 'calendar', route: '/pedagogy/planning'),
    SubTab(id: 'pedagogy-lessons', label: 'Leçons', icon: 'book-open', route: '/pedagogy/lessons'),
    SubTab(id: 'pedagogy-homework', label: 'Devoirs', icon: 'pencil', route: '/pedagogy/homework'),
    SubTab(id: 'pedagogy-resources', label: 'Ressources', icon: 'folder-open', route: '/pedagogy/resources'),
    SubTab(id: 'pedagogy-evaluations', label: 'Évaluations', icon: 'check-square', route: '/pedagogy/evaluations'),
    SubTab(id: 'pedagogy-competencies', label: 'Compétences', icon: 'target', route: '/pedagogy/competencies'),
    SubTab(id: 'pedagogy-projects', label: 'Projets', icon: 'lightbulb', route: '/pedagogy/projects'),
    SubTab(id: 'pedagogy-differentiation', label: 'Différenciation', icon: 'layers', route: '/pedagogy/differentiation'),
    SubTab(id: 'pedagogy-progress', label: 'Suivi', icon: 'trending-up', route: '/pedagogy/progress'),
    SubTab(id: 'pedagogy-reports', label: 'Rapports', icon: 'bar-chart', route: '/pedagogy/reports'),
    SubTab(id: 'pedagogy-archive', label: 'Archive', icon: 'archive', route: '/pedagogy/archive'),
    SubTab(id: 'pedagogy-orion', label: 'Orion', icon: 'sparkles', route: '/pedagogy/orion'),
  ],
);

/// Schedule / Timetable module — teacher and parent portals.
const scheduleModule = ModuleConfig(
  id: 'schedule',
  label: 'Emploi du temps',
  icon: 'calendar-days',
  route: '/schedule',
  portals: [
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'weekly', label: 'Semaine', icon: 'calendar', route: '/schedule/weekly'),
    SubTab(id: 'daily', label: 'Jour', icon: 'calendar-check', route: '/schedule/daily'),
  ],
);

/// Messages / Communication module — school, teacher, parent portals.
const messagesModule = ModuleConfig(
  id: 'messages',
  label: 'Messages',
  icon: 'message-circle',
  route: '/messages',
  portals: [
    PortalType.school,
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'inbox', label: 'Boîte de réception', icon: 'inbox', route: '/messages/inbox'),
    SubTab(id: 'sent', label: 'Envoyés', icon: 'send', route: '/messages/sent'),
    SubTab(id: 'notices', label: 'Avis', icon: 'megaphone', route: '/messages/notices'),
  ],
);

/// Exams module — school and teacher portals.
const examsModule = ModuleConfig(
  id: 'exams',
  label: 'Examens',
  icon: 'clipboard-list',
  route: '/exams',
  portals: [
    PortalType.school,
    PortalType.teacher,
  ],
  subTabs: [
    SubTab(id: 'exams-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/exams/dashboard'),
    SubTab(id: 'exams-schedule', label: 'Planning', icon: 'calendar', route: '/exams/schedule'),
    SubTab(id: 'exams-results', label: 'Résultats', icon: 'bar-chart', route: '/exams/results'),
    SubTab(id: 'exams-statistics', label: 'Statistiques', icon: 'trending-up', route: '/exams/statistics'),
    SubTab(id: 'exams-deliberations', label: 'Délibérations', icon: 'gavel', route: '/exams/deliberations'),
    SubTab(id: 'exams-rankings', label: 'Classements', icon: 'trophy', route: '/exams/rankings'),
    SubTab(id: 'exams-certificates', label: 'Certificats', icon: 'award', route: '/exams/certificates'),
    SubTab(id: 'exams-appeals', label: 'Recours', icon: 'message-square', route: '/exams/appeals'),
    SubTab(id: 'exams-rooms', label: 'Salles', icon: 'door-open', route: '/exams/rooms'),
    SubTab(id: 'exams-supervision', label: 'Surveillance', icon: 'eye', route: '/exams/supervision'),
    SubTab(id: 'exams-archive', label: 'Archive', icon: 'archive', route: '/exams/archive'),
    SubTab(id: 'exams-orion', label: 'Orion', icon: 'sparkles', route: '/exams/orion'),
  ],
);

/// Absences module — school, teacher, parent portals.
const absencesModule = ModuleConfig(
  id: 'absences',
  label: 'Absences',
  icon: 'user-x',
  route: '/absences',
  portals: [
    PortalType.school,
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'list', label: 'Liste', icon: 'list', route: '/absences/list'),
    SubTab(id: 'stats', label: 'Statistiques', icon: 'pie-chart', route: '/absences/stats'),
  ],
);

/// HR module — school portal only.
const hrModule = ModuleConfig(
  id: 'hr',
  label: 'Ressources Humaines',
  icon: 'briefcase',
  route: '/hr',
  portals: [
    PortalType.school,
  ],
  subTabs: [
    SubTab(id: 'hr-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/hr/dashboard'),
    SubTab(id: 'hr-staff', label: 'Personnel', icon: 'users', route: '/hr/staff'),
    SubTab(id: 'hr-recruitment', label: 'Recrutement', icon: 'user-plus', route: '/hr/recruitment'),
    SubTab(id: 'hr-contracts', label: 'Contrats', icon: 'file-text', route: '/hr/contracts'),
    SubTab(id: 'hr-payroll', label: 'Paie', icon: 'banknote', route: '/hr/payroll'),
    SubTab(id: 'hr-leave', label: 'Congés', icon: 'palmtree', route: '/hr/leave'),
    SubTab(id: 'hr-training', label: 'Formation', icon: 'book-open', route: '/hr/training'),
    SubTab(id: 'hr-evaluations', label: 'Évaluations', icon: 'star', route: '/hr/evaluations'),
    SubTab(id: 'hr-discipline', label: 'Discipline', icon: 'shield', route: '/hr/discipline'),
    SubTab(id: 'hr-documents', label: 'Documents', icon: 'folder', route: '/hr/documents'),
    SubTab(id: 'hr-orgchart', label: 'Organigramme', icon: 'network', route: '/hr/orgchart'),
    SubTab(id: 'hr-policies', label: 'Politiques', icon: 'scroll', route: '/hr/policies'),
    SubTab(id: 'hr-reports', label: 'Rapports', icon: 'bar-chart', route: '/hr/reports'),
    SubTab(id: 'hr-settings', label: 'Paramètres', icon: 'settings', route: '/hr/settings'),
    SubTab(id: 'hr-orion', label: 'Orion', icon: 'sparkles', route: '/hr/orion'),
  ],
);

/// Settings module — school and platform portals.
const settingsModule = ModuleConfig(
  id: 'settings',
  label: 'Paramètres',
  icon: 'settings',
  route: '/settings',
  portals: [
    PortalType.platform,
    PortalType.school,
  ],
  subTabs: [
    SubTab(id: 'settings-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/settings/dashboard'),
    SubTab(id: 'settings-general', label: 'Général', icon: 'settings', route: '/settings/general'),
    SubTab(id: 'settings-academic-year', label: 'Année scolaire', icon: 'calendar', route: '/settings/academic-year'),
    SubTab(id: 'settings-classes', label: 'Classes', icon: 'layout-grid', route: '/settings/classes'),
    SubTab(id: 'settings-subjects', label: 'Matières', icon: 'book', route: '/settings/subjects'),
    SubTab(id: 'settings-periods', label: 'Périodes', icon: 'clock', route: '/settings/periods'),
    SubTab(id: 'settings-grading', label: 'Notation', icon: 'hash', route: '/settings/grading'),
    SubTab(id: 'settings-rooms', label: 'Salles', icon: 'door-open', route: '/settings/rooms'),
    SubTab(id: 'settings-roles', label: 'Rôles', icon: 'shield', route: '/settings/roles'),
    SubTab(id: 'settings-permissions', label: 'Permissions', icon: 'lock', route: '/settings/permissions'),
    SubTab(id: 'settings-features', label: 'Fonctionnalités', icon: 'toggle-right', route: '/settings/features'),
    SubTab(id: 'settings-import', label: 'Import', icon: 'upload', route: '/settings/import'),
    SubTab(id: 'settings-export', label: 'Export', icon: 'download', route: '/settings/export'),
    SubTab(id: 'settings-backup', label: 'Sauvegarde', icon: 'hard-drive', route: '/settings/backup'),
    SubTab(id: 'settings-advanced', label: 'Avancé', icon: 'wrench', route: '/settings/advanced'),
  ],
);

/// Platform admin module — platform portal only.
const platformModule = ModuleConfig(
  id: 'platform',
  label: 'Administration Plateforme',
  icon: 'shield',
  route: '/platform',
  portals: [
    PortalType.platform,
  ],
  subTabs: [
    SubTab(id: 'platform-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/platform/dashboard'),
    SubTab(id: 'platform-tenants', label: 'Établissements', icon: 'building', route: '/platform/tenants'),
    SubTab(id: 'platform-billing', label: 'Facturation', icon: 'credit-card', route: '/platform/billing'),
    SubTab(id: 'platform-audit', label: 'Audit', icon: 'shield-check', route: '/platform/audit'),
    SubTab(id: 'platform-users', label: 'Utilisateurs', icon: 'users', route: '/platform/users'),
    SubTab(id: 'platform-roles', label: 'Rôles', icon: 'shield', route: '/platform/roles'),
    SubTab(id: 'platform-features', label: 'Fonctionnalités', icon: 'toggle-right', route: '/platform/features'),
    SubTab(id: 'platform-licenses', label: 'Licences', icon: 'key', route: '/platform/licenses'),
    SubTab(id: 'platform-analytics', label: 'Analytique', icon: 'bar-chart', route: '/platform/analytics'),
    SubTab(id: 'platform-support', label: 'Support', icon: 'headphones', route: '/platform/support'),
    SubTab(id: 'platform-logs', label: 'Journaux', icon: 'file-text', route: '/platform/logs'),
    SubTab(id: 'platform-backups', label: 'Sauvegardes', icon: 'hard-drive', route: '/platform/backups'),
    SubTab(id: 'platform-integrations', label: 'Intégrations', icon: 'device_hub', route: '/platform/integrations'),
    SubTab(id: 'platform-api', label: 'API', icon: 'code', route: '/platform/api'),
    SubTab(id: 'platform-notifications', label: 'Notifications', icon: 'bell', route: '/platform/notifications'),
    SubTab(id: 'platform-settings', label: 'Paramètres', icon: 'settings', route: '/platform/settings'),
  ],
);

/// Profile module — all authenticated portals.
const profileModule = ModuleConfig(
  id: 'profile',
  label: 'Profil',
  icon: 'user',
  route: '/profile',
  portals: [
    PortalType.platform,
    PortalType.school,
    PortalType.teacher,
    PortalType.parent,
  ],
  subTabs: [
    SubTab(id: 'info', label: 'Informations', icon: 'user', route: '/profile/info'),
    SubTab(id: 'notifications', label: 'Notifications', icon: 'bell', route: '/profile/notifications'),
  ],
);

/// Orion AI module — school portal only.
const orionModule = ModuleConfig(
  id: 'orion',
  label: 'Orion IA',
  icon: 'brain',
  route: '/orion',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'orion-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/orion/dashboard'),
    SubTab(id: 'orion-analysis', label: 'Analyses', icon: 'bar-chart', route: '/orion/analysis'),
    SubTab(id: 'orion-predictions', label: 'Prédictions', icon: 'trending-up', route: '/orion/predictions'),
    SubTab(id: 'orion-reports', label: 'Rapports', icon: 'file-text', route: '/orion/reports'),
    SubTab(id: 'orion-settings', label: 'Configuration', icon: 'settings', route: '/orion/settings'),
  ],
);

/// Meetings module — school portal only.
const meetingsModule = ModuleConfig(
  id: 'meetings',
  label: 'Réunions',
  icon: 'users',
  route: '/meetings',
  portals: [PortalType.school, PortalType.teacher],
  subTabs: [
    SubTab(id: 'meetings-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/meetings/dashboard'),
    SubTab(id: 'meetings-schedule', label: 'Planification', icon: 'calendar', route: '/meetings/schedule'),
    SubTab(id: 'meetings-minutes', label: 'Procès-verbaux', icon: 'file-text', route: '/meetings/minutes'),
    SubTab(id: 'meetings-decisions', label: 'Décisions', icon: 'check-circle', route: '/meetings/decisions'),
    SubTab(id: 'meetings-documents', label: 'Documents', icon: 'folder', route: '/meetings/documents'),
  ],
);

/// Communication module — school, teacher, parent portals.
const communicationModule = ModuleConfig(
  id: 'communication',
  label: 'Communication',
  icon: 'megaphone',
  route: '/communication',
  portals: [PortalType.school, PortalType.teacher, PortalType.parent],
  subTabs: [
    SubTab(id: 'communication-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/communication/dashboard'),
    SubTab(id: 'communication-inbox', label: 'Réception', icon: 'inbox', route: '/communication/inbox'),
    SubTab(id: 'communication-sent', label: 'Envoyés', icon: 'send', route: '/communication/sent'),
    SubTab(id: 'communication-announcements', label: 'Annonces', icon: 'megaphone', route: '/communication/announcements'),
    SubTab(id: 'communication-notifications', label: 'Notifications', icon: 'bell', route: '/communication/notifications'),
    SubTab(id: 'communication-newsletter', label: 'Newsletter', icon: 'newspaper', route: '/communication/newsletter'),
    SubTab(id: 'communication-sms', label: 'SMS', icon: 'smartphone', route: '/communication/sms'),
    SubTab(id: 'communication-email', label: 'E-mail', icon: 'mail', route: '/communication/email'),
    SubTab(id: 'communication-push', label: 'Push', icon: 'notifications_active', route: '/communication/push'),
    SubTab(id: 'communication-templates', label: 'Modèles', icon: 'layout-template', route: '/communication/templates'),
    SubTab(id: 'communication-contacts', label: 'Contacts', icon: 'address-book', route: '/communication/contacts'),
    SubTab(id: 'communication-groups', label: 'Groupes', icon: 'users', route: '/communication/groups'),
    SubTab(id: 'communication-calendar', label: 'Calendrier', icon: 'calendar', route: '/communication/calendar'),
    SubTab(id: 'communication-media', label: 'Médias', icon: 'image', route: '/communication/media'),
    SubTab(id: 'communication-settings', label: 'Paramètres', icon: 'settings', route: '/communication/settings'),
    SubTab(id: 'communication-orion', label: 'Orion', icon: 'sparkles', route: '/communication/orion'),
  ],
);

/// Aggregation module — school portal only.
const aggregationModule = ModuleConfig(
  id: 'aggregation',
  label: 'Agrégation',
  icon: 'database',
  route: '/aggregation',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'aggregation-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/aggregation/dashboard'),
    SubTab(id: 'aggregation-data', label: 'Données', icon: 'database', route: '/aggregation/data'),
    SubTab(id: 'aggregation-reports', label: 'Rapports', icon: 'bar-chart', route: '/aggregation/reports'),
  ],
);

/// General / Direction module — school portal only.
const generalModule = ModuleConfig(
  id: 'general',
  label: 'Direction',
  icon: 'building',
  route: '/general',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'general-direction', label: 'Direction', icon: 'building', route: '/general/direction'),
  ],
);

/// Library module — school portal only.
const libraryModule = ModuleConfig(
  id: 'library',
  label: 'Bibliothèque',
  icon: 'book-open',
  route: '/library',
  portals: [PortalType.school, PortalType.teacher],
  subTabs: [
    SubTab(id: 'library-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/library/dashboard'),
    SubTab(id: 'library-catalog', label: 'Catalogue', icon: 'book', route: '/library/catalog'),
    SubTab(id: 'library-borrowings', label: 'Emprunts', icon: 'log-out', route: '/library/borrowings'),
    SubTab(id: 'library-returns', label: 'Retours', icon: 'log-in', route: '/library/returns'),
    SubTab(id: 'library-reservations', label: 'Réservations', icon: 'bookmark', route: '/library/reservations'),
    SubTab(id: 'library-fines', label: 'Amendes', icon: 'alert-circle', route: '/library/fines'),
    SubTab(id: 'library-acquisition', label: 'Acquisition', icon: 'shopping-cart', route: '/library/acquisition'),
    SubTab(id: 'library-inventory', label: 'Inventaire', icon: 'clipboard-list', route: '/library/inventory'),
    SubTab(id: 'library-digital', label: 'Numérique', icon: 'monitor', route: '/library/digital'),
    SubTab(id: 'library-statistics', label: 'Statistiques', icon: 'trending-up', route: '/library/statistics'),
    SubTab(id: 'library-members', label: 'Membres', icon: 'users', route: '/library/members'),
    SubTab(id: 'library-reports', label: 'Rapports', icon: 'bar-chart', route: '/library/reports'),
    SubTab(id: 'library-settings', label: 'Paramètres', icon: 'settings', route: '/library/settings'),
  ],
);

/// Transport module — school portal only.
const transportModule = ModuleConfig(
  id: 'transport',
  label: 'Transport',
  icon: 'bus',
  route: '/transport',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'transport-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/transport/dashboard'),
    SubTab(id: 'transport-routes', label: 'Trajets', icon: 'alt_route', route: '/transport/routes'),
    SubTab(id: 'transport-vehicles', label: 'Véhicules', icon: 'bus', route: '/transport/vehicles'),
    SubTab(id: 'transport-drivers', label: 'Chauffeurs', icon: 'user', route: '/transport/drivers'),
    SubTab(id: 'transport-students', label: 'Élèves', icon: 'users', route: '/transport/students'),
    SubTab(id: 'transport-tracking', label: 'Suivi', icon: 'map-pin', route: '/transport/tracking'),
    SubTab(id: 'transport-maintenance', label: 'Maintenance', icon: 'wrench', route: '/transport/maintenance'),
    SubTab(id: 'transport-insurance', label: 'Assurance', icon: 'shield', route: '/transport/insurance'),
    SubTab(id: 'transport-fuel', label: 'Carburant', icon: 'fuel', route: '/transport/fuel'),
    SubTab(id: 'transport-incidents', label: 'Incidents', icon: 'alert-triangle', route: '/transport/incidents'),
    SubTab(id: 'transport-contracts', label: 'Contrats', icon: 'file-text', route: '/transport/contracts'),
    SubTab(id: 'transport-payments', label: 'Paiements', icon: 'credit-card', route: '/transport/payments'),
    SubTab(id: 'transport-reports', label: 'Rapports', icon: 'bar-chart', route: '/transport/reports'),
    SubTab(id: 'transport-settings', label: 'Paramètres', icon: 'settings', route: '/transport/settings'),
  ],
);

/// Canteen module — school portal only.
const canteenModule = ModuleConfig(
  id: 'canteen',
  label: 'Cantine',
  icon: 'utensils',
  route: '/canteen',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'canteen-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/canteen/dashboard'),
    SubTab(id: 'canteen-menus', label: 'Menus', icon: 'utensils', route: '/canteen/menus'),
    SubTab(id: 'canteen-meals', label: 'Repas', icon: 'coffee', route: '/canteen/meals'),
    SubTab(id: 'canteen-reservations', label: 'Réservations', icon: 'bookmark', route: '/canteen/reservations'),
    SubTab(id: 'canteen-payments', label: 'Paiements', icon: 'credit-card', route: '/canteen/payments'),
    SubTab(id: 'canteen-stock', label: 'Stock', icon: 'package', route: '/canteen/stock'),
    SubTab(id: 'canteen-suppliers', label: 'Fournisseurs', icon: 'truck', route: '/canteen/suppliers'),
    SubTab(id: 'canteen-allergens', label: 'Allergènes', icon: 'alert-circle', route: '/canteen/allergens'),
    SubTab(id: 'canteen-statistics', label: 'Statistiques', icon: 'trending-up', route: '/canteen/statistics'),
    SubTab(id: 'canteen-reports', label: 'Rapports', icon: 'bar-chart', route: '/canteen/reports'),
    SubTab(id: 'canteen-feedback', label: 'Avis', icon: 'message-circle', route: '/canteen/feedback'),
    SubTab(id: 'canteen-settings', label: 'Paramètres', icon: 'settings', route: '/canteen/settings'),
  ],
);

/// Infirmary module — school portal only.
const infirmaryModule = ModuleConfig(
  id: 'infirmary',
  label: 'Infirmerie',
  icon: 'heart-pulse',
  route: '/infirmary',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'infirmary-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/infirmary/dashboard'),
    SubTab(id: 'infirmary-records', label: 'Dossiers', icon: 'folder', route: '/infirmary/records'),
    SubTab(id: 'infirmary-visits', label: 'Visites', icon: 'stethoscope', route: '/infirmary/visits'),
    SubTab(id: 'infirmary-medications', label: 'Médicaments', icon: 'pill', route: '/infirmary/medications'),
    SubTab(id: 'infirmary-allergies', label: 'Allergies', icon: 'alert-circle', route: '/infirmary/allergies'),
    SubTab(id: 'infirmary-vaccinations', label: 'Vaccinations', icon: 'syringe', route: '/infirmary/vaccinations'),
    SubTab(id: 'infirmary-emergencies', label: 'Urgences', icon: 'alert-triangle', route: '/infirmary/emergencies'),
    SubTab(id: 'infirmary-reports', label: 'Rapports', icon: 'bar-chart', route: '/infirmary/reports'),
    SubTab(id: 'infirmary-stock', label: 'Stock', icon: 'package', route: '/infirmary/stock'),
    SubTab(id: 'infirmary-settings', label: 'Paramètres', icon: 'settings', route: '/infirmary/settings'),
  ],
);

/// QHSE module — school portal only.
const qhseModule = ModuleConfig(
  id: 'qhse',
  label: 'QHSE',
  icon: 'shield-check',
  route: '/qhse',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'qhse-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/qhse/dashboard'),
    SubTab(id: 'qhse-risks', label: 'Risques', icon: 'alert-triangle', route: '/qhse/risks'),
    SubTab(id: 'qhse-inspections', label: 'Inspections', icon: 'search', route: '/qhse/inspections'),
    SubTab(id: 'qhse-incidents', label: 'Incidents', icon: 'alert-octagon', route: '/qhse/incidents'),
    SubTab(id: 'qhse-actions', label: 'Actions', icon: 'check-circle', route: '/qhse/actions'),
    SubTab(id: 'qhse-audits', label: 'Audits', icon: 'shield-check', route: '/qhse/audits'),
    SubTab(id: 'qhse-documents', label: 'Documents', icon: 'folder', route: '/qhse/documents'),
    SubTab(id: 'qhse-training', label: 'Formation', icon: 'book-open', route: '/qhse/training'),
    SubTab(id: 'qhse-regulations', label: 'Réglementation', icon: 'scroll', route: '/qhse/regulations'),
    SubTab(id: 'qhse-indicators', label: 'Indicateurs', icon: 'trending-up', route: '/qhse/indicators'),
    SubTab(id: 'qhse-nonconformities', label: 'Non-conformités', icon: 'x-circle', route: '/qhse/nonconformities'),
    SubTab(id: 'qhse-permits', label: 'Permis', icon: 'file-badge', route: '/qhse/permits'),
    SubTab(id: 'qhse-reports', label: 'Rapports', icon: 'bar-chart', route: '/qhse/reports'),
    SubTab(id: 'qhse-settings', label: 'Paramètres', icon: 'settings', route: '/qhse/settings'),
  ],
);

/// Educast module — school, teacher, parent portals.
const educastModule = ModuleConfig(
  id: 'educast',
  label: 'EduCast',
  icon: 'play-circle',
  route: '/educast',
  portals: [PortalType.school, PortalType.teacher, PortalType.parent],
  subTabs: [
    SubTab(id: 'educast-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/educast/dashboard'),
    SubTab(id: 'educast-channels', label: 'Chaînes', icon: 'tv', route: '/educast/channels'),
    SubTab(id: 'educast-courses', label: 'Cours', icon: 'book-open', route: '/educast/courses'),
    SubTab(id: 'educast-videos', label: 'Vidéos', icon: 'video', route: '/educast/videos'),
    SubTab(id: 'educast-podcasts', label: 'Podcasts', icon: 'headphones', route: '/educast/podcasts'),
    SubTab(id: 'educast-live', label: 'En direct', icon: 'radio', route: '/educast/live'),
    SubTab(id: 'educast-playlists', label: 'Playlists', icon: 'list', route: '/educast/playlists'),
    SubTab(id: 'educast-categories', label: 'Catégories', icon: 'grid', route: '/educast/categories'),
    SubTab(id: 'educast-analytics', label: 'Analytique', icon: 'trending-up', route: '/educast/analytics'),
    SubTab(id: 'educast-comments', label: 'Commentaires', icon: 'message-circle', route: '/educast/comments'),
    SubTab(id: 'educast-ratings', label: 'Évaluations', icon: 'star', route: '/educast/ratings'),
    SubTab(id: 'educast-bookmarks', label: 'Favoris', icon: 'bookmark', route: '/educast/bookmarks'),
    SubTab(id: 'educast-history', label: 'Historique', icon: 'clock', route: '/educast/history'),
    SubTab(id: 'educast-downloads', label: 'Téléchargements', icon: 'download', route: '/educast/downloads'),
    SubTab(id: 'educast-subscriptions', label: 'Abonnements', icon: 'credit-card', route: '/educast/subscriptions'),
    SubTab(id: 'educast-reports', label: 'Rapports', icon: 'bar-chart', route: '/educast/reports'),
    SubTab(id: 'educast-settings', label: 'Paramètres', icon: 'settings', route: '/educast/settings'),
  ],
);

/// Shop module — school, parent portals.
const shopModule = ModuleConfig(
  id: 'shop',
  label: 'Boutique',
  icon: 'shopping-bag',
  route: '/shop',
  portals: [PortalType.school, PortalType.parent],
  subTabs: [
    SubTab(id: 'shop-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/shop/dashboard'),
    SubTab(id: 'shop-products', label: 'Produits', icon: 'package', route: '/shop/products'),
    SubTab(id: 'shop-orders', label: 'Commandes', icon: 'shopping-cart', route: '/shop/orders'),
    SubTab(id: 'shop-payments', label: 'Paiements', icon: 'credit-card', route: '/shop/payments'),
    SubTab(id: 'shop-deliveries', label: 'Livraisons', icon: 'truck', route: '/shop/deliveries'),
    SubTab(id: 'shop-returns', label: 'Retours', icon: 'rotate-ccw', route: '/shop/returns'),
    SubTab(id: 'shop-categories', label: 'Catégories', icon: 'grid', route: '/shop/categories'),
    SubTab(id: 'shop-inventory', label: 'Inventaire', icon: 'clipboard-list', route: '/shop/inventory'),
    SubTab(id: 'shop-suppliers', label: 'Fournisseurs', icon: 'truck', route: '/shop/suppliers'),
    SubTab(id: 'shop-promotions', label: 'Promotions', icon: 'percent', route: '/shop/promotions'),
    SubTab(id: 'shop-coupons', label: 'Coupons', icon: 'ticket', route: '/shop/coupons'),
    SubTab(id: 'shop-reviews', label: 'Avis', icon: 'star', route: '/shop/reviews'),
    SubTab(id: 'shop-reports', label: 'Rapports', icon: 'bar-chart', route: '/shop/reports'),
    SubTab(id: 'shop-settings', label: 'Paramètres', icon: 'settings', route: '/shop/settings'),
  ],
);

// ─── All Modules ─────────────────────────────────────────────────────────────

/// Complete list of all module configurations.
final List<ModuleConfig> allModules = [
  dashboardModule,
  platformModule,
  studentsModule,
  gradesModule,
  financeModule,
  pedagogyModule,
  scheduleModule,
  messagesModule,
  examsModule,
  absencesModule,
  hrModule,
  settingsModule,
  profileModule,
  orionModule,
  meetingsModule,
  communicationModule,
  aggregationModule,
  generalModule,
  libraryModule,
  transportModule,
  canteenModule,
  infirmaryModule,
  qhseModule,
  educastModule,
  shopModule,
];

// ─── Visibility Helpers ──────────────────────────────────────────────────────

/// Returns the list of modules visible for a given portal.
List<ModuleConfig> getVisibleModules(PortalType portal) {
  switch (portal) {
    case PortalType.platform:
      return [
        dashboardModule,
        platformModule,
        studentsModule,
        gradesModule,
        financeModule,
        pedagogyModule,
        messagesModule,
        examsModule,
        absencesModule,
        hrModule,
        settingsModule,
        profileModule,
      ];

    case PortalType.school:
      return [
        dashboardModule,
        studentsModule,
        gradesModule,
        financeModule,
        pedagogyModule,
        messagesModule,
        examsModule,
        absencesModule,
        hrModule,
        settingsModule,
        profileModule,
      ];

    case PortalType.teacher:
      return [
        dashboardModule,
        studentsModule,
        gradesModule,
        pedagogyModule,
        scheduleModule,
        messagesModule,
        examsModule,
        absencesModule,
        profileModule,
      ];

    case PortalType.parent:
      return [
        dashboardModule,
        studentsModule,
        gradesModule,
        financeModule,
        scheduleModule,
        messagesModule,
        absencesModule,
        profileModule,
      ];

    case PortalType.public:
      return [];
  }
}

/// Returns the list of modules visible for a given user role.
List<ModuleConfig> getVisibleModulesForRole(UserRole role) {
  return getVisibleModules(role.portal);
}

// ─── Feature Code Mapping ────────────────────────────────────────────────────

/// Maps module IDs to their known feature codes from the backend.
/// This is used as a fallback when the remote config doesn't specify
/// feature codes explicitly.
const moduleFeatureCodeMap = <String, String>{
  'finance': 'FINANCE',
  'messages': 'MESSAGING',
  'grades': 'GRADES',
  'pedagogy': 'PEDAGOGY',
  'schedule': 'SCHEDULE',
  'exams': 'EXAMS',
  'absences': 'ATTENDANCE',
  'hr': 'HR',
};

/// Returns the feature code for a given module ID, or null if none.
String? getFeatureCodeForModule(String moduleId) =>
    moduleFeatureCodeMap[moduleId];

// ─── Remote Config Merge ─────────────────────────────────────────────────────

/// Merges the hardcoded [allModules] with the remote configuration from the API.
///
/// This function is the core of the dynamic synchronization system.
/// It ensures that when the web app changes modules, features, or settings,
/// the mobile app automatically reflects those changes without requiring
/// a code update.
///
/// Merge rules:
///   1. Remote modules override local visibility, labels, icons, and sub-tabs
///   2. New modules from remote that don't exist locally are created dynamically
///   3. Modules hidden in remote config (empty portals) are excluded
///   4. Modules gated by a feature code are excluded if the feature is disabled
///   5. Modules not present in remote config are kept as-is (graceful fallback)
///   6. Module ordering follows the remote config if specified
///
/// Parameters:
///   - [remoteModules]: Modules from the remote API response
///   - [enabledFeatureCodes]: Set of currently enabled feature codes
///   - [portal]: The current user's portal type
///   - [roleCodes]: The current user's role codes for visibility filtering
///
/// Returns a merged list of [ModuleConfig] ready for the UI.
List<ModuleConfig> mergeWithRemoteConfig({
  required List<ModuleConfig> localModules,
  required List<dynamic> remoteModules,
  required Set<String> enabledFeatureCodes,
  required PortalType portal,
  required List<String> roleCodes,
}) {
  final result = <ModuleConfig>[];
  final processedIds = <String>{};

  // Parse remote modules into a map for easy lookup
  final remoteMap = <String, Map<String, dynamic>>{};
  for (final raw in remoteModules) {
    if (raw is Map<String, dynamic>) {
      final id = raw['id'] as String? ?? '';
      if (id.isNotEmpty) remoteMap[id] = raw;
    }
  }

  // Step 1: Process remote modules (they take priority)
  for (final entry in remoteMap.entries) {
    final remoteId = entry.key;
    final remoteData = entry.value;

    // Check portal visibility from remote data
    final remotePortals = (remoteData['portals'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    if (remotePortals.isNotEmpty &&
        !remotePortals.any((p) => p.toLowerCase() == portal.name.toLowerCase())) {
      // Module is not visible in the current portal — mark as processed
      // so it's excluded from local fallback too
      processedIds.add(remoteId);
      continue;
    }

    // Check feature flag
    final featureCode = remoteData['featureCode'] as String?;
    if (featureCode != null &&
        featureCode.isNotEmpty &&
        !enabledFeatureCodes.contains(featureCode)) {
      processedIds.add(remoteId);
      continue;
    }

    // Check role visibility
    final visibleToRoles = (remoteData['visibleToRoles'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    if (visibleToRoles.isNotEmpty &&
        !visibleToRoles.any((r) => roleCodes.contains(r) ||
            roleCodes.any((rc) => rc.toLowerCase() == r.toLowerCase()))) {
      processedIds.add(remoteId);
      continue;
    }

    // Find matching local module
    final localMatch = localModules.where((m) => m.id == remoteId).firstOrNull;

    if (localMatch != null) {
      // Merge: remote overrides local values
      final remoteSubTabs = _parseRemoteSubTabs(
        remoteData['subTabs'] as List<dynamic>? ?? [],
        enabledFeatureCodes,
      );
      final mergedPortals = remotePortals.isNotEmpty
          ? _parsePortalTypes(remotePortals)
          : localMatch.portals;

      result.add(localMatch.copyWith(
        label: (remoteData['label'] as String?)?.isNotEmpty == true
            ? remoteData['label'] as String
            : null,
        icon: (remoteData['icon'] as String?)?.isNotEmpty == true
            ? remoteData['icon'] as String
            : null,
        route: (remoteData['route'] as String?)?.isNotEmpty == true
            ? remoteData['route'] as String
            : null,
        portals: mergedPortals,
        subTabs: remoteSubTabs.isNotEmpty ? remoteSubTabs : null,
        featureCode: featureCode,
      ));
    } else {
      // New module from remote — create dynamically
      final remoteSubTabs = _parseRemoteSubTabs(
        remoteData['subTabs'] as List<dynamic>? ?? [],
        enabledFeatureCodes,
      );
      final dynamicModule = ModuleConfig(
        id: remoteId,
        label: remoteData['label'] as String? ?? remoteId,
        icon: remoteData['icon'] as String? ?? 'circle',
        route: remoteData['route'] as String? ?? '/$remoteId',
        portals: _parsePortalTypes(remotePortals),
        subTabs: remoteSubTabs,
        featureCode: featureCode,
      );
      result.add(dynamicModule);
    }

    processedIds.add(remoteId);
  }

  // Step 2: Add local modules that weren't in the remote config
  for (final localModule in localModules) {
    if (processedIds.contains(localModule.id)) continue;
    if (!localModule.isVisibleFor(portal)) continue;

    // Check if the module is gated by a feature code
    final fc = localModule.featureCode ?? getFeatureCodeForModule(localModule.id);
    if (fc != null && !enabledFeatureCodes.contains(fc)) continue;

    result.add(localModule);
  }

  return result;
}

// ─── Merge Helper Functions ──────────────────────────────────────────────────

/// Parses remote sub-tab data into SubTab objects, filtering by feature flags.
List<SubTab> _parseRemoteSubTabs(
  List<dynamic> rawSubTabs,
  Set<String> enabledFeatureCodes,
) {
  final result = <SubTab>[];
  for (final raw in rawSubTabs) {
    if (raw is! Map<String, dynamic>) continue;

    final featureCode = raw['featureCode'] as String?;
    if (featureCode != null &&
        featureCode.isNotEmpty &&
        !enabledFeatureCodes.contains(featureCode)) {
      continue;
    }

    result.add(SubTab(
      id: raw['id'] as String? ?? '',
      label: raw['label'] as String? ?? '',
      icon: raw['icon'] as String? ?? 'circle',
      route: raw['route'] as String? ?? '',
    ));
  }
  return result;
}

/// Parses a list of portal name strings into PortalType enums.
List<PortalType> _parsePortalTypes(List<String> portalNames) {
  return portalNames.map((name) {
    switch (name.toLowerCase()) {
      case 'platform':
        return PortalType.platform;
      case 'school':
        return PortalType.school;
      case 'teacher':
        return PortalType.teacher;
      case 'parent':
        return PortalType.parent;
      case 'public':
        return PortalType.public;
      default:
        return PortalType.public;
    }
  }).toList();
}
