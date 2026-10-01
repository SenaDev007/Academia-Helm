/**
 * ============================================================================
 * SUBJECT CANONICAL ORDER — Module Examen > Bulletins Secondaire
 * ============================================================================
 *
 * ⭐ 2026-09-29 — Utilitaire partagé entre :
 *   - Backend bulletin-pdf.service.ts (buildHtmlSecondaire + buildHtmlSecondaireEval)
 *   - Frontend BulletinSecondairePage1 (Bulletin trimestriel)
 *   - Frontend BulletinSecondaireEvalPage1 (Bulletin d'évaluation)
 *   - Frontend BulletinAnglophonePage1 (EN Report Book)
 *
 * Ordre canonique des matières secondaires (exigence promoteur) :
 * « Les matières ne doivent pas être disposées de façon aléatoire. L'ordre
 *   doit être identique pour tous les élèves, d'un trimestre à l'autre, et
 *   cohérent entre l'UI et le PDF généré. »
 *
 * Ordre canonique (par catégorie puis par position dans la catégorie) :
 *
 *   LETTRES :
 *     1. Communication Écrite (Com.écr. / CE)
 *     2. Lecture (LECT)
 *     3. Français (FR)
 *     4. Anglais (ANG)
 *     5. Philosophie (PHILO)
 *     6. Histoire-Géographie (HG)
 *     7. Allemand (ALL)
 *     8. Espagnol (ESP)
 *     9. (autres langues, par ordre alphabétique)
 *
 *   SCIENCES :
 *     1. Mathématiques (MATH)
 *     2. Physique-Chimie / PCT / Physique Chimie et Technologie
 *     3. SVT (Sciences de la Vie et de la Terre)
 *     4. EST (Éducation Scientifique et Technologique)
 *     5. (autres sciences, par ordre alphabétique)
 *
 *   AUTRES :
 *     1. EPS (Éducation Physique et Sportive)
 *     2. Conduite
 *     3. Informatique (INFO)
 *     4. Arts plastiques
 *     5. Musique
 *     6. Dessin
 *     7. (autres, par ordre alphabétique)
 *
 * Normalisation NFD (sans accents) + lowercase pour la robustesse.
 * ============================================================================
 */

import { getSubjectCategory, CATEGORY_ORDER, type SubjectCategory } from './exam-subject-category';

// ─── Ordre canonique par catégorie ───────────────────────────────────────────
//    On teste en ORDER OF SPECIFICITY (du plus spécifique au plus générique)
//    pour que « Communication Écrite » matche avant « Écriture » et que
//    « Histoire-Géographie » matche avant « Histoire » seul.

interface CanonRule {
  pattern: string;   // NFD-normalized substring à détecter
  exactOnly?: boolean; // si true, le pattern doit être égal (pas includes)
}

const LETTRES_ORDER: CanonRule[] = [
  { pattern: 'communication ecrite' },
  { pattern: 'communication ecrit' },
  { pattern: 'lecture' },
  { pattern: 'francais' },
  { pattern: 'anglais' },
  { pattern: 'philosophie' },
  { pattern: 'histoire-geographie' },
  { pattern: 'histoire geographie' },
  { pattern: 'histoire et geographie' },
  { pattern: 'allemand' },
  { pattern: 'espagnol' },
  { pattern: 'education sociale' },
];

const SCIENCES_ORDER: CanonRule[] = [
  { pattern: 'mathematiques' },
  { pattern: 'mathematique' },
  { pattern: 'physique chimie et technologie' },
  { pattern: 'physique-chimie' },
  { pattern: 'physique chimie' },
  { pattern: 'pct', exactOnly: true },
  { pattern: 'science de la vie et de la terre' },
  { pattern: 'sciences de la vie et de la terre' },
  { pattern: 'svt', exactOnly: true },
  { pattern: 'education scientifique et technologique' },
  { pattern: 'education scientifique' },
  { pattern: 'eveil scientifique et technologique' },
  { pattern: 'eveil scientifique' },
  { pattern: 'est', exactOnly: true },
];

const AUTRES_ORDER: CanonRule[] = [
  { pattern: 'education physique et sportive' },
  { pattern: 'education physique' },
  { pattern: 'eps', exactOnly: true },
  { pattern: 'conduite' },
  { pattern: 'informatique' },
  { pattern: 'arts plastiques' },
  { pattern: 'musique' },
  { pattern: 'dessin' },
];

const normalizeName = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Retourne la position canonique d'une matière dans sa catégorie.
 * Plus petit = plus prioritaire (affiché en premier).
 * Si la matière ne match aucune règle, retourne Number.MAX_SAFE_INTEGER
 * → elle sera triée à la fin de sa catégorie, par ordre alphabétique.
 *
 * @param subjectName - Nom de la matière (ex: « Physique Chimie et Technologie »)
 * @param category - Catégorie de la matière (LETTRES / SCIENCES / AUTRES)
 * @returns index de tri (0 = premier, MAX = dernier de la catégorie)
 */
export function getSubjectCanonicalIndex(subjectName: string, category: SubjectCategory): number {
  const n = normalizeName(subjectName);
  if (!n) return Number.MAX_SAFE_INTEGER;
  const rules = category === 'LETTRES' ? LETTRES_ORDER
    : category === 'SCIENCES' ? SCIENCES_ORDER
    : AUTRES_ORDER;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const p = normalizeName(rule.pattern);
    if (!p) continue;
    if (rule.exactOnly) {
      if (n === p) return i;
    } else {
      if (n.includes(p)) return i;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Tri canonique des matières secondaires :
 *   1. Par catégorie : LETTRES → SCIENCES → AUTRES
 *   2. Dans chaque catégorie : par position canonique (getSubjectCanonicalIndex)
 *   3. Fallback : par ordre alphabétique du nom (NFD-normalized)
 *
 * @param subjects - Tableau de matières (avec .name)
 * @returns Nouveau tableau trié (ne mute pas l'original)
 *
 * @example
 * sortSecondarySubjects([{ name: 'SVT' }, { name: 'Mathématiques' }, { name: 'Français' }, { name: 'Conduite' }])
 * // → [{ name: 'Français' }, { name: 'Mathématiques' }, { name: 'SVT' }, { name: 'Conduite' }]
 */
export function sortSecondarySubjects<T extends { name: string }>(subjects: T[]): T[] {
  return [...subjects].sort((a, b) => {
    const catA = getSubjectCategory(a.name);
    const catB = getSubjectCategory(b.name);
    // 1. Par catégorie
    const catIdxA = CATEGORY_ORDER.indexOf(catA);
    const catIdxB = CATEGORY_ORDER.indexOf(catB);
    if (catIdxA !== catIdxB) return catIdxA - catIdxB;
    // 2. Dans la même catégorie : par position canonique
    const idxA = getSubjectCanonicalIndex(a.name, catA);
    const idxB = getSubjectCanonicalIndex(b.name, catB);
    if (idxA !== idxB) return idxA - idxB;
    // 3. Fallback : ordre alphabétique
    return normalizeName(a.name).localeCompare(normalizeName(b.name), 'fr');
  });
}
