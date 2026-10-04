/**
 * ============================================================================
 * EXAM ANGLOPHONE CONFIG — Configuration du système anglophone
 * ============================================================================
 *
 * ⭐ V10g — Barèmes anglophones (CORRECTION métier confirmée par l'utilisateur) :
 *   - First CA              : 0 à 20
 *   - Second CA             : 0 à 20
 *   - Examination           : 0 à 60
 *   - Récapitulatif trimestriel / matière : First CA + Second CA + Examination
 *     = 20 + 20 + 60 = 0 à 100
 *
 * Types d'évaluation anglophones :
 *   - First CA (codes: FCA / FIRST_CA)
 *   - Second CA (codes: SCA / SECOND_CA)
 *   - Examination (codes: EXAM / EXAMINATION)
 *
 * Mentions /100 :
 *   90-100 : Outstanding
 *   80-89  : Very Good
 *   70-79  : Good
 *   60-69  : Fair
 *   50-59  : Pass
 *   40-49  : Weak
 *   0-39   : Very Weak
 *
 * Seuils de réussite :
 *   - CA (sur 20)  : ≥ 10 (50%)
 *   - Exam (sur 60): ≥ 30 (50%)
 *   - Overall /100 : ≥ 50
 * ============================================================================
 */

// ─── Types d'évaluation anglophones ─────────────────────────────────────────

export const EN_EVALUATION_TYPES = [
  {
    code: 'FCA',
    name: 'First CA',
    label: 'First CA',
    maxScore: 40,
    passingScore: 20,
    includedInAverage: true,
  },
  {
    code: 'SCA',
    name: 'Second CA',
    label: 'Second CA',
    maxScore: 40,
    passingScore: 20,
    includedInAverage: true,
  },
  {
    code: 'EXAM',
    name: 'Examination',
    label: 'Examination',
    maxScore: 60,
    passingScore: 30,
    includedInAverage: true,
  },
] as const;

// ─── Types d'évaluation francophones (pour référence) ──────────────────────

export const FR_EVALUATION_TYPES = [
  {
    code: 'EM1',
    name: 'Évaluation mensuelle 1',
    label: 'Évaluation mensuelle 1',
    maxScore: 20,
    passingScore: 10,
    includedInAverage: true,
  },
  {
    code: 'EM2',
    name: 'Évaluation mensuelle 2',
    label: 'Évaluation mensuelle 2',
    maxScore: 20,
    passingScore: 10,
    includedInAverage: true,
  },
  {
    code: 'EC',
    name: 'Évaluation certificative',
    label: 'Évaluation certificative',
    maxScore: 20,
    passingScore: 10,
    includedInAverage: true,
  },
  {
    code: 'EP',
    name: 'Évaluation de passage',
    label: 'Évaluation de passage',
    maxScore: 20,
    passingScore: 10,
    includedInAverage: true,
  },
] as const;

// ─── Helper : obtenir les types selon la piste linguistique ─────────────────

export function getEvaluationTypes(language: 'FR' | 'EN' | undefined) {
  return language === 'EN' ? EN_EVALUATION_TYPES : FR_EVALUATION_TYPES;
}

// ─── Helper : normaliser le code d'un type d'évaluation anglophone ───────────
// Les types EN existent sous DEUX familles de codes selon la source :
//   - school_academic_settings.config.assessmentTypes → FIRST_CA / SECOND_CA / EXAM
//   - types par défaut / types créés à la volée          → FCA / SCA / EXAM
// ⭐ V10g — La normalisation rend les helpers de barème robustes aux DEUX familles.

export type EnComponentKey = 'CA1' | 'CA2' | 'EXAM';

export interface EnTermComponent {
  key: EnComponentKey;
  label: string;      // 'First CA', 'Second CA', 'Examination'
  maxScore: number;   // 40, 40, 60
}

export function enComponentForCode(typeCode: string): EnTermComponent | null {
  const c = (typeCode || '').toUpperCase().trim();
  if (c === 'FIRST_CA' || c === 'FCA') return { key: 'CA1', label: 'First CA', maxScore: 40 };
  if (c === 'SECOND_CA' || c === 'SCA') return { key: 'CA2', label: 'Second CA', maxScore: 40 };
  if (c === 'EXAM' || c === 'EXAMINATION') return { key: 'EXAM', label: 'Examination', maxScore: 60 };
  return null;
}

