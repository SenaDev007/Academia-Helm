/**
 * ============================================================================
 * UTILITAIRE DE TRI PÉDAGOGIQUE DES CLASSES
 * ============================================================================
 */

export function classOrder(name: string): number {
  const n = (name || '').trim().toUpperCase();
  if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
  if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
  if (n === 'CI') return 10;
  if (n === 'CP') return 11;
  if (n === 'CE1') return 12;
  if (n === 'CE2') return 13;
  if (n === 'CM1') return 14;
  if (n === 'CM2') return 15;
  if (n === '6E' || n === '6ÈME' || n === '6EME') return 20;
  if (n === '5E' || n === '5ÈME' || n === '5EME') return 21;
  if (n === '4E' || n === '4ÈME' || n === '4EME') return 22;
  if (n === '3E' || n === '3ÈME' || n === '3EME') return 23;
  if (n === '2NDE') return 24;
  if (n === '1ERE' || n === '1ÈRE') return 25;
  if (n === 'TERMINALE' || n === 'TLE') return 26;
  return 100 + (name.charCodeAt(0) || 0);
}

export function sortClassesByPedagogicalOrder<T extends { name: string }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
}

export function filterAndSortClasses<T extends { name: string; schoolLevelId: string }>(
  classes: T[],
  schoolLevelId?: string,
): T[] {
  const filtered = schoolLevelId
    ? classes.filter((c) => c.schoolLevelId === schoolLevelId)
    : classes;
  return sortClassesByPedagogicalOrder(filtered);
}
