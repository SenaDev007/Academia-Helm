/**
 * ============================================================================
 * RESOLVE SCHOOL LEVEL — résolution des filtres de niveau scolaire
 * ============================================================================
 * ⭐ FIX 2026-09-07 « miroir bilingue + sélecteurs vides » :
 *
 * PROBLÈME : le front envoie parfois comme `schoolLevelId` (query/body/header)
 *   - l'UUID de **education_levels** (table de la structure pédagogique), ou
 *   - l'UUID d'un **miroir bilingue EN** (NURSERY/PRIMARY/SECONDARY de
 *     education_levels, cf. bilingual-structure.service), ou
 *   - un code composite fused (« MAT_PRI »).
 *   Or les modèles métier (Student, StudentEnrollment, Class…) portent une FK
 *   vers **school_levels** (autre table, autres UUIDs) → filtre sans résultat
 *   (listes vides) et rejets 403 du AccessScopeGuard pour les comptes
 *   restreints (l'UUID education_levels n'est jamais dans scope.levelIds).
 *
 * SOLUTION : ce helper traduit TOUTE valeur en UUID(s) school_levels :
 *   1. UUID school_levels du tenant           → direct
 *   2. UUID education_levels du tenant        → name (miroir EN→FR) → code
 *   3. Code composite/court (MAT, PRI, SEC, MAT_PRI, MATERNELLE…) → code(s)
 *   4. Code long school_levels (PRIMAIRE…)    → direct
 *   5. Valeur inconnue                        → rendue telle quelle
 *      (comportement historique : filtre sans résultat)
 *
 * ⭐ MIROIR BILINGUE : NURSERY/PRIMARY/SECONDARY (education_levels EN) se
 *    résolvent vers le school_levels FR jumelé (MATERNELLE/PRIMAIRE/SECONDAIRE)
 *    → les vues de la piste anglophone montrent les MÊMES élèves que la piste
 *    francophone (conformément au design « AUCUNE duplication des élèves » —
 *    cf. bilingual-structure.service : les effectifs restent comptabilisés
 *    dans la section FR). Un seul paiement d'inscription/scolarité : l'élève
 *    garde un unique schoolLevelId.
 *
 * Cache mémoire par tenant (TTL 2 min) : les UUIDs de niveaux sont quasi
 * immuables en production ; ce cache évite 2-3 requêtes par appel d'API.
 * ============================================================================
 */

import { PrismaService } from '../../database/prisma.service';

/** Miroirs EN (education_levels.name) → code FR school_levels. */
const EN_MIRROR_TO_FR: Record<string, string> = {
  NURSERY: 'MATERNELLE',
  PRIMARY: 'PRIMAIRE',
  SECONDARY: 'SECONDAIRE',
};

/** Codes courts/composites → codes longs school_levels (aligné AccessScopeService). */
const CODE_COMPOSITES: Record<string, string[]> = {
  MAT: ['MATERNELLE'],
  MATERNELLE: ['MATERNELLE'],
  PRI: ['PRIMAIRE'],
  PRIMAIRE: ['PRIMAIRE'],
  SEC: ['SECONDAIRE'],
  SECONDAIRE: ['SECONDAIRE'],
  MAT_PRI: ['MATERNELLE', 'PRIMAIRE'],
};

interface TenantLevelCacheEntry {
  /** education_levels.id → code FR résolu */
  eduIdToFrCode: Map<string, string>;
  /** school_levels.code → id */
  codeToSlId: Map<string, string>;
  /** school_levels.id → id (présence) */
  slIds: Set<string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000;
const tenantCache = new Map<string, TenantLevelCacheEntry>();

async function getTenantLevels(
  prisma: PrismaService,
  tenantId: string,
): Promise<TenantLevelCacheEntry> {
  const cached = tenantCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const [schoolLevels, eduLevels] = await Promise.all([
    prisma.schoolLevel.findMany({ where: { tenantId }, select: { id: true, code: true } }),
    prisma.educationLevel.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);

  const codeToSlId = new Map<string, string>();
  const slIds = new Set<string>();
  for (const sl of schoolLevels) {
    if (!codeToSlId.has(sl.code)) codeToSlId.set(sl.code, sl.id);
    slIds.add(sl.id);
  }

  const eduIdToFrCode = new Map<string, string>();
  for (const el of eduLevels) {
    const upper = (el.name || '').toUpperCase();
    const frCode = EN_MIRROR_TO_FR[upper] || upper;
    // Ne garder que les niveaux résolvables vers un school_levels réel
    if (codeToSlId.has(frCode)) eduIdToFrCode.set(el.id, frCode);
  }

  const entry: TenantLevelCacheEntry = {
    eduIdToFrCode,
    codeToSlId,
    slIds,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  tenantCache.set(tenantId, entry);
  return entry;
}

/** Invalide le cache des niveaux d'un tenant (appelé après modification de structure). */
export function invalidateResolveSchoolLevelCache(tenantId: string): void {
  tenantCache.delete(tenantId);
}

/**
 * Résout une valeur de filtre `schoolLevelId` (query/body/header) en
 * UUID(s) school_levels prêts pour `where.schoolLevelId`.
 *
 * @returns
 *   - `null` : pas de filtre (valeur absente/vide ou sentinelle 'ALL')
 *   - `string[]` : les UUIDs school_levels cibles (1 ou plusieurs)
 *   - `[rawValue]` si inconnu (comportement historique : 0 résultat)
 */
export async function resolveSchoolLevelFilter(
  prisma: PrismaService,
  tenantId: string,
  rawValue: string | null | undefined,
): Promise<string[] | null> {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const value = rawValue.trim();
  if (!value || value.toUpperCase() === 'ALL') return null;

  const levels = await getTenantLevels(prisma, tenantId);

  // 1. UUID school_levels direct
  if (levels.slIds.has(value)) return [value];

  // 2. UUID education_levels (miroir EN rattaché à son FR)
  const frCode = levels.eduIdToFrCode.get(value);
  if (frCode) {
    const slId = levels.codeToSlId.get(frCode);
    if (slId) return [slId];
  }

  // 3. Code composite/fused ou code long
  const upper = value.toUpperCase();
  const codes = CODE_COMPOSITES[upper];
  if (codes) {
    const ids = codes
      .map((c) => levels.codeToSlId.get(c))
      .filter((x): x is string => !!x);
    if (ids.length > 0) return ids;
  }
  const slIdByCode = levels.codeToSlId.get(upper);
  if (slIdByCode) return [slIdByCode];

  // 4. Inconnu → rendu tel quel (comportement historique)
  return [value];
}

/**
 * Résout une valeur de filtre puis l'INTERSECTE avec le périmètre serveur
 * (scope.levelIds). Conçu pour le AccessScopeGuard : détermine si la valeur
 * demandée (même sous forme d'UUID education_levels / miroir EN / composite)
 * reste DANS le périmètre de l'utilisateur.
 *
 * @returns true si la valeur est couverte par le scope (ou si la résolution
 *          échoue et qu'il faut retomber sur la vérification brute).
 */
export async function isSchoolLevelFilterWithinScope(
  prisma: PrismaService,
  tenantId: string,
  rawValue: string,
  scopeLevelIds: string[],
): Promise<boolean> {
  const resolved = await resolveSchoolLevelFilter(prisma, tenantId, rawValue);
  if (!resolved) return true; // pas de filtre effectif
  return resolved.every((id) => scopeLevelIds.includes(id));
}
