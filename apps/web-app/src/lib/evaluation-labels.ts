/**
 * ============================================================================
 * EVALUATION LABELS — Libellés complets des types d'évaluation (2026-11-24)
 * ============================================================================
 *
 * ⭐ Exigence promoteur (2026-11-24) : « Au lieu d'afficher EM1, on affiche
 *   "Évaluation mensuelle 1 – mois d'octobre 2026". L'évaluation est déjà
 *   programmée, la date est donnée, donc on récupère le mois. »
 *
 * Partout (interface comme PDF) :
 *   - Maternelle/Primaire FR : EM1/EM2/EC/EP
 *   - Secondaire FR : INT1/INT2 (IE1/IE2) + DS1/DS2
 *   - Piste EN : FIRST_CA (FCA) / SECOND_CA (SCA) / EXAM (EXAMINATION)
 *
 * Le MOIS est dérivé de `evaluationDate` des évaluations programmées du type
 * (mode = mois le plus fréquent, repli : 1re date chronologique).
 *
 * Formats :
 *   FR : « Évaluation mensuelle 1 – mois d'octobre 2026 »
 *        (contraction « mois d' » devant voyelle : avril, août, octobre)
 *   EN : « First CA – October 2026 »
 *
 * Si aucune évaluation programmée n'existe pour le type, on renvoie le nom
 * complet seul (« Évaluation mensuelle 1 ») — jamais le code brut.
 */

// ─── Noms complets standard par code (repli si le nom en base manque) ───────

const EVAL_NAMES: Record<string, { fr: string; en: string }> = {
  // Maternelle / Primaire FR
  EM1: { fr: 'Évaluation mensuelle 1', en: 'Monthly Evaluation 1' },
  EM2: { fr: 'Évaluation mensuelle 2', en: 'Monthly Evaluation 2' },
  EM3: { fr: 'Évaluation mensuelle 3', en: 'Monthly Evaluation 3' },
  EM4: { fr: 'Évaluation mensuelle 4', en: 'Monthly Evaluation 4' },
  EC: { fr: 'Évaluation certificative', en: 'Certifying Assessment' },
  EP: { fr: 'Évaluation de passage', en: 'Promotion Assessment' },
  // Secondaire FR (2 familles de codes : INT1/IE1…)
  INT1: { fr: 'Interrogation écrite 1', en: 'Written Quiz 1' },
  INT2: { fr: 'Interrogation écrite 2', en: 'Written Quiz 2' },
  IE1: { fr: 'Interrogation écrite 1', en: 'Written Quiz 1' },
  IE2: { fr: 'Interrogation écrite 2', en: 'Written Quiz 2' },
  DS1: { fr: 'Devoir surveillé 1', en: 'Supervised Assignment 1' },
  DS2: { fr: 'Devoir surveillé 2', en: 'Supervised Assignment 2' },
  // Piste EN (2 familles de codes)
  FCA: { fr: 'First CA', en: 'First CA' },
  FIRST_CA: { fr: 'First CA', en: 'First CA' },
  SCA: { fr: 'Second CA', en: 'Second CA' },
  SECOND_CA: { fr: 'Second CA', en: 'Second CA' },
  EXAM: { fr: 'Examination', en: 'Examination' },
  EXAMINATION: { fr: 'Examination', en: 'Examination' },
};

/** Nom complet d'un type d'évaluation (jamais le code brut). */
export function evalTypeName(code?: string | null, name?: string | null, lang: 'FR' | 'EN' = 'FR'): string {
  if (name && name.trim()) {
    // Le nom en base est prioritaire (ex: « Évaluation mensuelle 1 »)
    return name.trim();
  }
  if (code) {
    const std = EVAL_NAMES[code.toUpperCase()];
    if (std) return lang === 'EN' ? std.en : std.fr;
  }
  return name || code || 'Évaluation';
}

// ─── Mois ────────────────────────────────────────────────────────────────────

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * « mois d'octobre 2026 » / « mois de novembre 2026 » (FR — contraction
 * devant voyelle) ou « October 2026 » (EN).
 */
export function monthLabel(date: Date | string, lang: 'FR' | 'EN' = 'FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const m = d.getMonth();
  const y = d.getFullYear();
  if (lang === 'EN') return `${MONTHS_EN[m]} ${y}`;
  const mois = MONTHS_FR[m];
  const contraction = 'aàâeéèêëiîïoôuûùyh'.includes(mois[0]);
  return `mois ${contraction ? `d'${mois}` : `de ${mois}`} ${y}`;
}

