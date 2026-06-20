/**
 * Page Display Names
 *
 * Map les segments de route vers des noms d'affichage en français.
 * Utilisé par AcademiaLoader pour afficher dynamiquement le nom de la page
 * en cours de chargement.
 */

export const PAGE_NAMES: Record<string, string> = {
  // ─── Racine & Auth ───
  '/': 'Accueil',
  '/auth/login': 'Connexion',
  '/admin-login': 'Connexion Admin',
  '/login': 'Connexion',
  '/signup': 'Inscription',
  '/signup/confirmation': 'Confirmation Inscription',
  '/signup/annulation': 'Annulation Inscription',
  '/forgot-password': 'Mot de passe oublié',
  '/reset-password': 'Réinitialisation mot de passe',
  '/verify/student/[token]': 'Vérification Élève',
  '/verify/receipt/[token]': 'Vérification Reçu',

  // ─── Public ───
  '/contact': 'Contact',
  '/blog': 'Blog',
  '/blog/[slug]': 'Article',
  '/pricing': 'Tarification',
  '/tarification': 'Tarification',
  '/modules': 'Modules',
  '/orion': 'ORION',
  '/federis': 'FEDERIS',
  '/avis': 'Avis',
  '/testimonials': 'Témoignages',
  '/en': 'English',
  '/gestion-scolaire': 'Gestion Scolaire',
  '/gestion-etablissement-scolaire': 'Gestion Établissement Scolaire',
  '/logiciel-ecole-afrique': 'Logiciel École Afrique',
  '/logiciel-gestion-ecole': 'Logiciel Gestion École',
  '/onboarding-error': "Erreur d'intégration",
  '/onboarding/callback': "Retour d'intégration",
  '/legal/cgv': 'CGV',
  '/legal/cgu': 'CGU',
  '/legal/privacy': 'Politique de confidentialité',
  '/legal/mentions': 'Mentions légales',

  // ─── Jobs / Recrutement ───
  '/jobs': 'Offres d\'emploi',
  '/jobs/[schoolSlug]': 'Établissement',
  '/jobs/[schoolSlug]/[jobSlug]': 'Offre d\'emploi',

  // ─── Portail & Divers ───
  '/portal': 'Portail',
  '/tenant-not-found': 'Établissement introuvable',
  '/dashboard': 'Tableau de bord',
  '/offline': 'Hors ligne',
  '/mobile/student': 'Espace Élève',
  '/mobile/parent': 'Espace Parent',
  '/app-test': 'Test Application',
  '/admin': 'Administration',
  '/admin/pricing': 'Tarification Admin',
  '/admin/devices': 'Appareils Admin',

  // ─── App — Dashboard & Modules transversaux ───
  '/app': 'Tableau de bord',
  '/app/general': 'Général',
  '/app/meetings': 'Réunions',
  '/app/transport': 'Transport',
  '/app/orion': 'ORION — Pilotage Direction',
  '/app/library': 'Bibliothèque',
  '/app/infirmary': 'Infirmerie',
  '/app/aggregation': 'Agrégation',
  '/app/shop': 'Boutique',
  '/app/qhse': 'QHSE',
  '/app/canteen': 'Cantine',
  '/app/educast': 'EduCast',

  // ─── App — Élèves & Scolarité ───
  '/app/students': 'Élèves & Scolarité',
  '/app/students/documents': 'Documents',
  '/app/students/classes': 'Classes',
  '/app/students/enrollments': 'Inscriptions',
  '/app/students/discipline': 'Discipline',
  '/app/students/attendance': 'Présences',
  '/app/students/matricules': 'Matricules',
  '/app/students/transfers': 'Transferts & Mobilité',
  '/app/students/id-cards': 'Cartes scolaires',
  '/app/students/guardians': 'Responsables légaux',
  '/app/students/[studentId]/dossier': 'Dossier Élève',

  // ─── App — Finances ───
  '/app/finance': 'Finances',
  '/app/finance/expenses': 'Dépenses & Budget',
  '/app/finance/reports': 'Rapports financiers',
  '/app/finance/treasury': 'Clôture & Trésorerie',
  '/app/finance/audit': 'Contrôle & Audit',
  '/app/finance/collection': 'Recouvrement',
  '/app/finance/accounts': 'Comptes élèves',
  '/app/finance/fees': 'Configuration des frais',
  '/app/finance/payments': 'Encaissements',
  '/app/finance/settings': 'Paramétrage & Audit',

  // ─── App — Examens ───
  '/app/exams': 'Examens',
  '/app/exams/grades': 'Saisie des notes',
  '/app/exams/evaluations': 'Évaluations',
  '/app/exams/councils': 'Conseils de classe',
  '/app/exams/validation': 'Validation',
  '/app/exams/audit': 'Audit',
  '/app/exams/analytics': 'Statistiques',
  '/app/exams/bulletins': 'Bulletins',
  '/app/exams/config': 'Paramétrage',
  '/app/exams/settings': 'Paramètres',
  '/app/exams/averages': 'Moyennes',

  // ─── App — RH & Paie ───
  '/app/hr': 'RH & Paie',
  '/app/hr/planning': 'Plannings & Horaires',
  '/app/hr/payroll': 'Paie',
  '/app/hr/payroll/[id]': 'Détail Paie',
  '/app/hr/collaborators': 'Collaborateurs',
  '/app/hr/leaves': 'Congés & Absences',
  '/app/hr/attendance': 'Suivi des Présences',
  '/app/hr/allowances': 'Primes & Indemnités',
  '/app/hr/recruitment': 'Recrutement',
  '/app/hr/contracts': 'Contrats',
  '/app/hr/contracts/[id]': 'Détail Contrat',
  '/app/hr/cnss': 'Déclarations CNSS',
  '/app/hr/reporting': 'Rapports & Analyses',
  '/app/hr/staff': 'Personnel',
  '/app/hr/staff/[id]': 'Fiche Personnel',
  '/app/hr/ia': 'IA RH',
  '/app/hr/settings': 'Paramètres RH',

  // ─── App — Communication ───
  '/app/communication': 'Communication & Engagement',
  '/app/communication/dashboard': 'Pilotage',
  '/app/communication/messages': 'Messagerie',
  '/app/communication/announcements': 'Annonces',
  '/app/communication/automated-notifications': 'Automatisations',
  '/app/communication/campaigns': 'Campagnes',
  '/app/communication/templates': 'Templates',
  '/app/communication/parents': 'Parents',
  '/app/communication/teachers': 'Enseignants',
  '/app/communication/students': 'Élèves',
  '/app/communication/administration': 'Administration',
  '/app/communication/channels': 'Canaux',
  '/app/communication/history': 'Historique',
  '/app/communication/reports': 'Rapports',
  '/app/communication/settings': 'Paramètres',

  // ─── App — Pédagogie ───
  '/app/pedagogy': 'Pédagogie',
  '/app/pedagogy/academic-structure': 'Structure académique',
  '/app/pedagogy/class-diaries': 'Cahiers de textes',
  '/app/pedagogy/assignments': 'Devoirs',
  '/app/pedagogy/control': 'Validation Direction',
  '/app/pedagogy/pedagogical-materials': 'Matériel pédagogique',
  '/app/pedagogy/sara-compose': 'Sara Compose (IA)',
  '/app/pedagogy/timetables': 'Emploi du temps',
  '/app/pedagogy/semainier': 'Semainier',
  '/app/pedagogy/global-library': 'Bibliothèque virtuelle',
  '/app/pedagogy/orion': 'Analytique ORION',
  '/app/pedagogy/production': 'Espace Pédagogie',
  '/app/pedagogy/tasks': 'Travaux & Suivi',
  '/app/pedagogy/teachers': 'Enseignants & Affectations',
  '/app/pedagogy/subjects': 'Matières & programmes',

  // ─── App — Paramètres ───
  '/app/settings': 'Paramètres',
  '/app/settings/billing': 'Facturation',

  // ─── App — Plateforme ───
  '/platform': 'Plateforme',
  '/platform/orion-pilotage': 'ORION Pilotage',
  '/platform/support': 'Support',
  '/platform/payments': 'Paiements',
  '/platform/aggregation': 'Agrégation',
  '/platform/settings': 'Paramètres Plateforme',
  '/platform/billing': 'Facturation Plateforme',
  '/platform/tenants': 'Établissements',
  '/platform/users': 'Utilisateurs',
  '/platform/subscriptions': 'Abonnements',
  '/platform/initial-subscriptions': 'Abonnements initiaux',
  '/platform/orion': 'ORION',
  '/platform/rbac': "Droits d'accès (RBAC)",
  '/platform/audit': 'Audit',
  '/platform/monitoring': 'Monitoring',
  '/platform/modules': 'Modules',

  // ─── FEDERIS ───
  '/federis/results': 'Résultats',
  '/federis/schools': 'Écoles',
  '/federis/centers': 'Centres',
  '/federis/checkout/success': 'Paiement confirmé',
  '/federis/checkout': 'Paiement',
  '/federis/login': 'Connexion FEDERIS',
  '/federis/grading': 'Correction',
  '/federis/connect': 'Connexion',
  '/federis/documents': 'Documents',
  '/federis/sara': 'SARA',
  '/federis/reports': 'Rapports',
  '/federis/billing': 'Facturation',
  '/federis/stats': 'Statistiques',
  '/federis/surveillance': 'Surveillance',
  '/federis/candidates': 'Candidats',
  '/federis/bureau': 'Bureau',
  '/federis/dashboard': 'Tableau de bord',
  '/federis/question-bank': 'Banque de questions',
  '/federis/platform-admin': 'Administration plateforme',
  '/federis/correction': 'Correction',
  '/federis/orion': 'ORION',
  '/federis/archives': 'Archives',
  '/federis/conflicts': 'Conflits',
  '/federis/register': 'Inscription',
  '/federis/notifications': 'Notifications',
  '/federis/exam-classes': "Classes d'examen",
  '/federis/compositions': 'Compositions',
  '/federis/deliberations': 'Délibérations',
  '/federis/exams': 'Examens',
  '/federis/communication': 'Communication',
  '/federis/settings': 'Paramètres',
};

/**
 * Résout le nom d'affichage d'une page à partir de son chemin.
 *
 * 1. Correspondance exacte dans PAGE_NAMES
 * 2. Remplacement des segments dynamiques [xxx] par des wildcards
 * 3. Fallback : on remonte les segments parents
 * 4. Dernier recours : "Chargement…"
 */
export function getPageDisplayName(pathname: string): string {
  // 1. Correspondance exacte
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];

  // 2. Remplacer les segments dynamiques [xxx] par [*] pour le matching
  const normalized = pathname.replace(/\/\[[^]+\]/g, '/[*]');
  if (PAGE_NAMES[normalized]) return PAGE_NAMES[normalized];

  // 3. Remonter les segments parents
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i > 0; i--) {
    const parentPath = '/' + segments.slice(0, i).join('/');
    if (PAGE_NAMES[parentPath]) return PAGE_NAMES[parentPath];
  }

  // 4. Fallback
  return 'Chargement…';
}
