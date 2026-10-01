/**
 * ============================================================================
 * SUBJECT ABBREVIATION — Utilitaire partagé pour les PDF (PV, Stats, Promotion)
 * ============================================================================
 *
 * ⭐ 2026-09-29 — Utilitaire pour afficher des noms de matières abrégés
 *    dans les tableaux PDF denses (PV, Stats) au format A4 paysage.
 *
 * Règle de priorité :
 *   1. `subject.abbreviation` si défini par l'école (Module Organisation
 *      Pédagogique → Sujets → champ « Abréviation »)
 *   2. `subject.code` si présent ET non préfixé par un code long type `MATH-04`
 *      (on garde juste le préfixe avant le `-`)
 *   3. Abbréviation auto-déduite par mapping (NFD-normalized substring match)
 *   4. Fallback : premières lettres majuscules du nom (max 6 caractères)
 *
 * ⭐ L'utilisateur peut surcharger via `subject.abbreviation` :
 *    « lorsque l'école même met ces abréviations, ce sont ces abréviations-là
 *      qu'on va utiliser » (exigence promoteur).
 *
 * Catalogue des abréviations suggérées (aligné sur DEFAULT_SUBJECTS_CATALOGUE
 * du module Pédagogie + ajout de variantes pour les noms alternatifs) :
 *   - Physique-Chimie / Physique Chimie et Technologie → PCT
 *   - Communication Écrite → Com.écr.  (au lieu de CE pour lisibilité)
 *   - Sciences de la Vie et de la Terre → SVT
 *   - Français → FR
 *   - Histoire-Géographie → HG
 *   - Éducation Physique et Sportive → EPS
 *   - Mathématiques → MATH
 *   - Anglais → ANG
 *   - Espagnol → ESP
 *   - Allemand → ALL
 *   - Philosophie → PHILO
 *   - Informatique → INFO
 *   - Lecture → LECT
 *   - Dictée → DICT
 *   - Expression Écrite → E.écr.
 *   - Éducation Scientifique et Technologique → EST
 *   - Éducation Sociale → ES
 *   - Éducation Artistique (EA) Vivant → EAV
 *   - Éducation Artistique (EA) Plastique → EAP
 *   - Conduite → COND
 *   - Anglais (EN side) → ENG
 *   - English Language → ENG
 *   - Basic Science → BS
 *   - Social Studies → SST
 *   - Agricultural Science → AGR
 *   - Computer Science → CS
 *   - Civic Education → CIV
 *   - Verbal Reasoning → VR
 *   - Quantitative Reasoning → QR
 *   - Cultural and Creative Arts → CCA
 *   - Christian Religious Knowledge → CRK
 *   - Handwriting → HW
 *   - Drawing → DRW
 *   - Physical and Health Education → PHE
 *
 * Normalisation NFD (sans accents) + lowercase pour la robustesse.
 * ============================================================================
 */

export interface SubjectLike {
  name: string;
  abbreviation?: string | null;
  code?: string | null;
}

// ─── Mapping nom → abbréviation (NFD-normalized pour le match) ───────────────
//    On teste en ORDER OF SPECIFICITY (du plus spécifique au plus générique).
//    Ex : « Communication Écrite » doit matcher avant « Écriture ».

interface AbbrRule {
  pattern: string;       // NFD-normalized substring à détecter
  abbr: string;          // abbréviation à appliquer
  exactOnly?: boolean;   // si true, le pattern doit être égal (pas includes)
}