/**
 * Libellé du mois dérivé d'une liste d'évaluations : le mois le plus
 * fréquent parmi les evaluationDate (repli : 1re date chronologique).
 */
export function monthLabelForEvals(evals: any[], lang: 'FR' | 'EN' = 'FR'): string | null {
  const dates = (evals || [])
    .map((ev) => ev?.evaluationDate || ev?.startDate || ev?.date)
    .filter(Boolean)
    .map((x: any) => new Date(x))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return null;
  // Clé année-mois → occurrences
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey: string | null = null;
  let bestCount = -1;
  for (const [k, c] of counts) {
    if (c > bestCount || (c === bestCount && !bestKey)) { bestKey = k; bestCount = c; }
  }
  const [y, m] = (bestKey as string).split('-').map(Number);
  const ref = new Date(y, m, 1);
  return monthLabel(ref, lang);
}

/**
 * Libellé ENRICHI complet : « Évaluation mensuelle 1 – mois d'octobre 2026 ».
 * `evalsOfThisType` = évaluations programmées de CE type (période courante).
 * Sans évaluation programmée : nom complet seul.
 */
export function enrichedEvalLabel(
  code?: string | null,
  name?: string | null,
  evalsOfThisType: any[] = [],
  lang: 'FR' | 'EN' = 'FR',
): string {
  const fullName = evalTypeName(code, name, lang);
  const mois = monthLabelForEvals(evalsOfThisType, lang);
  return mois ? `${fullName} – ${mois}` : fullName;
}

/**
 * Map code → libellé enrichi, construite depuis une liste d'évaluations
 * (chacune avec evaluationType.code + evaluationDate).
 *
 * Ex : buildEvalLabels(evals, 'FR') →
 *   { EM1: 'Évaluation mensuelle 1 – mois d'octobre 2026',
 *     EM2: 'Évaluation mensuelle 2 – mois de novembre 2026',
 *     EC:  'Évaluation certificative – mois de décembre 2026' }
 */
export function buildEvalLabels(evals: any[], lang: 'FR' | 'EN' = 'FR'): Record<string, string> {
  const byCode = new Map<string, { name?: string | null; evals: any[] }>();
  for (const ev of evals || []) {
    const code = ev?.evaluationType?.code;
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, { name: ev.evaluationType?.name, evals: [] });
    byCode.get(code)!.evals.push(ev);
  }
  const labels: Record<string, string> = {};
  for (const [code, { name, evals: evalsOfCode }] of byCode) {
    labels[code] = enrichedEvalLabel(code, name, evalsOfCode, lang);
  }
  return labels;
}

/**
 * Map periodId → Map code → libellé enrichi (pour les vues multi-périodes :
 * tableau annuel, moyennes trimestrielles).
 */
export function buildEvalLabelsByPeriod(evals: any[], lang: 'FR' | 'EN' = 'FR'): Record<string, Record<string, string>> {
  const byPeriod = new Map<string, any[]>();
  for (const ev of evals || []) {
    const pid = ev?.period?.id || ev?.periodId;
    if (!pid) continue;
    if (!byPeriod.has(pid)) byPeriod.set(pid, []);
    byPeriod.get(pid)!.push(ev);
  }
  const out: Record<string, Record<string, string>> = {};
  for (const [pid, list] of byPeriod) out[pid] = buildEvalLabels(list, lang);
  return out;
}

/**
 * Deux lignes d'un en-tête de colonne : nom complet (ligne 1) + mois
 * (ligne 2, plus petit). Retourne { name, month } ou null si pas de mois.
 */
export function splitEnrichedLabel(label?: string): { name: string; month: string | null } | null {
  if (!label) return null;
  const idx = label.lastIndexOf(' – mois ');
  if (idx === -1) {
    // piste EN : « First CA – October 2026 »
    const m = label.match(/^(.*) – ([A-Z][a-z]+ \d{4})$/);
    if (m) return { name: m[1], month: m[2] };
    return { name: label, month: null };
  }
  return { name: label.slice(0, idx), month: label.slice(idx + 3) }; // +3 = ' – '
}