// Récapitulatif trimestriel : CA1 + CA2 + Exam = /100 par matière
export const EN_TERM_TOTAL_PER_SUBJECT = 100;

// ─── Helper : obtenir le barème selon le type d'évaluation ──────────────────

export function getMaxScoreForType(typeCode: string, language: 'FR' | 'EN' | undefined): number {
  if (language === 'EN') {
    const comp = enComponentForCode(typeCode);
    if (comp) return comp.maxScore;
    // Default for unknown EN types
    return 20;
  }
  // FR default
  return 20;
}

export function getPassingScoreForType(typeCode: string, language: 'FR' | 'EN' | undefined): number {
  if (language === 'EN') {
    const comp = enComponentForCode(typeCode);
    if (comp) return comp.maxScore * 0.5; // 50% du barème
    return 10; // 50% of 20
  }
  return 10; // 50% of 20
}

// ─── Grille d'appréciations anglophone (/100) ────────────────────────────────

export interface AppreciationLevel {
  min: number;
  max: number;
  grade: string;       // 'Outstanding', 'Very Good', etc.
  color: string;       // Tailwind classes for badge
  teacherAppreciation: string;
  teacherComments: string[];
  principalComment: string;
}

export const EN_APPRECIATION_SCALE: AppreciationLevel[] = [
  {
    min: 90, max: 100,
    grade: 'Outstanding',
    color: 'bg-emerald-100 text-emerald-700',
    teacherAppreciation: 'Outstanding performance. Excellent mastery of concepts.',
    teacherComments: [
      'Demonstrates exceptional understanding and skills',
      'Highly consistent and disciplined work',
      'Shows leadership and strong participation',
      'Keep up the excellent work',
    ],
    principalComment: 'Excellent academic performance. Commendable effort and discipline. Keep striving for excellence.',
  },
  {
    min: 80, max: 89,
    grade: 'Very Good',
    color: 'bg-blue-100 text-blue-700',
    teacherAppreciation: 'Very good performance. Strong academic achievement.',
    teacherComments: [
      'Very good comprehension of lessons',
      'Regular and serious work habits',
      'Participates actively in class',
      'Aiming for excellence is encouraged',
    ],
    principalComment: 'Very good results. Consistent effort is encouraged to reach the highest standards.',
  },
  {
    min: 70, max: 79,
    grade: 'Good',
    color: 'bg-cyan-100 text-cyan-700',
    teacherAppreciation: 'Good performance. Satisfactory results.',
    teacherComments: [
      'Understands most concepts taught',
      'Shows good effort and engagement',
      'Minor weaknesses need attention',
      'Can perform better with more focus',
    ],
    principalComment: 'Good performance. Greater concentration and consistency will lead to better outcomes.',
  },
  {
    min: 60, max: 69,
    grade: 'Fair',
    color: 'bg-amber-100 text-amber-700',
    teacherAppreciation: 'Fair performance. Needs improvement.',
    teacherComments: [
      'Basic understanding achieved',
      'Effort is inconsistent',
      'Needs to revise key concepts',
      'Greater commitment is required',
    ],
    principalComment: 'Fair results. Student is advised to work harder and remain focused.',
  },
  {
    min: 50, max: 59,
    grade: 'Pass',
    color: 'bg-orange-100 text-orange-700',
    teacherAppreciation: 'Passable performance. Results are just acceptable.',
    teacherComments: [
      'Learning objectives partially met',
      'Weak academic foundations',
      'Must improve study habits',
      'Parental support is recommended',
    ],
    principalComment: 'Results are just satisfactory. Stronger effort and parental follow-up are necessary.',
  },
  {
    min: 40, max: 49,
    grade: 'Weak',
    color: 'bg-red-100 text-red-700',
    teacherAppreciation: 'Weak performance. Below expected standard.',
    teacherComments: [
      'Significant learning difficulties',
      'Insufficient effort and practice',
      'Requires close academic monitoring',
      'Immediate corrective actions needed',
    ],
    principalComment: 'Performance below expectation. Immediate improvement is required with parental involvement.',
  },
  {
    min: 0, max: 39,
    grade: 'Very Weak',
    color: 'bg-rose-100 text-rose-700',
    teacherAppreciation: 'Very weak performance. Unsatisfactory.',
    teacherComments: [
      'Very poor understanding of lessons',
      'Lack of effort and motivation',
      'Serious academic gaps',
      'Intensive support is urgently required',
    ],
    principalComment: 'Very poor academic performance. Urgent remedial measures and close supervision are required.',
  },
];

