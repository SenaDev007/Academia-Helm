// ============================================================================
// MODULE CONFIGURATION — Academia Helm Mobile
// ============================================================================
//
// ALIGNED WITH WEB APP (PilotageSidebar.tsx + module layouts)
//
// Web modules (8 main + 3 supplementary visible):
//   1. Tableau de pilotage (/app)
//   2. Organisation Pédagogique (/app/pedagogy) — 11 sub-tabs
//   3. Élèves & Scolarité (/app/students) — 13 sub-tabs
//   4. Finances & Économat (/app/finance) — 13 sub-tabs
//   5. Examens, Notes & Bulletins (/app/exams) — 11 sub-tabs
//   6. Personnel, RH & Paie (/app/hr) — 18 sub-tabs
//   7. Communication (/app/communication) — 15 sub-tabs
//   8. Site Institutionnel (CMS) (/app/cms) — 21 sub-tabs
//   9. Cantine (/app/canteen) — 12 sub-tabs
//  10. EduCast (/app/educast) — 17 sub-tabs
//  11. Boutique (/app/shop) — 14 sub-tabs
//
// Hidden modules (commented out in web sidebar):
//   - Bibliothèque, Transport, Infirmerie, QHSE
//
// Mobile-only modules (not in web sidebar):
//   - ORION IA (embedded in dashboards on web, separate on mobile)
//   - Profil (via user menu on web, separate screen on mobile)
// ============================================================================

import 'user_role.dart' show PortalType;

/// Sub-tab configuration within a module.
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

/// Module configuration.
class ModuleConfig {
  final String id;
  final String label;
  final String icon;
  final String route;
  final List<PortalType> portals;
  final List<SubTab> subTabs;
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

  bool isVisibleFor(PortalType portal) => portals.contains(portal);
}

// ─── Module Definitions (ALIGNED WITH WEB) ───────────────────────────────

/// 1. Tableau de pilotage — Dashboard
const dashboardModule = ModuleConfig(
  id: 'dashboard',
  label: 'Tableau de pilotage',
  icon: 'layout-dashboard',
  route: '/dashboard',
  portals: [PortalType.platform, PortalType.school, PortalType.teacher, PortalType.parent],
);

/// 2. Organisation Pédagogique — 11 sub-tabs (web: pedagogy-tabs.tsx)
const pedagogyModule = ModuleConfig(
  id: 'pedagogy',
  label: 'Organisation Pédagogique',
  icon: 'book-open',
  route: '/pedagogy',
  portals: [PortalType.school, PortalType.teacher],
  subTabs: [
    SubTab(id: 'pedagogy-dashboard', label: 'Dashboard', icon: 'layout-dashboard', route: '/pedagogy'),
    SubTab(id: 'pedagogy-structure', label: 'Structure académique', icon: 'building-2', route: '/pedagogy'),
    SubTab(id: 'pedagogy-subjects', label: 'Matières & programmes', icon: 'book-open', route: '/pedagogy'),
    SubTab(id: 'pedagogy-teachers', label: 'Enseignants & Affectation', icon: 'users', route: '/pedagogy'),
    SubTab(id: 'pedagogy-timetables', label: 'Emploi du temps', icon: 'calendar-days', route: '/pedagogy'),
    SubTab(id: 'pedagogy-production', label: 'Espace Pédagogie', icon: 'edit', route: '/pedagogy'),
    SubTab(id: 'pedagogy-control', label: 'Validation Direction', icon: 'check-square', route: '/pedagogy'),
    SubTab(id: 'pedagogy-orion', label: 'Analytique ORION', icon: 'sparkles', route: '/pedagogy'),
    SubTab(id: 'pedagogy-tasks', label: 'Travaux & Suivi', icon: 'clipboard-list', route: '/pedagogy'),
    SubTab(id: 'pedagogy-sara', label: 'Sarah Compose (IA)', icon: 'brain', route: '/pedagogy'),
    SubTab(id: 'pedagogy-class-diaries', label: 'Cahiers de textes', icon: 'notebook-pen', route: '/pedagogy'),
  ],
);

