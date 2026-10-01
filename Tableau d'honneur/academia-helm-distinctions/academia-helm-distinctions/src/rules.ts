import type { DistinctionCode, Level } from './types.js';

export interface Rule {
  code: DistinctionCode;
  /** Seuil minimum en pourcentage de la base de notation (0 à 100) */
  minPct: number;
}

/**
 * Règles par défaut, triées du seuil le plus haut au plus bas.
 * Chaque école peut les remplacer (table distinction_rules).
 * Maternel : le dernier palier est à 0, donc aucun enfant n'est exclu.
 * Primaire : en dessous de 50 %, aucun document public (message privé côté parent).
 * Secondaire : en dessous de 60 %, aucune mention.
 */
export const DEFAULT_RULES: Record<Level, Rule[]> = {
  maternel: [
    { code: 'MAT_OR', minPct: 90 },
    { code: 'MAT_ARGENT', minPct: 75 },
    { code: 'MAT_BRONZE', minPct: 60 },
    { code: 'MAT_EXPLO', minPct: 0 },
  ],
  primaire: [
    { code: 'PRI_FELIC', minPct: 80 },
    { code: 'PRI_ENCOU', minPct: 70 },
    { code: 'PRI_HONNEUR', minPct: 60 },
    { code: 'PRI_COURAGE', minPct: 50 },
  ],
  secondaire: [
    { code: 'SEC_FELIC', minPct: 80 },
    { code: 'SEC_ENCOU', minPct: 70 },
    { code: 'SEC_HONNEUR', minPct: 60 },
  ],
};

export const GRADUATION_CODE: Record<Level, DistinctionCode> = {
  maternel: 'MAT_GRAD',
  primaire: 'PRI_GRAD',
  secondaire: 'SEC_GRAD',
};

export function toPct(average: number, base: number): number {
  if (!base || base <= 0) throw new Error('La base de notation doit être positive');
  return (average / base) * 100;
}

/** Retourne la distinction liée à la moyenne, ou null si aucun palier n'est atteint */
export function resolveDistinction(
  level: Level,
  average: number,
  base: number,
  rules: Rule[] = DEFAULT_RULES[level],
): DistinctionCode | null {
  const pct = toPct(average, base);
  const sorted = [...rules].sort((a, b) => b.minPct - a.minPct);
  return sorted.find((r) => pct >= r.minPct)?.code ?? null;
}

export interface SpecialAwardInput {
  average?: number;
  previousAverage?: number;
  base: number;
  /** Nombre d'absences non justifiées sur la période */
  unjustifiedAbsences?: number;
  /** Nombre de retards sur la période */
  lateCount?: number;
  /** Note de conduite, en pourcentage de sa propre base (0 à 100) */
  conductPct?: number;
}

/** Prix spéciaux du secondaire, indépendants de la mention */
export function resolveSpecialAwards(i: SpecialAwardInput): DistinctionCode[] {
  const out: DistinctionCode[] = [];
  if (i.average != null && i.previousAverage != null) {
    const gain = toPct(i.average, i.base) - toPct(i.previousAverage, i.base);
    if (gain >= 10) out.push('SEC_PROGRES');
  }
  if (i.unjustifiedAbsences === 0 && (i.lateCount ?? 0) === 0) out.push('SEC_ASSIDUITE');
  if (i.conductPct != null && i.conductPct >= 90) out.push('SEC_COMPORTEMENT');
  return out;
}
