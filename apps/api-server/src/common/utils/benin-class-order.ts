/**
 * ============================================================================
 * BENIN CLASS CANONICAL ORDER — Ordre officiel des classes (Bénin)
 * ============================================================================
 *
 * ⭐ 2026-10-16 — Exigence utilisateur (portail enseignant, valable partout
 *    où des classes sont listées) :
 *
 *   « On doit d'abord avoir la maternelle 1, ensuite la maternelle 2, le CI,
 *     le CP, le CE1, le CE2, le CM1 et le CM2. Ça devrait être l'ordre. »
 *
 * Appliqué côté BACKEND dans PedagogicalSpaceService.getMyClasses et
 * .getAllClassesForTenant — donc TOUS les consommateurs de
 * GET /pedagogy-space/my-classes bénéficient du même ordre :
 *   - Portail enseignant → Mes élèves (sélecteur de classes)
 *   - Portail enseignant → Espace pédagogique → onglet Mes classes
 *   - Portail enseignant → Évaluations (sélecteur de classe)
 *   - Espace enseignant des écoles (cahier journal, semainiers…)
 *
 * Robustesse :
 *   - Normalisation NFD (accents supprimés) + lowercase
 *   - Le rang de niveau vient du code SchoolLevel (MATERNELLE/PRIMAIRE/
 *     SECONDAIRE), avec repli sur détection par le nom
 *   - Sections A/B (ex. « CI A », « CI B ») : rang du grade identique puis
 *     ordre alphabétique du nom de section
 *   - Noms inconnus : en fin de liste, ordre alphabétique (jamais d'erreur)
 * ============================================================================
 */

/** Supprime les accents (NFD) + minuscules + espaces normalisés. */
export function normalizeClassName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rang d'un niveau scolaire : Maternelle < Primaire < Secondaire. */
function levelRank(codeOrName: string): number {
  const n = normalizeClassName(codeOrName);
  if (n.includes('matern') || n === 'mat' || n.startsWith('ps')) return 0;
  if (n.includes('prima') || n.includes('element')) return 1;
  if (n.includes('second') || n.includes('college') || n.includes('lyce')) return 2;
  return 3; // inconnu → fin de liste
}

/**
 * Rang d'un grade DANS son niveau. Ordre officiel béninois :
 *   Maternelle : Mat 1 (petite section) → Mat 2 (moyenne) → Mat 3 (grande)
 *   Primaire   : CI → CP → CE1 → CE2 → CM1 → CM2
 *   Secondaire : 6ème → 5ème → 4ème → 3ème → 2nde → 1ère → Terminale
 *
 * Les correspondances alternatives (petite/moyenne/grande section, « Tle »…)
 * sont acceptées pour les écoles qui les utilisent.
 */
function gradeRank(level: number, normalizedName: string): number {
  if (level === 0) {
    if (/\bmat(ernelle)?\s*1\b/.test(normalizedName) || /petite section|\bps\b/.test(normalizedName)) return 1;
    if (/\bmat(ernelle)?\s*2\b/.test(normalizedName) || /moyenne section/.test(normalizedName)) return 2;
    if (/\bmat(ernelle)?\s*3\b/.test(normalizedName) || /grande section|\bgs\b/.test(normalizedName)) return 3;
    return 90;
  }
  if (level === 1) {
    if (/\bci\b/.test(normalizedName)) return 1;
    if (/\bcp\b/.test(normalizedName)) return 2;
    if (/\bce1\b/.test(normalizedName)) return 3;
    if (/\bce2\b/.test(normalizedName)) return 4;
    if (/\bcm1\b/.test(normalizedName)) return 5;
    if (/\bcm2\b/.test(normalizedName)) return 6;
    return 90;
  }
  if (level === 2) {
    if (/\b6\s?(eme|e)\b/.test(normalizedName)) return 1;
    if (/\b5\s?(eme|e)\b/.test(normalizedName)) return 2;
    if (/\b4\s?(eme|e)\b/.test(normalizedName)) return 3;
    if (/\b3\s?(eme|e)\b/.test(normalizedName)) return 4;
    if (/\b2\s?nde\b/.test(normalizedName)) return 5;
    if (/\b1\s?(ere|re)\b/.test(normalizedName)) return 6;
    if (/\bterminale\b|\btle\b/.test(normalizedName)) return 7;
    return 90;
  }
  return 90;
}

/**
 * Compare deux classes pour un tri canonique béninois.
 *
 * @param a objet classe avec `className` (+ `schoolLevelCode` ou
 *          `schoolLevelName` facultatifs)
 * @param b objet classe au même format
 * @returns nombre négatif si a < b, positif si a > b, 0 sinon
 */
export function compareClassesCanonically(
  a: { className?: string; schoolLevelCode?: string; schoolLevelName?: string },
  b: { className?: string; schoolLevelCode?: string; schoolLevelName?: string },
): number {
  const keyOf = (c: { className?: string; schoolLevelCode?: string; schoolLevelName?: string }) => {
    const level = levelRank(c.schoolLevelCode || c.schoolLevelName || '');
    const name = normalizeClassName(c.className || '');
    return { level, grade: gradeRank(level, name), name };
  };

  const ka = keyOf(a);
  const kb = keyOf(b);

  if (ka.level !== kb.level) return ka.level - kb.level;
  if (ka.grade !== kb.grade) return ka.grade - kb.grade;
  return ka.name.localeCompare(kb.name, 'fr');
}

/**
 * Adaptateur pour les objets Class Prisma (champs `name` + `schoolLevel.code`)
 * vers le format attendu par compareClassesCanonically.
 */
export function classOrderKeyFromPrisma(c: {
  name?: string;
  code?: string;
  schoolLevel?: { code?: string; name?: string } | null;
}): { className: string; schoolLevelCode: string; schoolLevelName: string } {
  return {
    className: c.name || c.code || '',
    schoolLevelCode: c.schoolLevel?.code || '',
    schoolLevelName: c.schoolLevel?.name || '',
  };
}