/// 3. Élèves & Scolarité — 13 sub-tabs (web: StudentsModulePage.tsx)
const studentsModule = ModuleConfig(
  id: 'students',
  label: 'Élèves & Scolarité',
  icon: 'graduation-cap',
  route: '/students',
  portals: [PortalType.school, PortalType.teacher, PortalType.parent],
  subTabs: [
    SubTab(id: 'students-dashboard', label: 'Tableau de Bord', icon: 'layout-dashboard', route: '/students'),
    SubTab(id: 'students-admissions', label: 'Admissions', icon: 'user-plus', route: '/students'),
    SubTab(id: 'students-enrollments', label: 'Inscriptions', icon: 'file-text', route: '/students'),
    SubTab(id: 'students-assignments', label: 'Affectations & Mouvements', icon: 'shuffle', route: '/students'),
    SubTab(id: 'students-list', label: 'Liste des Élèves', icon: 'users', route: '/students'),
    SubTab(id: 'students-movements', label: 'Sorties & Abandons', icon: 'log-out', route: '/students'),
    SubTab(id: 'students-cards', label: 'Cartes Scolaires', icon: 'credit-card', route: '/students'),
    SubTab(id: 'students-dossiers', label: 'Dossiers Élèves', icon: 'folder-open', route: '/students'),
    SubTab(id: 'students-families', label: 'Familles', icon: 'users-round', route: '/students'),
    SubTab(id: 'students-transfers', label: 'Transferts & Mobilité', icon: 'arrow-left-right', route: '/students'),
    SubTab(id: 'students-history', label: 'Historique Scolaire', icon: 'history', route: '/students'),
    SubTab(id: 'students-educmaster', label: 'Educmaster', icon: 'graduation-cap', route: '/students'),
    SubTab(id: 'students-analytics', label: 'ORION, Stats & Audit', icon: 'sparkles', route: '/students'),
  ],
);

/// 4. Finances & Économat — 13 sub-tabs (web: finance/layout.tsx)
const financeModule = ModuleConfig(
  id: 'finance',
  label: 'Finances & Économat',
  icon: 'banknote',
  route: '/finance',
  portals: [PortalType.school, PortalType.parent],
  subTabs: [
    SubTab(id: 'finance-dashboard', label: 'Tableau de Bord', icon: 'layout-dashboard', route: '/finance'),
    SubTab(id: 'finance-fees', label: 'Configuration des frais', icon: 'settings', route: '/finance'),
    SubTab(id: 'finance-overrides', label: 'Personnalisations', icon: 'edit', route: '/finance'),
    SubTab(id: 'finance-accounts', label: 'Comptes élèves', icon: 'users', route: '/finance'),
    SubTab(id: 'finance-cash-registers', label: 'Multi-caisses', icon: 'cash', route: '/finance'),
    SubTab(id: 'finance-payments', label: 'Encaissements', icon: 'credit-card', route: '/finance'),
    SubTab(id: 'finance-collection-summary', label: 'Bilan des encaissements', icon: 'bar-chart', route: '/finance'),
    SubTab(id: 'finance-collection', label: 'Recouvrement & Arriérés', icon: 'alert-circle', route: '/finance'),
    SubTab(id: 'finance-expenses', label: 'Dépenses', icon: 'trending-down', route: '/finance'),
    SubTab(id: 'finance-treasury', label: 'Clôture & Trésorerie', icon: 'landmark', route: '/finance'),
    SubTab(id: 'finance-reports', label: 'Rapports financiers', icon: 'file-text', route: '/finance'),
    SubTab(id: 'finance-audit', label: 'Contrôle & Audit', icon: 'shield-check', route: '/finance'),
    SubTab(id: 'finance-settings', label: 'Paramétrage', icon: 'settings', route: '/finance'),
  ],
);

