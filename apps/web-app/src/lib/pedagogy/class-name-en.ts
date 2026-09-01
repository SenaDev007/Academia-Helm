/**
 * ============================================================================
 * ENGLISH TRACK — Class & level name translation utilities
 * ============================================================================
 *
 * Used by the English pedagogical track (production-en) to display
 * English class names (Nursery 1/2, Primary 1-6) instead of the
 * French names stored in the database (Maternelle 1/2, CI/CP/CE1/CE2/CM1/CM2).
 *
 * ⭐ Mapping (one-to-one with the official Benin nursery/primary system):
 *    Maternelle 1 → Nursery 1
 *    Maternelle 2 → Nursery 2
 *    Maternelle  → Nursery
 *    CI          → Primary 1
 *    CP          → Primary 2
 *    CE1         → Primary 3
 *    CE2         → Primary 4
 *    CM1         → Primary 5
 *    CM2         → Primary 6
 *
 * ⭐ Level name mapping:
 *    Maternelle  → Nursery
 *    Primaire    → Primary
 *    Secondaire  → Secondary
 * ============================================================================
 */

const CLASS_NAME_EN: Record<string, string> = {
  'Maternelle 1': 'Nursery 1',
  'Maternelle 2': 'Nursery 2',
  'Maternelle': 'Nursery',
  'CI': 'Primary 1',
  'CP': 'Primary 2',
  'CE1': 'Primary 3',
  'CE2': 'Primary 4',
  'CM1': 'Primary 5',
  'CM2': 'Primary 6',
};

const LEVEL_NAME_EN: Record<string, string> = {
  'Maternelle': 'Nursery',
  'Primaire': 'Primary',
  'Secondaire': 'Secondary',
};

/**
 * Translate a French class name to its English equivalent.
 * Falls back to the original name if no mapping is found.
 */
export function translateClassName(name: string | undefined | null): string {
  if (!name) return '';
  // Exact match
  if (CLASS_NAME_EN[name]) return CLASS_NAME_EN[name];
  // Case-insensitive match
  const key = Object.keys(CLASS_NAME_EN).find(k => k.toLowerCase() === name.toLowerCase());
  if (key) return CLASS_NAME_EN[key];
  return name;
}

/**
 * Translate a French level name to its English equivalent.
 * Performs a partial replacement so compound names like
 * "École Maternelle" become "École Nursery".
 */
export function translateLevelName(name: string | undefined | null): string {
  if (!name) return '';
  if (LEVEL_NAME_EN[name]) return LEVEL_NAME_EN[name];
  const key = Object.keys(LEVEL_NAME_EN).find(k => name.toLowerCase().includes(k.toLowerCase()));
  if (key) return name.replace(new RegExp(key, 'i'), LEVEL_NAME_EN[key]);
  return name;
}

/**
 * Translate the school level code used by the register header.
 * Returns the English level name (Nursery / Primary) suitable for the
 * official register header.
 */
export function translateLevelCode(code: string | undefined | null): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  if (upper === 'MATERNELLE') return 'NURSERY';
  if (upper === 'PRIMAIRE') return 'PRIMARY';
  if (upper === 'SECONDAIRE') return 'SECONDARY';
  return upper;
}
