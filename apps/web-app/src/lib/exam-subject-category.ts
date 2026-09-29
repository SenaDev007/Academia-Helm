/**
 * ============================================================================
 * SUBJECT CATEGORIZATION — Module Examen > Bulletins Secondaire
 * ============================================================================
 *
 * ⭐ 2026-09-28 — Utilitaire partagé entre :
 *   - Backend bulletin-pdf.service.ts (buildHtmlSecondaire + buildHtmlSecondaireEval)
 *   - Frontend BulletinSecondairePage1 (Bulletin trimestriel)
 *   - Frontend BulletinSecondaireEvalPage1 (Bulletin d'évaluation)
 *
 * Catégorisation des matières secondaires en 3 groupes :
 *   - LETTRES  : Français, Anglais, Histoire-Géographie, Philosophie, etc.
 *   - SCIENCES : Mathématiques, Physique-Chimie, SVT, EST, PCT, etc.
 *   - AUTRES   : EPS, Conduite, Informatique, Arts plastiques, Musique, etc.
 *
 * Ordre d'affichage : LETTRES → SCIENCES → AUTRES
 *
 * ⭐ FIX EPS 2026-09-28 : « Éducation physique et sportive » était
 *    catégorisée en SCIENCES (à cause de la sous-chaîne « physique » qui
 *    matchait « Physique »). Détection SPECIFIC-FIRST : on teste d'abord
 *    les marqueurs AUTRES (EPS / Conduite / Informatique) AVANT de
 *    retomber sur les matchs génériques (Physique → SCIENCES).
 *
 * ⭐ 2026-09-29 — Tri canonique des matières dans chaque catégorie :
 *    Communication Écrite → Lecture → Français → Anglais → ...,
 *    Mathématiques → PCT → SVT → ..., EPS → Conduite → Informatique → ...
 *    (cf. subject-canonical-order.ts).
 *
 * Normalisation NFD (sans accents) + lowercase pour la robustesse.
 * ============================================================================
 */

import { getSubjectCanonicalIndex } from './subject-canonical-order';

export type SubjectCategory = 'LETTRES' | 'SCIENCES' | 'AUTRES';

const AUTRES_MARKERS = [
  'eps', 'education physique', 'sport',
  'informatique', 'conduite',
  'arts plastiques', 'musique', 'dessin',
];

const LETTRES_MARKERS = [
  'francais', 'francais', 'communication', 'lecture',
  'anglais', 'allemand', 'espagnol', 'philosophie',
  'histoire', 'geographie', 'histoire-geographie',
  'education sociale',
];

const SCIENCES_MARKERS = [
  'mathematiques', 'mathematiques', 'maths', 'math',
  'physique-chimie', 'physique chimie', 'pct', 'physique chimie et technologie',
  'chimie', 'svt', 'science de la vie', 'sciences de la vie',
  'est', 'education scientifique', 'eveil scientifique',
];

const normalizeName = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function getSubjectCategory(subjectName: string): SubjectCategory {
  const n = normalizeName(subjectName);
  if (!n) return 'AUTRES';
  // 1. AUTRES d'abord (pour que EPS et Conduite soient toujours AUTRES,
  //    même si « education physique » contient « physique »)
  if (AUTRES_MARKERS.some(m => n.includes(normalizeName(m)))) return 'AUTRES';
  // 2. LETTRES
  if (LETTRES_MARKERS.some(m => n.includes(normalizeName(m)))) return 'LETTRES';
  // 3. SCIENCES
  if (SCIENCES_MARKERS.some(m => n.includes(normalizeName(m)))) return 'SCIENCES';
  // Fallback pour « Physique » seul (pas « education physique » qui est
  // déjà traité en AUTRES ci-dessus) — pour ne pas casser Physique-Chimie
  if (n.includes('physique')) return 'SCIENCES';
  // 4. Défaut
  return 'AUTRES';
}

export const CATEGORY_ORDER: SubjectCategory[] = ['LETTRES', 'SCIENCES', 'AUTRES'];

export const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  LETTRES: 'Bilan Lettres',
  SCIENCES: 'Bilan Sciences',
  AUTRES: 'Bilan Autres',
};

/**
 * Groupe les matières par catégorie et calcule la moyenne de chaque groupe.
 * Retourne une map ordered comme CATEGORY_ORDER (LETTRES → SCIENCES → AUTRES).
 *
 * ⭐ 2026-09-29 — Les matières dans chaque catégorie sont triées par ordre
 *    canonique (Communication Écrite → Lecture → Français → Anglais → ...,
 *    Mathématiques → PCT → SVT → ..., EPS → Conduite → Informatique → ...).
 *    L'ordre ne dépend pas de l'ordre d'entrée → identique pour tous les
 *    élèves, d'un trimestre à l'autre, et cohérent UI ↔ PDF.
 *
 * @param subjects - Tableau de matières (avec .name)
 * @param getScore - Fonction qui retourne la moyenne d'une matière (ou null)
 * @returns Map<SubjectCategory, { subjects: T[]; average: number | null }>
 */
export function groupSubjectsByCategory<T extends { name: string }>(
  subjects: T[],
  getScore: (subject: T) => number | null,
): Map<SubjectCategory, { subjects: T[]; average: number | null }> {
  const result = new Map<SubjectCategory, { subjects: T[]; average: number | null }>();
  for (const cat of CATEGORY_ORDER) {
    result.set(cat, { subjects: [], average: null });
  }
  for (const s of subjects) {
    const cat = getSubjectCategory(s.name);
    result.get(cat)!.subjects.push(s);
  }
  // ⭐ 2026-09-29 — Tri canonique des matières dans chaque catégorie.
  //    On importe dynamiquement pour éviter une dépendance circulaire (le
  //    fichier subject-canonical-order.ts importe déjà getSubjectCategory
  //    depuis ce fichier).
  //    Ordre canonique :
  //      LETTRES  : Communication Écrite → Lecture → Français → Anglais →
  //                 Philosophie → Histoire-Géo → Allemand → Espagnol → ...
  //      SCIENCES : Mathématiques → PCT → SVT → EST → ...
  //      AUTRES   : EPS → Conduite → Informatique → Arts → Musique → ...
  //    Fallback : ordre alphabétique du nom (NFD-normalized).
  for (const cat of CATEGORY_ORDER) {
    const group = result.get(cat)!;
    if (group.subjects.length === 0) continue;
    group.subjects.sort((a, b) => {
      const idxA = getSubjectCanonicalIndex(a.name, cat);
      const idxB = getSubjectCanonicalIndex(b.name, cat);
      if (idxA !== idxB) return idxA - idxB;
      const na = (a.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const nb = (b.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return na.localeCompare(nb, 'fr');
    });
    // Calculer la moyenne de chaque catégorie
    const validScores = group.subjects
      .map(s => getScore(s))
      .filter((v): v is number => v !== null && !isNaN(v));
    group.average = validScores.length > 0
      ? validScores.reduce((sum, v) => sum + v, 0) / validScores.length
      : null;
  }
  return result;
}