/// 5. Examens, Notes & Bulletins — 11 sub-tabs (web: exams/sub-modules.ts)
const examsModule = ModuleConfig(
  id: 'exams',
  label: 'Examens, Notes & Bulletins',
  icon: 'clipboard-list',
  route: '/exams',
  portals: [PortalType.school, PortalType.teacher],
  subTabs: [
    SubTab(id: 'exams-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/exams'),
    SubTab(id: 'exams-evaluations', label: 'Évaluations', icon: 'calendar', route: '/exams'),
    SubTab(id: 'exams-grades', label: 'Saisie des notes', icon: 'file-edit', route: '/exams'),
    SubTab(id: 'exams-validation', label: 'Validation', icon: 'check-square', route: '/exams'),
    SubTab(id: 'exams-unlock', label: 'Déverrouillage', icon: 'lock', route: '/exams'),
    SubTab(id: 'exams-registre', label: 'Registre des notes', icon: 'clipboard-list', route: '/exams'),
    SubTab(id: 'exams-bulletins', label: 'Bulletins', icon: 'file-text', route: '/exams'),
    SubTab(id: 'exams-councils', label: 'Conseils de classe', icon: 'users', route: '/exams'),
    SubTab(id: 'exams-analytics', label: 'Statistiques', icon: 'bar-chart', route: '/exams'),
    SubTab(id: 'exams-audit', label: 'Audit', icon: 'history', route: '/exams'),
    SubTab(id: 'exams-settings', label: 'Paramètres', icon: 'settings', route: '/exams'),
  ],
);

/// 6. Personnel, RH & Paie — 18 sub-tabs (web: hr/hr-tabs.ts)
const hrModule = ModuleConfig(
  id: 'hr',
  label: 'Personnel, RH & Paie',
  icon: 'briefcase',
  route: '/hr',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'hr-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/hr'),
    SubTab(id: 'hr-recruiter', label: 'Recruteur', icon: 'user-check', route: '/hr'),
    SubTab(id: 'hr-directors', label: 'Directeurs', icon: 'user-tie', route: '/hr'),
    SubTab(id: 'hr-recruitment', label: 'Recrutement', icon: 'user-plus', route: '/hr'),
    SubTab(id: 'hr-embauche', label: 'Embauche', icon: 'file-signature', route: '/hr'),
    SubTab(id: 'hr-staff', label: 'Personnel', icon: 'users', route: '/hr'),
    SubTab(id: 'hr-contract-config', label: 'Config. Contrats', icon: 'settings', route: '/hr'),
    SubTab(id: 'hr-contracts', label: 'Contrats', icon: 'file-text', route: '/hr'),
    SubTab(id: 'hr-collaborators', label: 'Collaborateurs', icon: 'users-round', route: '/hr'),
    SubTab(id: 'hr-ia', label: 'IA RH', icon: 'brain', route: '/hr'),
    SubTab(id: 'hr-leaves', label: 'Congés & Absences', icon: 'palmtree', route: '/hr'),
    SubTab(id: 'hr-attendance', label: 'Présences', icon: 'calendar-check', route: '/hr'),
    SubTab(id: 'hr-planning', label: 'Planning', icon: 'calendar-days', route: '/hr'),
    SubTab(id: 'hr-allowances', label: 'Indemnités', icon: 'coins', route: '/hr'),
    SubTab(id: 'hr-payroll', label: 'Paie', icon: 'banknote', route: '/hr'),
    SubTab(id: 'hr-cnss', label: 'Impôts & État Financier', icon: 'landmark', route: '/hr'),
    SubTab(id: 'hr-reporting', label: 'Rapports', icon: 'bar-chart', route: '/hr'),
    SubTab(id: 'hr-settings', label: 'Paramètres', icon: 'settings', route: '/hr'),
  ],
);