// ─── Grille d'appréciations francophone (/20) — pour référence ───────────────

export const FR_APPRECIATION_SCALE = [
  { min: 16, max: 20, grade: 'Très Bien', color: 'bg-emerald-100 text-emerald-700' },
  { min: 14, max: 15.99, grade: 'Bien', color: 'bg-blue-100 text-blue-700' },
  { min: 12, max: 13.99, grade: 'Assez Bien', color: 'bg-cyan-100 text-cyan-700' },
  { min: 10, max: 11.99, grade: 'Passable', color: 'bg-amber-100 text-amber-700' },
  { min: 0, max: 9.99, grade: 'Insuffisant', color: 'bg-red-100 text-red-700' },
];

// ─── Helper : obtenir l'appréciation selon le score et la langue ────────────

export function getAppreciation(
  score: number,
  maxScore: number,
  language: 'FR' | 'EN' | undefined,
): AppreciationLevel | { grade: string; color: string } {
  if (language === 'EN') {
    // Convertir en /100 pour la grille anglophone
    const score100 = maxScore > 0 ? (score / maxScore) * 100 : 0;
    return EN_APPRECIATION_SCALE.find(l => score100 >= l.min && score100 <= l.max)
      || EN_APPRECIATION_SCALE[EN_APPRECIATION_SCALE.length - 1];
  }
  // FR : grille sur /20
  const score20 = maxScore > 0 ? (score / maxScore) * 20 : 0;
  const found = FR_APPRECIATION_SCALE.find(l => score20 >= l.min && score20 <= l.max);
  return found || FR_APPRECIATION_SCALE[FR_APPRECIATION_SCALE.length - 1];
}

// ─── Conversion de score entre barèmes ───────────────────────────────────────

/**
 * Total trimestriel anglophone par matière (/100).
 * ⭐ V10g — Premier CA /20 + Second CA /20 + Examination /60 = /100 exactement
 * (plus aucune conversion par /140 : le total brut EST sur 100).
 * Les composantes manquantes comptent pour 0 (récap partiel en cours de trimestre).
 */
export function convertToOverall100(
  firstCA: number | null,
  secondCA: number | null,
  exam: number | null,
): number {
  const ca1 = firstCA ?? 0;
  const ca2 = secondCA ?? 0;
  const examScore = exam ?? 0;
  const total = ca1 + ca2 + examScore; // Max = 20 + 20 + 60 = 100
  return total;
}

// ─── Labels UI anglophones ───────────────────────────────────────────────────

