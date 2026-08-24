/**
 * ============================================================================
 * EXAM ANGLOPHONE CONFIG — Configuration du système anglophone
 * ============================================================================
 *
 * Barèmes anglophones :
 *   - First CA / Second CA : 0 à 40
 *   - Examination           : 0 à 60
 *   - Overall (CA+Exam)     : 0 à 100
 *
 * Types d'évaluation anglophones :
 *   - First CA (code: FCA)
 *   - Second CA (code: SCA)
 *   - Examination (code: EXAM)
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
 *   - CA (sur 40)  : ≥ 20 (50%)
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

// ─── Helper : obtenir le barème selon le type d'évaluation ──────────────────

export function getMaxScoreForType(typeCode: string, language: 'FR' | 'EN' | undefined): number {
  if (language === 'EN') {
    const types = EN_EVALUATION_TYPES;
    const found = types.find(t => t.code === typeCode);
    if (found) return found.maxScore;
    // Default for unknown EN types
    return 40;
  }
  // FR default
  return 20;
}

export function getPassingScoreForType(typeCode: string, language: 'FR' | 'EN' | undefined): number {
  if (language === 'EN') {
    const found = EN_EVALUATION_TYPES.find(t => t.code === typeCode);
    if (found) return found.passingScore;
    return 20; // 50% of 40
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
 * Convertit un score vers /100 selon le système anglophone.
 * - CA (sur 40) : CA contribue pour 40% du total (2 CA × 20% chacun = 40%, Exam = 60%)
 * - Exam (sur 60) : Exam contribue pour 60% du total
 *
 * Si on a First CA + Second CA + Exam :
 *   Overall = (FirstCA + SecondCA) + Exam → total sur 140 → ramener à /100
 *   Overall = ((FirstCA + SecondCA) + Exam) / 140 * 100
 */
export function convertToOverall100(
  firstCA: number | null,
  secondCA: number | null,
  exam: number | null,
): number {
  const ca1 = firstCA ?? 0;
  const ca2 = secondCA ?? 0;
  const examScore = exam ?? 0;
  const total = ca1 + ca2 + examScore; // Max = 40 + 40 + 60 = 140
  return total / 140 * 100;
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