const ABBR_RULES: AbbrRule[] = [
  // ─── SECONDAIRE FR ────────────────────────────────────────────────────────
  { pattern: 'communication ecrite', abbr: 'Com.écr.' },
  { pattern: 'communication ecrit', abbr: 'Com.écr.' },
  { pattern: 'physique chimie et technologie', abbr: 'PCT' },
  { pattern: 'physique-chimie', abbr: 'PCT' },
  { pattern: 'physique chimie', abbr: 'PCT' },
  { pattern: 'science de la vie et de la terre', abbr: 'SVT' },
  { pattern: 'sciences de la vie et de la terre', abbr: 'SVT' },
  { pattern: 'histoire-geographie', abbr: 'HG' },
  { pattern: 'histoire geographie', abbr: 'HG' },
  { pattern: 'histoire et geographie', abbr: 'HG' },
  { pattern: 'education physique et sportive', abbr: 'EPS' },
  { pattern: 'education physique', abbr: 'EPS' },
  { pattern: 'mathematiques', abbr: 'MATH' },
  { pattern: 'mathematique', abbr: 'MATH' },
  { pattern: 'francais', abbr: 'FR' },
  { pattern: 'philosophie', abbr: 'PHILO' },
  { pattern: 'informatique', abbr: 'INFO' },
  { pattern: 'anglais', abbr: 'ANG' },
  { pattern: 'espagnol', abbr: 'ESP' },
  { pattern: 'allemand', abbr: 'ALL' },
  { pattern: 'lecture', abbr: 'LECT' },
  { pattern: 'dictee', abbr: 'DICT' },
  { pattern: 'expression ecrite', abbr: 'E.écr.' },
  { pattern: 'expression orale', abbr: 'E.or.' },
  { pattern: 'education scientifique et technologique', abbr: 'EST' },
  { pattern: 'education scientifique', abbr: 'EST' },
  { pattern: 'eveil scientifique et technologique', abbr: 'EST' },
  { pattern: 'eveil scientifique', abbr: 'EST' },
  { pattern: 'education sociale', abbr: 'ES' },
  { pattern: 'education artistique vivant', abbr: 'EAV' },
  { pattern: 'education artistique plastique', abbr: 'EAP' },
  { pattern: 'education artistique', abbr: 'EA' },
  { pattern: 'conduite', abbr: 'COND' },

  // ─── MATERNELLE FR ────────────────────────────────────────────────────────
  { pattern: 'education pour la sante', abbr: 'ES' },
  { pattern: 'education a des reflexions de sante', abbr: 'ERS' },
  { pattern: 'education du mouvement', abbr: 'EM' },
  { pattern: 'gestuelle', abbr: 'GEST' },
  { pattern: 'rythmique', abbr: 'RYTH' },
  { pattern: 'observation', abbr: 'OBS' },
  { pattern: 'education sensorielle', abbr: 'ESENS' },
  { pattern: 'pre-lecture', abbr: 'PLEC' },
  { pattern: 'pre lecture', abbr: 'PLEC' },
  { pattern: 'pre-ecriture', abbr: 'PECR' },
  { pattern: 'pre ecriture', abbr: 'PECR' },
  { pattern: 'pre-mathematique', abbr: 'PMAT' },
  { pattern: 'pre mathematique', abbr: 'PMAT' },
  { pattern: 'expression plastique', abbr: 'EP' },
  { pattern: 'expression emotionnelle', abbr: 'EE' },
  { pattern: 'expression corporelle', abbr: 'ECORP' },
  { pattern: 'langage', abbr: 'LANG' },
  { pattern: 'conte', abbr: 'CONT', exactOnly: true },
  { pattern: 'comptine', abbr: 'COMP', exactOnly: true },
  { pattern: 'poesie', abbr: 'POES' },
  { pattern: 'chant', abbr: 'CHAN', exactOnly: true },

  // ─── ANGLOPHONE (EN) ──────────────────────────────────────────────────────
  { pattern: 'english language', abbr: 'ENG' },
  { pattern: 'basic science', abbr: 'BS' },
  { pattern: 'social studies', abbr: 'SST' },
  { pattern: 'agricultural science', abbr: 'AGR' },
  { pattern: 'computer science', abbr: 'CS' },
  { pattern: 'civic education', abbr: 'CIV' },
  { pattern: 'verbal reasoning', abbr: 'VR' },
  { pattern: 'quantitative reasoning', abbr: 'QR' },
  { pattern: 'cultural and creative arts', abbr: 'CCA' },
  { pattern: 'christian religious knowledge', abbr: 'CRK' },
  { pattern: 'handwriting', abbr: 'HW' },
  { pattern: 'drawing', abbr: 'DRW', exactOnly: true },
  { pattern: 'physical and health education', abbr: 'PHE' },
  { pattern: 'mathematics', abbr: 'MATH' },
  { pattern: 'physical education', abbr: 'PE' },
];