export const EN_LABELS = {
  // Modal création évaluation
  evaluationType: 'Assessment Type',
  title: 'Title',
  classes: 'Classes',
  subjects: 'Subjects',
  period: 'Term',
  selectAll: 'Select All',
  deselectAll: 'Deselect All',
  noClasses: 'No classes for this school level.',
  noSubjects: 'No subjects for this school level.',
  noTypes: 'No assessment type — configure them in Settings',
  noPeriods: 'No term — configure in Settings',
  startDate: 'Start Date',
  endDate: 'End Date',
  maxScore: 'Maximum Score',
  description: 'Description (optional)',
  save: 'Save',
  saving: 'Saving...',
  edit: 'Update',
  create: 'Create',
  selectPlaceholder: 'Select...',
  closed: 'closed',
  active: 'active',
  evaluationsCreated: 'assessment(s) will be created',
  classSubjectInfo: 'Each assigned teacher will automatically receive the assessment in their interface.',
  // Statuses
  draft: 'Draft',
  planned: 'Planned',
  openForGrading: 'Validated by teacher',
  submitted: 'Submitted to Director',
  validated: 'Validated',
  locked: 'Locked',
  cancelled: 'Cancelled',
  // Périodes
  firstTerm: 'First Term',
  secondTerm: 'Second Term',
  thirdTerm: 'Third Term',
  // Dashboard
  dashboard: 'Dashboard',
  evaluations: 'Assessments',
  grades: 'Grading',
  validation: 'Validation',
  unlockRequests: 'Unlock Requests',
  gradesRegister: 'Grades Register',
  bulletins: 'Report Cards',
  councils: 'Class Councils',
  analytics: 'Statistics',
  audit: 'Audit',
  settings: 'Settings',
  // Bulletins
  studentName: 'Student Name',
  matricule: 'Student ID',
  generalAverage: 'General Average',
  classAverage: 'Class Average',
  highestAverage: 'Highest Average',
  lowestAverage: 'Lowest Average',
  rank: 'Rank',
  mention: 'Grade',
  coefficient: 'Coefficient',
  appreciation: 'Appreciation',
  // Analysis
  analysePedagogique: 'Pedagogical Analysis & Teacher Recommendations to Parents',
  assiduite: 'Attendance',
  discipline: 'Discipline',
  defautsMajeurs: 'Major Weaknesses',
  qualitesRemarquables: 'Remarkable Qualities',
  directeurVisa: 'Principal\'s Visa',
  teacherSignature: 'Class Teacher\'s Signature',
  directorSignature: 'Principal\'s Signature',
  parentSignature: 'Parent\'s Signature',
  // Symboles
  outstanding: 'Outstanding',
  veryGood: 'Very Good',
  good: 'Good',
  fair: 'Fair',
  pass: 'Pass',
  weak: 'Weak',
  veryWeak: 'Very Weak',

  // ⭐ 2026-10-01 — Toolbar & action labels (anglophone Assessment tab)
  searchPlaceholder: 'Search by title, class, subject...',
  searchPlaceholderGrading: 'Search a class, a subject, a type...',
  allStatuses: 'All statuses',
  newEvaluation: 'New Assessment',
  loadingEvaluations: 'Loading assessments…',
  noEvaluations: 'No assessment scheduled',
  noEvaluationsHint: 'Click on "New Assessment" to schedule the first one.',
  noEvaluationsFiltered: 'No assessment matches the filters.',
  cancel: 'Cancel',
  delete: 'Delete',
  validate: 'Validate',
  submit: 'Submit',
  open: 'Open for grading',
  bulkEdit: 'Bulk Edit',
  apply: 'Apply',
  applying: 'Applying…',
  refresh: 'Refresh',
  yearAndLevel: 'Year and Level',
  allLevels: 'All Levels',
  class: 'Class',
  allClasses: 'All classes',
  bulkEditModalTitle: 'Bulk Edit',
  bulkEditModalSubtitle: (count: number, groupCount: number) =>
    `${count} assessment(s) across ${groupCount} class(es) — only checked fields will be applied everywhere`,
  bulkEditHowTo: 'How it works: check the fields you want to modify, enter the new value, then click Apply. All selected assessments will be updated with these values. Unchecked fields remain unchanged.',
  // Confirm dialogs
  confirmValidateTitle: 'Final validation',
  confirmValidateMessage: (count: number, className: string) =>
    `Permanently validate ${count} assessment(s) (${className})?\n\nGrades will be locked.`,
  confirmValidateIrreversible: 'This action is irreversible. Grades will be permanently locked.',
  confirmValidateToast: (count: number) => `${count} assessment(s) validated`,
  confirmCancelTitle: 'Cancel assessments',
  confirmCancelMessage: (subjectCount: number, className: string) =>
    `Cancel ${subjectCount} subject(s) for ${className}?`,
  confirmCancelHint: 'Assessments will be marked as cancelled (but not deleted).',
  confirmCancelToast: (count: number, className: string) =>
    `${count} assessment(s) cancelled for ${className}`,
  confirmDeleteTypeTitle: 'Delete assessment type',
  confirmDeleteTypeMessage: (name: string) => `Delete type "${name}"?`,
  confirmDeleteTypeHint: 'This action is irreversible. Existing assessments of this type will not be deleted.',
  systemTypesCannotDelete: 'System types cannot be deleted',
  // Toasts
  nameRequired: 'Name is required',
  typeUpdated: 'Type updated',
  typeCreated: 'Type created',
  typeSaveError: 'Error while saving the type',
  typeDeleted: 'Type deleted',
  // Grading tab (Step 1: trimester list)
  gradingTitle: 'Grading',
  gradingMode: 'Grading mode:',
  gradingModeMaternelle: 'Qualitative (TS / S / PS) — Nursery assessment',
  gradingModePrimaire: 'Quantitative (/20) with CM + CP — Primary assessment',
  gradingModeSecondaire: 'Quantitative (/20) — Secondary assessment',
  noPeriodsConfigured: 'No term configured',
  noPeriodsHint: 'Create terms in the Academic Year Settings.',
  loadingEvaluationsGrading: 'Loading assessments…',
  // Class selector
  selectClass: 'Select a class',
  selectPeriod: 'Select a term',
} as const;

