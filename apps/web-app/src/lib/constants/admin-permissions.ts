/**
 * ============================================================================
 * ADMIN ROLE PERMISSIONS — Permissions par rôle administratif
 * ============================================================================
 *
 * Définit les modules accessibles à chaque rôle administratif.
 * Le PROMOTER a accès à TOUT (vue globale).
 * Les autres rôles ont un accès restreint par défaut, mais le promoteur
 * peut leur donner des accréditations supplémentaires (module-level override).
 *
 * Hiérarchie par niveau scolaire :
 *   Maternelle/Primaire : Directeur, Surveillant, Secrétaire, Comptable,
 *                         Secrétaire-Comptable
 *   Secondaire : Proviseur, Censeur, Surveillant Général, Surveillant,
 *                Intendant, Économe, Secrétaire, Comptable,
 *                Secrétaire-Comptable, Conseiller Pédagogique,
 *                Directeur des Études, Responsable Scolarité
 *
 * Modules disponibles :
 *   - dashboard      : Tableau de pilotage
 *   - students       : Élèves & Scolarité
 *   - pedagogy       : Organisation Pédagogique
 *   - exams          : Examens, Notes & Bulletins
 *   - finance        : Finance & Économat
 *   - hr             : Personnel, RH & Paie
 *   - communication  : Communication
 *   - discipline     : Discipline & Vie scolaire (surveillant)
 *   - settings       : Paramètres
 *
 * Sous-modules / fonctionnalités :
 *   - pedagogy.validation        : Espace de validation (fiches pédagogiques, cahiers journaux)
 *   - pedagogy.teacher_follow    : Travaux et suivis des enseignants
 *   - pedagogy.class_list        : Liste des élèves par classe
 *   - finance.collection         : Bilan des encaissements
 *   - finance.expenses           : Dépenses
 *   - finance.fee_config         : Configuration des frais
 *   - students.admissions        : Admissions
 *   - students.enrollments       : Inscriptions / Réinscriptions
 *   - students.transfers         : Transferts
 *   - exams.grades               : Saisie des notes
 *   - exams.bulletins            : Bulletins
 *   - discipline.sanctions       : Sanctions (saisie)
 *   - discipline.conduct         : Compteur de conduite
 *   - discipline.attendance      : Registres d'appel / présences
 * ============================================================================
 */

/**
 * Permissions de base par rôle (sans accréditations supplémentaires).
 * Le promoteur peut étendre ces permissions via des accréditations.
 */
