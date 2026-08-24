/**
 * ⭐ Formatage des durées hebdomadaires (volume horaire hebdomadaire)
 * ============================================================================
 *
 * RAPPEL CONTEXTE :
 * Le champ `weeklyHours` (subjects, class_subjects) est stocké en MINUTES
 * depuis la refonte du 2026-08-20. Avant, il était en heures (défaut = 4h).
 * Une migration SQL (multiply_weekly_hours_by_60.cjs) a converti les valeurs
 * existantes : 4 (heures) → 240 (minutes = 4h).
 *
 * Cette fonction prend une valeur en MINUTES et renvoie un format lisible :
 *   0      → '—'
 *   30     → '30 min'
 *   60     → '1h00'
 *   90     → '1h30'
 *   120    → '2h00'
 *   240    → '4h00'
 *   450    → '7h30'
 *   1680   → '28h00'
 *
 * À utiliser PARTOUT où weeklyHours est affiché — sinon on affiche "120 heures"
 * pour 120 minutes (le bug corrigé).
 */
export function formatWeeklyDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes)) || Number(minutes) === 0) return '—';
  const mins = Number(minutes);
  if (mins < 60) {
    return `${mins} min`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/**
 * Version avec suffixe "/sem" pour les cardes de charge enseignant.
 * Ex: 120 → '2h/sem' / 90 → '1h30/sem' / 30 → '30 min/sem'
 */
export function formatWeeklyDurationWithSuffix(
  minutes: number | null | undefined,
  suffix: string = '/sem',
): string {
  if (minutes == null || Number(minutes) === 0) return `— ${suffix}`.trim();
  return `${formatWeeklyDuration(minutes)}${suffix}`;
}

/**
 * Convertit une somme de minutes en heures décimales (pour comparaisons).
 * Ex: 120 → 2 / 90 → 1.5 / 240 → 4
 *
 * Utile pour comparer une charge (en minutes) à un max en heures :
 *   const chargeH = minutesToHours(loads[tId].assigned);  // 600 → 10
 *   if (chargeH > profile.maxWeeklyHours) ...
 */
export function minutesToHours(minutes: number | null | undefined): number {
  if (!minutes) return 0;
  return Number(minutes) / 60;
}