export const FR_LABELS = {
  evaluationType: 'Type d\'évaluation',
  title: 'Titre',
  classes: 'Classes',
  subjects: 'Matières',
  period: 'Période (Trimestre)',
  selectAll: 'Tout sélectionner',
  deselectAll: 'Tout désélectionner',
  noClasses: 'Aucune classe pour ce niveau scolaire.',
  noSubjects: 'Aucune matière pour ce niveau scolaire.',
  noTypes: 'Aucun type — configurez-les dans l\'onglet Paramètres',
  noPeriods: 'Aucune période — configurez dans Paramètres',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  maxScore: 'Barème (note maximale)',
  description: 'Description (optionnel)',
  save: 'Enregistrer',
  saving: 'Enregistrement...',
  edit: 'Modifier',
  create: 'Créer',
  selectPlaceholder: 'Sélectionner...',
  closed: 'clôturée',
  active: 'active',
  evaluationsCreated: 'évaluation(s) seront créées',
  classSubjectInfo: 'Chaque enseignant assigné recevra automatiquement l\'évaluation dans son interface.',
  draft: 'Brouillon',
  planned: 'Planifiée',
  openForGrading: 'Validée par enseignant',
  submitted: 'Soumise au directeur',
  validated: 'Validée',
  locked: 'Verrouillée',
  cancelled: 'Annulée',
  firstTerm: 'Trimestre 1',
  secondTerm: 'Trimestre 2',
  thirdTerm: 'Trimestre 3',
  dashboard: 'Tableau de bord',
  evaluations: 'Évaluations',
  grades: 'Saisie des notes',
  validation: 'Validation',
  bulletins: 'Bulletins',
  councils: 'Conseils de classe',
  analytics: 'Statistiques',
  audit: 'Audit',
  settings: 'Paramètres',
  studentName: 'Nom de l\'élève',
  matricule: 'Matricule',
  generalAverage: 'Moyenne générale',
  classAverage: 'Moyenne de classe',
  highestAverage: 'Plus forte moyenne',
  lowestAverage: 'Plus faible moyenne',
  rank: 'Rang',
  mention: 'Mention',
  coefficient: 'Coefficient',
  appreciation: 'Appréciation',
  analysePedagogique: 'Analyse pédagogique sommaire des résultats et recommandations de l\'enseignant(e) aux parents',
  assiduite: 'Assiduité',
  discipline: 'Discipline',
  defautsMajeurs: 'Défauts majeurs identifiés',
  qualitesRemarquables: 'Qualités remarquables',
  directeurVisa: 'Visa du Directeur',
  teacherSignature: 'Titulaire de la classe',
  directorSignature: 'Le (la) Directeur(trice)',
  parentSignature: 'Les Parents',
  outstanding: 'Très Bien',
  veryGood: 'Bien',
  good: 'Assez Bien',
  fair: 'Passable',
  pass: 'Passable',
  weak: 'Insuffisant',
  veryWeak: 'Insuffisant',

  // ⭐ 2026-10-01 — Toolbar & action labels (anglophone Assessment tab — version FR)
  searchPlaceholder: 'Rechercher par titre, classe, matière...',
  searchPlaceholderGrading: 'Rechercher une classe, une matière, un type...',
  allStatuses: 'Tous les statuts',
  newEvaluation: 'Nouvelle évaluation',
  loadingEvaluations: 'Chargement des évaluations…',
  noEvaluations: 'Aucune évaluation programmée',
  noEvaluationsHint: 'Cliquez sur "Nouvelle évaluation" pour planifier la première.',
  noEvaluationsFiltered: 'Aucune évaluation ne correspond aux filtres.',
  cancel: 'Annuler',
  delete: 'Supprimer',
  validate: 'Valider',
  submit: 'Soumettre',
  open: 'Ouvrir pour saisie',
  bulkEdit: 'Modifier en masse',
  apply: 'Appliquer',
  applying: 'Application…',
  refresh: 'Actualiser',
  yearAndLevel: 'Année et niveau',
  allLevels: 'Tous les niveaux',
  class: 'Classe',
  allClasses: 'Toutes les classes',
  bulkEditModalTitle: 'Modification multiple',
  bulkEditModalSubtitle: (count: number, groupCount: number) =>
    `${count} évaluation(s) sur ${groupCount} classe(s) — seuls les champs cochés seront appliqués partout`,
  bulkEditHowTo: 'Comment ça marche : cochez les champs à modifier, saisissez la nouvelle valeur, puis cliquez sur Appliquer. Toutes les évaluations sélectionnées seront mises à jour avec ces valeurs. Les champs non cochés restent inchangés.',
  // Confirm dialogs
  confirmValidateTitle: 'Valider définitivement',
  confirmValidateMessage: (count: number, className: string) =>
    `Valider définitivement ${count} évaluation(s) (${className}) ?\n\nLes notes seront verrouillées.`,
  confirmValidateIrreversible: 'Cette action est irréversible. Les notes seront définitivement verrouillées.',
  confirmValidateToast: (count: number) => `${count} évaluation(s) validée(s)`,
  confirmCancelTitle: 'Annuler les évaluations',
  confirmCancelMessage: (subjectCount: number, className: string) =>
    `Annuler ${subjectCount} matière(s) pour ${className} ?`,
  confirmCancelHint: 'Les évaluations seront marquées comme annulées (mais non supprimées).',
  confirmCancelToast: (count: number, className: string) =>
    `${count} évaluation(s) annulée(s) pour ${className}`,
  confirmDeleteTypeTitle: 'Supprimer le type d\'évaluation',
  confirmDeleteTypeMessage: (name: string) => `Supprimer le type "${name}" ?`,
  confirmDeleteTypeHint: 'Cette action est irréversible. Les évaluations existantes de ce type ne seront pas supprimées.',
  systemTypesCannotDelete: 'Les types système ne peuvent pas être supprimés',
  // Toasts
  nameRequired: 'Le nom est obligatoire',
  typeUpdated: 'Type modifié',
  typeCreated: 'Type créé',
  typeSaveError: 'Erreur lors de la sauvegarde du type',
  typeDeleted: 'Type supprimé',
  // Grading tab (Step 1: trimester list)
  gradingTitle: 'Saisie des Notes',
  gradingMode: 'Mode de saisie :',
  gradingModeMaternelle: 'Qualitatif (TS / S / PS) — Évaluation maternelle',
  gradingModePrimaire: 'Quantitatif (/20) avec CM + CP — Évaluation primaire',
  gradingModeSecondaire: 'Quantitatif (/20) — Évaluation secondaire',
  noPeriodsConfigured: 'Aucun trimestre configuré',
  noPeriodsHint: 'Créez les trimestres dans Paramètres de l\'année académique.',
  loadingEvaluationsGrading: 'Chargement des évaluations…',
  // Class selector
  selectClass: 'Sélectionner une classe',
  selectPeriod: 'Sélectionner un trimestre',
} as const;

export function getLabels(language: 'FR' | 'EN' | undefined) {
  return language === 'EN' ? EN_LABELS : FR_LABELS;
}

// ─── Conversion des noms de période ─────────────────────────────────────────

export function translatePeriodName(name: string, language: 'FR' | 'EN' | undefined): string {
  if (language !== 'EN') return name;
  const lower = name.toLowerCase();
  if (lower.includes('trimestre 1') || lower.includes('1er trimestre') || lower === 't1') return 'First Term';
  if (lower.includes('trimestre 2') || lower.includes('2ème trimestre') || lower === 't2') return 'Second Term';
  if (lower.includes('trimestre 3') || lower.includes('3ème trimestre') || lower === 't3') return 'Third Term';
  if (lower.includes('premier trimestre')) return 'First Term';
  if (lower.includes('deuxième trimestre')) return 'Second Term';
  if (lower.includes('troisième trimestre')) return 'Third Term';
  return name;
}