/// 7. Communication — 15 sub-tabs (web: communication/layout.tsx)
const communicationModule = ModuleConfig(
  id: 'communication',
  label: 'Communication',
  icon: 'megaphone',
  route: '/communication',
  portals: [PortalType.school, PortalType.teacher, PortalType.parent],
  subTabs: [
    SubTab(id: 'comm-dashboard', label: 'Pilotage', icon: 'layout-dashboard', route: '/communication'),
    SubTab(id: 'comm-inbox', label: 'Boîte de réception', icon: 'inbox', route: '/communication'),
    SubTab(id: 'comm-messages', label: 'Messagerie', icon: 'message-circle', route: '/communication'),
    SubTab(id: 'comm-announcements', label: 'Annonces', icon: 'megaphone', route: '/communication'),
    SubTab(id: 'comm-automated', label: 'Automatisations', icon: 'zap', route: '/communication'),
    SubTab(id: 'comm-campaigns', label: 'Campagnes', icon: 'send', route: '/communication'),
    SubTab(id: 'comm-templates', label: 'Templates', icon: 'layout-template', route: '/communication'),
    SubTab(id: 'comm-parents', label: 'Parents', icon: 'users', route: '/communication'),
    SubTab(id: 'comm-teachers', label: 'Enseignants', icon: 'graduation-cap', route: '/communication'),
    SubTab(id: 'comm-students', label: 'Élèves', icon: 'book', route: '/communication'),
    SubTab(id: 'comm-admin', label: 'Administration', icon: 'building', route: '/communication'),
    SubTab(id: 'comm-channels', label: 'Canaux', icon: 'radio', route: '/communication'),
    SubTab(id: 'comm-history', label: 'Historique', icon: 'history', route: '/communication'),
    SubTab(id: 'comm-reports', label: 'Rapports', icon: 'bar-chart', route: '/communication'),
    SubTab(id: 'comm-settings', label: 'Paramètres', icon: 'settings', route: '/communication'),
  ],
);

/// 8. Site Institutionnel (CMS) — 21 sub-tabs (web: CmsWorkspace.tsx)
const cmsModule = ModuleConfig(
  id: 'cms',
  label: 'Site Institutionnel',
  icon: 'globe',
  route: '/cms',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'cms-coordonnees', label: 'Coordonnées', icon: 'map-pin', route: '/cms'),
    SubTab(id: 'cms-couleurs', label: 'Couleurs', icon: 'palette', route: '/cms'),
    SubTab(id: 'cms-themes', label: 'Thèmes', icon: 'layers', route: '/cms'),
    SubTab(id: 'cms-composants', label: 'Composants', icon: 'puzzle', route: '/cms'),
    SubTab(id: 'cms-banniere', label: 'Bannière', icon: 'image', route: '/cms'),
    SubTab(id: 'cms-chiffres', label: 'Chiffres clés', icon: 'bar-chart', route: '/cms'),
    SubTab(id: 'cms-promoteur', label: 'Mot du Promoteur', icon: 'mic', route: '/cms'),
    SubTab(id: 'cms-directeur', label: 'Mot du Directeur', icon: 'mic', route: '/cms'),
    SubTab(id: 'cms-presentation', label: 'Présentation', icon: 'file-text', route: '/cms'),
    SubTab(id: 'cms-admissions', label: 'Admissions', icon: 'user-plus', route: '/cms'),
    SubTab(id: 'cms-vie', label: 'Vie scolaire', icon: 'school', route: '/cms'),
    SubTab(id: 'cms-actualites', label: 'Actualités', icon: 'newspaper', route: '/cms'),
    SubTab(id: 'cms-agenda', label: 'Agenda', icon: 'calendar', route: '/cms'),
    SubTab(id: 'cms-galerie', label: 'Galerie', icon: 'image', route: '/cms'),
    SubTab(id: 'cms-temoignages', label: 'Témoignages', icon: 'quote', route: '/cms'),
    SubTab(id: 'cms-faq', label: 'FAQ', icon: 'help-circle', route: '/cms'),
    SubTab(id: 'cms-messages', label: 'Messages reçus', icon: 'inbox', route: '/cms'),
    SubTab(id: 'cms-social', label: 'Réseaux sociaux', icon: 'share-2', route: '/cms'),
    SubTab(id: 'cms-google', label: 'Visibilité Google', icon: 'search', route: '/cms'),
    SubTab(id: 'cms-footer', label: 'Bas de page', icon: 'layout', route: '/cms'),
    SubTab(id: 'cms-settings', label: 'Paramètres', icon: 'settings', route: '/cms'),
  ],
);