export const BASE_ROLE_PERMISSIONS: Record<string, {
  modules: string[];
  features: string[];
  description: string;
}> = {
  // ── PROMOTER : accès complet ──
  PROMOTER: {
    modules: ['*'],
    features: ['*'],
    description: 'Accès complet à tous les modules et fonctionnalités',
  },

  // ── DIRECTEUR (Maternelle / Primaire) ──
  DIRECTEUR: {
    modules: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    features: [
      'pedagogy.class_list',        // Voir toutes les classes de son niveau + liste élèves
      'pedagogy.validation',        // Espace validation (fiches pédagogiques, cahiers journaux)
      'pedagogy.teacher_follow',    // Travaux et suivis des enseignants
      'students.view',              // Voir les données élèves
      'students.enrollments',       // Inscriptions / réinscriptions
      'exams.grades',               // Saisie et consultation des notes
      'exams.bulletins',            // Bulletins
      'discipline.view',            // Consulter la discipline (lecture seule)
      'discipline.attendance',      // Registres d'appel
    ],
    description: 'Directeur : élèves, pédagogie, examens, discipline (lecture). Finance/RH sur accréditation.',
  },

  // ── PROVISEUR (Secondaire — équivalent directeur) ──
  PROVISEUR: {
    modules: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    features: [
      'pedagogy.class_list',
      'pedagogy.validation',
      'pedagogy.teacher_follow',
      'students.view',
      'students.enrollments',
      'exams.grades',
      'exams.bulletins',
      'discipline.view',
      'discipline.attendance',
    ],
    description: 'Proviseur : même accès que directeur, niveau secondaire',
  },

  // ── DIRECTEUR_ADJOINT ──
  DIRECTEUR_ADJOINT: {
    modules: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    features: [
      'pedagogy.class_list',
      'pedagogy.validation',
      'pedagogy.teacher_follow',
      'students.view',
      'students.enrollments',
      'exams.grades',
      'exams.bulletins',
      'discipline.view',
      'discipline.attendance',
    ],
    description: 'Directeur adjoint : même accès que directeur',
  },

  // ── CENSEUR (Secondaire — gestion pédagogique) ──
  CENSEUR: {
    modules: ['dashboard', 'pedagogy', 'exams', 'discipline'],
    features: [
      'pedagogy.class_list',
      'pedagogy.validation',
      'pedagogy.teacher_follow',
      'exams.grades',
      'exams.bulletins',
      'discipline.view',            // Lecture seule sur les sanctions
      'discipline.conduct',         // Consulter le compteur de conduite
      'discipline.attendance',
    ],
    description: 'Censeur : pédagogie, examens, discipline (lecture). Pas de finance/RH.',
  },

  // ── SURVEILLANT_GENERAL (Secondaire — vie scolaire) ──
  SURVEILLANT_GENERAL: {
    modules: ['dashboard', 'students', 'discipline'],
    features: [
      'pedagogy.class_list',        // Voir toutes les classes de son niveau
      'students.view',              // Voir les élèves
      'discipline.sanctions',       // Saisir des sanctions (EXCLUSIF)
      'discipline.conduct',         // Gérer le compteur de conduite (EXCLUSIF)
      'discipline.attendance',      // Suivre les présences / registres d'appel
      'discipline.rules',           // Configurer le barème de fautes (avec validation chef)
    ],
    description: 'Surveillant Général : discipline, absences, conduites, vie scolaire. Pas de finance/RH/pédagogie.',
  },

  // ── SURVEILLANT (tous niveaux — adjoint du SG) ──
  SURVEILLANT: {
    modules: ['dashboard', 'students', 'discipline'],
    features: [
      'pedagogy.class_list',
      'students.view',
      'discipline.sanctions',
      'discipline.conduct',
      'discipline.attendance',
    ],
    description: 'Surveillant : même accès que surveillant général (adjoint)',
  },

  // ── SECRETAIRE ──
  SECRETAIRE: {
    modules: ['dashboard', 'students', 'exams'],
    features: [
      'students.view',
      'students.admissions',
      'students.enrollments',
      'students.transfers',
      'exams.grades',
      'exams.bulletins',
    ],
    description: 'Secrétaire : élèves & scolarité, examens & notes. Pas de finance/RH/discipline.',
  },

  // ── COMPTABLE ──
  COMPTABLE: {
    modules: ['dashboard', 'finance'],
    features: [
      'finance.collection',         // Bilan des encaissements
      'finance.expenses',           // Dépenses
      'finance.fee_config',         // Configuration des frais
      'students.view',              // Voir les élèves (pour facturation par classe)
    ],
    description: 'Comptable : finance uniquement (encaissements, dépenses, frais). Pas de pédagogie/RH.',
  },

  // ── SECRETAIRE_COMPTABLE (fusion secrétaire + comptable) ──
  SECRETAIRE_COMPTABLE: {
    modules: ['dashboard', 'students', 'finance', 'exams'],
    features: [
      // Secrétariat
      'students.view',
      'students.admissions',
      'students.enrollments',
      'students.transfers',
      // Comptabilité
      'finance.collection',
      'finance.expenses',
      'finance.fee_config',
      // Examens
      'exams.grades',
      'exams.bulletins',
    ],
    description: 'Secrétaire-Comptable : élèves + finance + examens (fusion secrétaire + comptable)',
  },

  // ── ECONOME / INTENDANT ──
  ECONOME: {
    modules: ['dashboard', 'finance'],
    features: [
      'finance.expenses',
      'finance.collection',
    ],
    description: 'Économe : dépenses et encaissements',
  },

  INTENDANT: {
    modules: ['dashboard', 'finance'],
    features: [
      'finance.expenses',
      'finance.collection',
    ],
    description: 'Intendant : dépenses et encaissements (secondaire)',
  },

  // ── RESP_SCOLARITE ──
  RESP_SCOLARITE: {
    modules: ['dashboard', 'students'],
    features: [
      'students.view',
      'students.admissions',
      'students.enrollments',
      'students.transfers',
    ],
    description: 'Responsable Scolarité : admissions, inscriptions, transferts',
  },

  // ── CONSEILLER_PEDAGOGIQUE ──
  CONSEILLER_PEDAGOGIQUE: {
    modules: ['dashboard', 'pedagogy', 'exams'],
    features: [
      'pedagogy.class_list',
      'pedagogy.validation',
      'pedagogy.teacher_follow',
      'exams.grades',
      'exams.bulletins',
    ],
    description: 'Conseiller Pédagogique : pédagogie et examens (lecture + validation)',
  },

  // ── DIRECTEUR_DES_ETUDES ──
  DIRECTEUR_DES_ETUDES: {
    modules: ['dashboard', 'pedagogy', 'exams', 'students'],
    features: [
      'pedagogy.class_list',
      'pedagogy.validation',
      'pedagogy.teacher_follow',
      'students.view',
      'exams.grades',
      'exams.bulletins',
    ],
    description: 'Directeur des Études : pédagogie, examens, élèves',
  },

  // ── RESPONSABLE_ORIENTATIONS ──
  RESPONSABLE_ORIENTATIONS: {
    modules: ['dashboard', 'students'],
    features: [
      'students.view',
    ],
    description: 'Responsable Orientations : consultation des élèves',
  },

  // ── DIRECTEUR_GENERAL ──
  DIRECTEUR_GENERAL: {
    modules: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    features: [
      'pedagogy.class_list',
      'pedagogy.validation',
      'pedagogy.teacher_follow',
      'students.view',
      'students.enrollments',
      'exams.grades',
      'exams.bulletins',
      'discipline.view',
      'discipline.attendance',
    ],
    description: 'Directeur Général : accès large comme directeur',
  },

  // ── AUTRE (par défaut : lecture seule sur dashboard) ──
  AUTRE: {
    modules: ['dashboard'],
    features: [],
    description: 'Autre poste : accès minimal (dashboard uniquement)',
  },
};

