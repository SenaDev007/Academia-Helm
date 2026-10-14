/**
 * ============================================================================
 * FRAIS D'EXAMENS NATIONAUX — helpers partagés (module Finance)
 * ============================================================================
 *
 * ⭐ Exigence promoteur (oct. 2026) — onglet « Frais des examens » :
 *    suivi dédié des frais d'examen (type FeeType.EXAMEN) sur EXACTEMENT le
 *    même pattern que l'onglet « Frais généraux » (listing par élève :
 *    dus / payé / solde, déduction après encaissement), avec des SOUS-ONGLETS
 *    par examen national.
 *
 * Mapping examen ↔ classes (système éducatif béninois) :
 *   - CEP  (Certificat d'Études Primaires)          → classes de CM2
 *   - BEPC (Brevet d'Études du Premier Cycle)       → classes de 3ème
 *   - BAC  (Baccalauréat)                           → classes de Terminale
 *   - CAP  (Certificat d'Aptitude Professionnelle)  → filières techniques CAP
 *
 * Dynamisme des sous-onglets : un sous-onglet s'affiche SI ET SEULEMENT SI
 * l'école a activé le niveau scolaire correspondant dans
 * Paramètres > Structure (niveaux MATERNELLE / PRIMAIRE / SECONDAIRE — les
 * niveaux school_levels n'ont pas de granularité par cycle) ET possède au
 * moins une classe à examen pour l'année scolaire en cours :
 *   - Primaire seulement                        → uniquement CEP
 *   - Primaire + secondaire jusqu'à la 3ème     → CEP + BEPC
 *   - Jusqu'à la Terminale (+ CAP le cas échéant) → CEP + BEPC + BAC (+ CAP)
 *
 * La granularité de cycle (1er cycle vs 2nd cycle du Secondaire) est dérivée
 * des classes réellement présentes : une école qui n'a pas de classe de
 * Terminale n'affiche pas le sous-onglet Baccalauréat, même si le niveau
 * Secondaire est activé.
 */

export interface ExamTypeDef {
  /** Code court (paramètre API `examType`) — CEP | BEPC | BAC | CAP */
  code: 'CEP' | 'BEPC' | 'BAC' | 'CAP';
  /** Libellé du sous-onglet (FR) */
  label: string;
  /** Libellé du sous-onglet (EN — piste anglophone) */
  labelEn: string;
  /** Classes concernées (info affichée sous le libellé) */
  classHint: string;
  classHintEn: string;
  /**
   * Niveaux scolaires (codes de Paramètres > Structure) qui rendent l'examen
   * POSSIBLE pour l'école : le sous-onglet ne peut apparaître que si l'un de
   * ces niveaux est activé. (Miroirs anglophones inclus.)
   */
  levelCodes: string[];
  /** Regex (sur nom de classe normalisé : majuscules SANS accents) */
  pattern: RegExp;
}

/** Normalisation d'un nom de classe : majuscules + suppression des accents. */
export function normalizeClassName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/** catalogue des examens nationaux — ordre d'affichage des sous-onglets */
export const EXAM_TYPES: ExamTypeDef[] = [
  {
    code: 'CEP',
    label: 'CEP',
    labelEn: 'CEP',
    classHint: 'CM2',
    classHintEn: 'CM2 (Grade 6 level)',
    levelCodes: ['PRIMAIRE', 'PRIMARY'],
    pattern: /(^|[^A-Z0-9])CM2([^A-Z0-9]|$)/,
  },
  {
    code: 'BEPC',
    label: 'BEPC',
    labelEn: 'BEPC',
    classHint: '3ème',
    classHintEn: '9th grade',
    levelCodes: ['SECONDAIRE', 'SECONDARY'],
    pattern: /(^|[^A-Z0-9])(3E|3EME|3IEME|TROISIEME)([^A-Z0-9]|$)/,
  },
  {
    code: 'BAC',
    label: 'Baccalauréat',
    labelEn: 'Baccalaureate',
    classHint: 'Terminale',
    classHintEn: 'Final year',
    levelCodes: ['SECONDAIRE', 'SECONDARY'],
    pattern: /(^|[^A-Z0-9])(TERMINALE|TLE|BACCALAUREAT)([^A-Z0-9]|$)/,
  },
  {
    code: 'CAP',
    label: 'CAP',
    labelEn: 'CAP',
    classHint: 'Filières techniques',
    classHintEn: 'Technical track',
    levelCodes: ['SECONDAIRE', 'SECONDARY', 'TECHNIQUE'],
    pattern: /(^|[^A-Z0-9])CAP([^A-Z0-9]|$)/,
  },
];

/** Un nom de classe correspond-il à ce type d'examen ? */
export function matchesExamClass(examCode: string, className: string): boolean {
  const def = EXAM_TYPES.find((e) => e.code === examCode);
  if (!def) return false;
  return def.pattern.test(normalizeClassName(className));
}

/**
 * Sous-onglets d'examen visibles pour l'école :
 * niveau activé (Paramètres > Structure) ET au moins une classe à examen
 * dans les classes de l'année scolaire.
 *
 * @param levelCodes codes des niveaux ACTIVÉS (ex. ['MATERNELLE','PRIMAIRE'])
 * @param classes    classes de l'année (objets avec au moins `name`)
 */
export function getVisibleExamSubTabs(
  levelCodes: string[],
  classes: { name?: string | null }[],
): ExamTypeDef[] {
  const enabled = new Set((levelCodes || []).map((c) => normalizeClassName(c)));
  return EXAM_TYPES.filter((exam) => {
    const levelOk = exam.levelCodes.some((lc) => enabled.has(lc));
    if (!levelOk) return false;
    return (classes || []).some((c) => matchesExamClass(exam.code, c?.name || ''));
  });
}

/**
 * Classes à examen de l'année, pour un type d'examen donné
 * (utilisé par le filtre Classe de l'onglet Frais des examens).
 */
export function getExamClasses(examCode: string, classes: any[]): any[] {
  return (classes || []).filter((c) => matchesExamClass(examCode, c?.name || ''));
}