/// 9. Cantine — 12 sub-tabs (web: CanteenModulePage.tsx)
const canteenModule = ModuleConfig(
  id: 'canteen',
  label: 'Cantine',
  icon: 'utensils',
  route: '/canteen',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'canteen-dashboard', label: 'Tableau de Bord', icon: 'layout-dashboard', route: '/canteen'),
    SubTab(id: 'canteen-menus', label: 'Menus', icon: 'utensils', route: '/canteen'),
    SubTab(id: 'canteen-inscriptions', label: 'Inscriptions', icon: 'user-plus', route: '/canteen'),
    SubTab(id: 'canteen-enrolled', label: 'Élèves inscrits', icon: 'users', route: '/canteen'),
    SubTab(id: 'canteen-presence', label: 'Présences', icon: 'calendar-check', route: '/canteen'),
    SubTab(id: 'canteen-regimes', label: 'Régimes & Allergies', icon: 'alert-circle', route: '/canteen'),
    SubTab(id: 'canteen-payments', label: 'Paiements', icon: 'credit-card', route: '/canteen'),
    SubTab(id: 'canteen-stocks', label: 'Stocks', icon: 'package', route: '/canteen'),
    SubTab(id: 'canteen-suppliers', label: 'Fournisseurs', icon: 'truck', route: '/canteen'),
    SubTab(id: 'canteen-incidents', label: 'Incidents & Hygiène', icon: 'alert-triangle', route: '/canteen'),
    SubTab(id: 'canteen-reports', label: 'Rapports', icon: 'bar-chart', route: '/canteen'),
    SubTab(id: 'canteen-settings', label: 'Paramètres', icon: 'settings', route: '/canteen'),
  ],
);

/// 10. EduCast — 17 sub-tabs (web: EduCastModulePage.tsx)
const educastModule = ModuleConfig(
  id: 'educast',
  label: 'EduCast',
  icon: 'video',
  route: '/educast',
  portals: [PortalType.school, PortalType.teacher],
  subTabs: [
    SubTab(id: 'edu-dashboard', label: 'Tableau de Bord', icon: 'layout-dashboard', route: '/educast'),
    SubTab(id: 'edu-library', label: 'Médiathèque', icon: 'folder-open', route: '/educast'),
    SubTab(id: 'edu-studio', label: 'Studio Enseignant', icon: 'video', route: '/educast'),
    SubTab(id: 'edu-monetization', label: 'Monétisation', icon: 'dollar-sign', route: '/educast'),
    SubTab(id: 'edu-packs', label: 'Packs de Contenus', icon: 'package', route: '/educast'),
    SubTab(id: 'edu-videos', label: 'Vidéos Pédagogiques', icon: 'play-circle', route: '/educast'),
    SubTab(id: 'edu-podcasts', label: 'Podcasts & Audios', icon: 'headphones', route: '/educast'),
    SubTab(id: 'edu-webinars', label: 'Webinaires & Directs', icon: 'radio', route: '/educast'),
    SubTab(id: 'edu-announcements', label: 'Annonces', icon: 'megaphone', route: '/educast'),
    SubTab(id: 'edu-moderation', label: 'Modération', icon: 'shield', route: '/educast'),
    SubTab(id: 'edu-analytics', label: 'Statistiques', icon: 'bar-chart', route: '/educast'),
    SubTab(id: 'edu-reports', label: 'Rapports', icon: 'file-text', route: '/educast'),
    SubTab(id: 'edu-channels', label: 'Chaînes', icon: 'tv', route: '/educast'),
    SubTab(id: 'edu-playlists', label: 'Playlists', icon: 'list', route: '/educast'),
    SubTab(id: 'edu-capsules', label: 'Capsules de Révision', icon: 'pill', route: '/educast'),
    SubTab(id: 'edu-resources', label: 'Ressources', icon: 'book-open', route: '/educast'),
    SubTab(id: 'edu-config', label: 'Configuration', icon: 'settings', route: '/educast'),
  ],
);