const normalizeName = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// ─── Fallback : génère une abbréviation à partir du nom ──────────────────────
//    On garde les premières lettres majuscules ou acronymes. Max 6 caractères.
function fallbackAbbr(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  // Cas 1 : nom avec parenthèses type « Éducation Artistique (EA) Vivant »
  //    → on extrait l'acronyme entre parenthèses
  const parenMatch = n.match(/\(([A-Z]{2,4})\)/);
  if (parenMatch) return parenMatch[1];
  // Cas 2 : nom composé « Mot1 Mot2 Mot3 » → initiales majuscules
  const initials = n.split(/[\s\-_,]+/)
    .filter(w => w.length > 0)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
  if (initials.length >= 2) return initials;
  // Cas 3 : trop court → on prend le nom tel quel
  return n.slice(0, 6);
}

// ─── Extraction du préfixe d'un code (MATH-04 → MATH) ────────────────────────
function extractCodePrefix(code: string): string | null {
  if (!code) return null;
  const trimmed = String(code).trim();
  if (!trimmed) return null;
  // Forme « MATH-04 » ou « MATH_04 » → on garde « MATH »
  const match = trimmed.match(/^([A-Z]{2,6})[\-_]?/);
  if (match && match[1].length >= 2 && match[1].length <= 6) return match[1];
  // Forme pure « MATH » (lettre majuscules uniquement)
  if (/^[A-Z]{2,6}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Calcule l'abréviation à afficher pour une matière.
 *
 * @param subject Objet matière (doit avoir au moins .name)
 * @returns Abréviation courte à afficher dans le tableau
 */
export function getSubjectAbbreviation(subject: SubjectLike): string {
  // 1. abbreviation définie par l'école (priorité promoteur)
  if (subject?.abbreviation && String(subject.abbreviation).trim()) {
    return String(subject.abbreviation).trim();
  }
  // 2. code (extraire le préfixe avant le « - »)
  const codePrefix = extractCodePrefix(subject?.code || '');
  if (codePrefix) return codePrefix;
  // 3. mapping auto (NFD-normalized substring match)
  const n = normalizeName(subject?.name || '');
  if (n) {
    for (const rule of ABBR_RULES) {
      const p = normalizeName(rule.pattern);
      if (!p) continue;
      if (rule.exactOnly) {
        if (n === p) return rule.abbr;
      } else {
        if (n.includes(p)) return rule.abbr;
      }
    }
  }
  // 4. Fallback : initiales
  return fallbackAbbr(subject?.name || '');
}

/**
 * Version batch : applique getSubjectAbbreviation à un tableau de matières.
 * Garantit l'unicité : si deux matières tombent sur la même abbréviation,
 * on ajoute un suffixe numérique (ex : MATH, MATH-2).
 */
export function getSubjectAbbreviations<T extends SubjectLike>(subjects: T[]): Array<T & { __abbr: string }> {
  const used = new Map<string, number>(); // abbr → count
  return subjects.map(s => {
    let abbr = getSubjectAbbreviation(s);
    // Garantir l'unicité
    if (used.has(abbr)) {
      const count = (used.get(abbr) || 1) + 1;
      used.set(abbr, count);
      abbr = `${abbr}-${count}`;
    } else {
      used.set(abbr, 1);
    }
    return { ...s, __abbr: abbr };
  });
}