/**
 * Modules supplémentaires que le promoteur peut accorder en accréditation.
 * Ces modules ne sont PAS inclus par défaut dans les permissions de base.
 */
export const ACCREDITABLE_MODULES = [
  'finance',     // Module Finance
  'hr',          // Module RH
  'communication', // Module Communication
  'settings',    // Module Paramètres
];

/**
 * Vérifie si un rôle a accès à un module donné.
 * @param role Le rôle admin (ex: 'DIRECTEUR', 'SECRETAIRE')
 * @param module Le module à vérifier (ex: 'finance', 'students')
 * @param extraAccreditations Modules supplémentaires accordés par le promoteur
 * @returns true si le rôle a accès
 */
export function hasModuleAccess(
  role: string,
  module: string,
  extraAccreditations: string[] = []
): boolean {
  const perms = BASE_ROLE_PERMISSIONS[role];
  if (!perms) return false;

  // Le promoteur a accès à tout
  if (perms.modules.includes('*')) return true;

  // Vérifier les modules de base
  if (perms.modules.includes(module)) return true;

  // Vérifier les accréditations supplémentaires
  if (extraAccreditations.includes(module)) return true;

  return false;
}

/**
 * Vérifie si un rôle a accès à une fonctionnalité donnée.
 * @param role Le rôle admin
 * @param feature La fonctionnalité (ex: 'finance.collection')
 * @param extraAccreditations Modules supplémentaires accordés par le promoteur
 * @returns true si le rôle a accès
 */
export function hasFeatureAccess(
  role: string,
  feature: string,
  extraAccreditations: string[] = []
): boolean {
  const perms = BASE_ROLE_PERMISSIONS[role];
  if (!perms) return false;

  // Le promoteur a accès à tout
  if (perms.features.includes('*')) return true;

  // Vérifier les features de base
  if (perms.features.includes(feature)) return true;

  // Si le module parent de la feature est dans les accréditations, autoriser
  const parentModule = feature.split('.')[0];
  if (extraAccreditations.includes(parentModule)) return true;

  return false;
}

/**
 * Retourne la liste des modules accessibles pour un rôle,
 * en tenant compte des accréditations supplémentaires.
 */
export function getAccessibleModules(role: string, extraAccreditations: string[] = []): string[] {
  const perms = BASE_ROLE_PERMISSIONS[role];
  if (!perms) return ['dashboard'];

  if (perms.modules.includes('*')) {
    // Promoter : tous les modules
    return [
      'dashboard', 'students', 'pedagogy', 'exams', 'finance',
      'hr', 'communication', 'discipline', 'settings',
    ];
  }

  // Modules de base + accréditations
  const allModules = new Set([...perms.modules, ...extraAccreditations]);
  return Array.from(allModules);
}

/**
 * Retourne la liste des onglets de la sidebar visibles pour un rôle.
 * Utilisé pour filtrer la PilotageSidebar.
 */
export function getVisibleSidebarTabs(role: string, extraAccreditations: string[] = []): string[] {
  const modules = getAccessibleModules(role, extraAccreditations);

  // Mapping module → onglet sidebar
  const moduleToTab: Record<string, string> = {
    dashboard: 'Tableau de pilotage',
    students: 'Élèves & Scolarité',
    pedagogy: 'Organisation Pédagogique',
    exams: 'Examens, Notes & Bulletins',
    finance: 'Finances & Économat',
    hr: 'Personnel, RH & Paie',
    communication: 'Communication',
    discipline: 'Vie Scolaire',
    settings: 'Paramètres',
  };

  return modules.map(m => moduleToTab[m]).filter(Boolean);
}