/// 11. Boutique — 14 sub-tabs (web: ShopModulePage.tsx)
const shopModule = ModuleConfig(
  id: 'shop',
  label: 'Boutique',
  icon: 'shopping-cart',
  route: '/shop',
  portals: [PortalType.school],
  subTabs: [
    SubTab(id: 'shop-overview', label: 'Vue d\'ensemble', icon: 'layout-dashboard', route: '/shop'),
    SubTab(id: 'shop-catalog', label: 'Catalogue', icon: 'book-open', route: '/shop'),
    SubTab(id: 'shop-items', label: 'Articles & Variantes', icon: 'package', route: '/shop'),
    SubTab(id: 'shop-orders', label: 'Commandes', icon: 'clipboard-list', route: '/shop'),
    SubTab(id: 'shop-pos', label: 'Ventes (POS)', icon: 'cash-register', route: '/shop'),
    SubTab(id: 'shop-payments', label: 'Paiements & Wallet', icon: 'wallet', route: '/shop'),
    SubTab(id: 'shop-stock', label: 'Stocks & Inventaires', icon: 'package', route: '/shop'),
    SubTab(id: 'shop-suppliers', label: 'Fournisseurs & Achats', icon: 'truck', route: '/shop'),
    SubTab(id: 'shop-promos', label: 'Remises & Promos', icon: 'percent', route: '/shop'),
    SubTab(id: 'shop-kits', label: 'Kits Scolaires', icon: 'backpack', route: '/shop'),
    SubTab(id: 'shop-delivery', label: 'Retraits & Livraisons', icon: 'truck', route: '/shop'),
    SubTab(id: 'shop-returns', label: 'Retours & Échanges', icon: 'rotate-ccw', route: '/shop'),
    SubTab(id: 'shop-reports', label: 'Rapports & Stats', icon: 'bar-chart', route: '/shop'),
    SubTab(id: 'shop-config', label: 'Configuration', icon: 'settings', route: '/shop'),
  ],
);

// ─── Mobile-only modules (not in web sidebar) ───────────────────────────

/// ORION IA — mobile-only separate module (embedded in dashboards on web)
const orionModule = ModuleConfig(
  id: 'orion',
  label: 'ORION IA',
  icon: 'brain',
  route: '/orion',
  portals: [PortalType.school, PortalType.teacher],
  subTabs: [
    SubTab(id: 'orion-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/orion'),
    SubTab(id: 'orion-analysis', label: 'Analyses', icon: 'bar-chart', route: '/orion'),
    SubTab(id: 'orion-predictions', label: 'Prédictions', icon: 'trending-up', route: '/orion'),
    SubTab(id: 'orion-reports', label: 'Rapports', icon: 'file-text', route: '/orion'),
    SubTab(id: 'orion-settings', label: 'Configuration', icon: 'settings', route: '/orion'),
  ],
);

/// Profile — mobile-only (via user menu on web)
const profileModule = ModuleConfig(
  id: 'profile',
  label: 'Profil',
  icon: 'user',
  route: '/profile',
  portals: [PortalType.platform, PortalType.school, PortalType.teacher, PortalType.parent],
  subTabs: [
    SubTab(id: 'profile-info', label: 'Informations', icon: 'user', route: '/profile'),
    SubTab(id: 'profile-notifications', label: 'Notifications', icon: 'bell', route: '/profile'),
  ],
);

