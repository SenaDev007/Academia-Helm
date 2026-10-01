/**
 * duration.ts — Conversion intelligente des durées d'épreuves (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ DEMANDE PATRONAT (2026-09-30) : « la durée des épreuves est saisie en
 *    minutes ; au-delà de 60 minutes, le système doit convertir
 *    intelligemment en heures, en même temps, afin que la durée s'affiche
 *    en heures sur l'épreuve. »
 *
 * Trois helpers purs (testables sans navigateur) :
 *
 *   1. minutesToHoursLabel(minutes) — 45 → « 45 min », 60 → « 1h »,
 *      90 → « 1h30 », 120 → « 2h », 135 → « 2h15 ». Utilisé partout où une
 *      durée en minutes doit s'afficher de façon lisible (catalogue Matières,
 *      pré-remplissage de l'éditeur d'épreuve…).
 *
 *   2. durationInputHint(raw) — indication EN DIRECT sous un champ de saisie
 *      en minutes : « 120 » → « 2h », « 90 » → « 1h30 ». Retourne null si la
 *      valeur n'est pas un nombre pur ou n'excède pas 60 minutes (rien à
 *      convertir d'intéressant).
 *
 *   3. normalizeDurationText(raw) — normalisation d'un champ texte libre au
 *      BLUR : « 120 » → « 2h », « 45 » → « 45 min ». Les valeurs déjà
 *      horaires (« 2h », « 1h30 », « 45 min ») sont conservées telles quelles.
 */

/** Convertit des minutes en libellé horaire lisible. */
export function minutesToHoursLabel(minutes: number): string {
  const n = Math.round(minutes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** Parse une saisie « nombre pur » (min) — retourne null sinon. */
function parsePureMinutes(raw: string): number | null {
  const v = raw.trim().replace(',', '.');
  if (!v || !/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Math.round(parseFloat(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Indication de conversion en direct : « 120 » → « 2h ».
 * Null si rien à convertir (non numérique, vide, ≤ 60 min).
 */
export function durationInputHint(raw: string): string | null {
  const n = parsePureMinutes(raw);
  if (n === null || n < 60) return null;
  return minutesToHoursLabel(n);
}

/**
 * Normalisation au blur d'un champ durée texte libre :
 * « 120 » → « 2h » · « 45 » → « 45 min » · « 2h » → « 2h » (inchangé).
 */
export function normalizeDurationText(raw: string): string {
  const n = parsePureMinutes(raw);
  if (n === null) return raw;
  return minutesToHoursLabel(n);
}

/**
 * Libellé de cellule pour un catalogue : la valeur heures si ≥ 60 min
 * (l'infobulle retrouve les minutes d'origine), sinon « 45 min ».
 */
export function catalogDurationCell(minutes: number | null | undefined): {
  label: string;
  title?: string;
} {
  if (!minutes || minutes <= 0) return { label: '—' };
  const label = minutesToHoursLabel(minutes);
  return minutes >= 60 ? { label, title: `${minutes} min` } : { label };
}
