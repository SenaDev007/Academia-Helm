/**
 * ============================================================================
 * UTILITAIRE DE TRI PÉDAGOGIQUE DES CLASSES
 * ============================================================================
 *
 * Tri des classes dans l'ordre pédagogique standard :
 *   Maternelle 1 < Maternelle 2 < CI < CP < CE1 < CE2 < CM1 < CM2 <
 *   6e < 5e < 4e < 3e < 2nde < 1ère < Terminale
 *
 * Au lieu du tri alphabétique qui donne CE1, CE2, CI, CM1, CM2, CP.
 *
 * ============================================================================
 */

/**
 * Retourne un ordre numérique pour une classe basé sur son nom.
 * Plus le nombre est petit, plus la classe est "jeune".
 */
export function classOrder(name: string): number {
  const n = (name || '').trim().toUpperCase();
  // Maternelle
  if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
  if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
  // Primaire
  if (n === 'CI') return 10;
  if (n === 'CP') return 11;
  if (n === 'CE1') return 12;
  if (n === 'CE2') return 13;
  if (n === 'CM1') return 14;
  if (n === 'CM2') return 15;
  // Secondaire
  if (n === '6E' || n === '6ÈME' || n === '6EME') return 20;
  if (n === '5E' || n === '5ÈME' || n === '5EME') return 21;
  if (n === '4E' || n === '4ÈME' || n === '4EME') return 22;
  if (n === '3E' || n === '3ÈME' || n === '3EME') return 23;
  if (n === '2NDE') return 24;
  if (n === '1ERE' || n === '1ÈRE') return 25;
  if (n === 'TERMINALE' || n === 'TLE') return 26;
  // Fallback : tri alphabétique pour les classes non standard
  return 100 + (name.charCodeAt(0) || 0);
}

/**
 * Tri un tableau de classes par ordre pédagogique.
 *
 * @param classes - Tableau d'objets classe (doivent avoir un champ `name`)
 * @returns Nouveau tableau trié
 */
export function sortClassesByPedagogicalOrder<T extends { name: string }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
}

/**
 * Filtre les classes par niveau scolaire, puis trie par ordre pédagogique.
 *
 * @param classes - Tableau d'objets classe
 * @param schoolLevelId - ID du niveau à filtrer (undefined = toutes)
 * @returns Tableau filtré et trié
 */
export function filterAndSortClasses<T extends { name: string; schoolLevelId: string }>(
  classes: T[],
  schoolLevelId?: string,
): T[] {
  const filtered = schoolLevelId
    ? classes.filter((c) => c.schoolLevelId === schoolLevelId)
    : classes;
  return sortClassesByPedagogicalOrder(filtered);
}