/// Settings — visible on web but not in sidebar (accessed via /app/settings)
const settingsModule = ModuleConfig(
  id: 'settings',
  label: 'Paramètres',
  icon: 'settings',
  route: '/settings',
  portals: [PortalType.platform, PortalType.school],
  subTabs: [
    SubTab(id: 'settings-identity', label: 'Identité', icon: 'building', route: '/settings'),
    SubTab(id: 'settings-academic-year', label: 'Année scolaire', icon: 'calendar', route: '/settings'),
    SubTab(id: 'settings-structure', label: 'Structure', icon: 'layout-grid', route: '/settings'),
    SubTab(id: 'settings-departments', label: 'Administration', icon: 'building-2', route: '/settings'),
    SubTab(id: 'settings-bilingual', label: 'Bilingue', icon: 'languages', route: '/settings'),
    SubTab(id: 'settings-features', label: 'Modules', icon: 'toggle-right', route: '/settings'),
    SubTab(id: 'settings-roles', label: 'Rôles', icon: 'shield', route: '/settings'),
    SubTab(id: 'settings-billing', label: 'Facturation', icon: 'credit-card', route: '/settings'),
    SubTab(id: 'settings-security', label: 'Sécurité', icon: 'lock', route: '/settings'),
    SubTab(id: 'settings-seals', label: 'Cachets', icon: 'stamp', route: '/settings'),
    SubTab(id: 'settings-appareils', label: 'Appareils autorisés', icon: 'smartphone', route: '/settings'),
    SubTab(id: 'settings-history', label: 'Historique', icon: 'history', route: '/settings'),
  ],
);

/// Platform admin — platform portal only
const platformModule = ModuleConfig(
  id: 'platform',
  label: 'Administration Plateforme',
  icon: 'shield',
  route: '/platform',
  portals: [PortalType.platform],
  subTabs: [
    SubTab(id: 'platform-dashboard', label: 'Tableau de bord', icon: 'layout-dashboard', route: '/platform'),
    SubTab(id: 'platform-tenants', label: 'Établissements', icon: 'building', route: '/platform'),
    SubTab(id: 'platform-billing', label: 'Facturation', icon: 'credit-card', route: '/platform'),
    SubTab(id: 'platform-audit', label: 'Audit', icon: 'shield-check', route: '/platform'),
    SubTab(id: 'platform-users', label: 'Utilisateurs', icon: 'users', route: '/platform'),
    SubTab(id: 'platform-roles', label: 'Rôles', icon: 'shield', route: '/platform'),
    SubTab(id: 'platform-features', label: 'Fonctionnalités', icon: 'toggle-right', route: '/platform'),
    SubTab(id: 'platform-licenses', label: 'Licences', icon: 'key', route: '/platform'),
    SubTab(id: 'platform-analytics', label: 'Analytique', icon: 'bar-chart', route: '/platform'),
    SubTab(id: 'platform-support', label: 'Support', icon: 'headphones', route: '/platform'),
    SubTab(id: 'platform-logs', label: 'Journaux', icon: 'file-text', route: '/platform'),
    SubTab(id: 'platform-backups', label: 'Sauvegardes', icon: 'hard-drive', route: '/platform'),
    SubTab(id: 'platform-settings', label: 'Paramètres', icon: 'settings', route: '/platform'),
  ],
);

// ─── All Modules List ───────────────────────────────────────────────────

/// All module configurations in order (aligned with web PilotageSidebar).
final List<ModuleConfig> allModules = [
  dashboardModule,
  studentsModule,
  financeModule,
  examsModule,
  pedagogyModule,
  hrModule,
  communicationModule,
  cmsModule,
  canteenModule,
  educastModule,
  shopModule,
  orionModule,
  settingsModule,
  profileModule,
  platformModule,
];

/// Modules visible for SCHOOL portal (matches web PilotageSidebar).
final List<ModuleConfig> schoolModules = [
  dashboardModule,
  studentsModule,
  financeModule,
  examsModule,
  pedagogyModule,
  hrModule,
  communicationModule,
  cmsModule,
  canteenModule,
  educastModule,
  shopModule,
  settingsModule,
  profileModule,
];

/// Modules visible for TEACHER portal.
final List<ModuleConfig> teacherModules = [
  dashboardModule,
  pedagogyModule,
  studentsModule,
  examsModule,
  educastModule,
  profileModule,
];

/// Modules visible for PARENT portal.
final List<ModuleConfig> parentModules = [
  dashboardModule,
  studentsModule,
  profileModule,
];

/// Gets modules visible for a given portal.
List<ModuleConfig> getModulesForPortal(PortalType portal) {
  return allModules.where((m) => m.isVisibleFor(portal)).toList();
}
