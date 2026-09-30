/**
 * grade-computations.ts — Calculs du module « Notes et Moyennes » (Federis)
 *
 * Miroir exact des helpers backend (federis-grades.service.ts) pour les
 * calculs LIVE côté client pendant la saisie (pattern GradingSheet Helm) :
 *   - MODÈLE SIMPLE (moyenne simple)  : total + Σ notes / nb matières ;
 *   - MODÈLE PONDÉRÉ (avec coefficients) : note × coefficient, total des
 *     coefficients, total des notes coefficient, moyenne pondérée
 *     Σ(note×coef) / Σ(coef) ;
 *   - Le modèle EFFECTIF vient des règles de calcul (Paramètres → Règles de
 *     calcul) : défaut backend (CEP simple, BEPC/BAC/CAP pondérée) ou règle
 *     personnalisée du patronat (source de vérité) ;
 *   - Les ABSENTS sont exclus de tous les calculs ;
 *   - Rangs denses (ex æquo), appréciations et mentions nationales.
 */

export interface GSubject {
  id: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  order: number;
  /** ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE : une matière dont l'épreuve
   *  n'est PAS préparée (module Épreuves et documents, ou marquage manuel
   *  « déjà préparée » pour une épreuve produite hors application) ne peut
   *  PAS recevoir de notes — la grille verrouille ses colonnes. */
  epreuvePrepared?: boolean;
  /** 'paper' = épreuve du module · 'manual' = marquée « déjà préparée » · null. */
  preparedSource?: 'paper' | 'manual' | null;
}

export interface GCell {
  score: number | null;
  isAbsent: boolean;
}

export interface GCandidateRow {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  anonymatCode: string | null;
  gender: string | null;
  school: string;
  centerCode: string | null;
  centerName: string | null;
  roomCode: string | null;
  tableNumber: string | null;
  scores: Record<string, GCell>;
  computed?: GComputed | null;
  rank?: number | null;
}

export interface GComputed {
  total: number;
  nbEval: number;
  average: number | null;
  totalCoef: number;
  totalNotesCoef: number;
  averagePondernee: number | null;
  finalAverage: number | null;
}

/** Le CEP suit le modèle du PRIMAIRE (template sans coefficients) ? */
export function isPrimaryExam(examType: string | null | undefined): boolean {
  return (examType ?? '').toUpperCase() === 'CEP';
}

/** Modèle de calcul par DÉFAUT du backend pour un type (miroir backend). */
export function defaultAverageModel(examType: string | null | undefined): 'simple' | 'ponderee' {
  return isPrimaryExam(examType) ? 'simple' : 'ponderee';
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Statistiques d'un candidat — useSimpleAverage = modèle de calcul effectif
 *  (règles de calcul : 'simple' → moyenne simple, sinon pondérée). */
export function computeTotals(
  scores: Record<string, GCell>,
  subjects: GSubject[],
  useSimpleAverage: boolean,
): GComputed {
  let total = 0;
  let nbEval = 0;
  let totalCoef = 0;
  let totalNotesCoef = 0;
  for (const subject of subjects) {
    const cell = scores[subject.id];
    if (!cell || cell.isAbsent || cell.score === null || cell.score === undefined) continue;
    const score = Math.max(0, Math.min(Number(cell.score), subject.maxScore ?? 20));
    const coef = subject.coefficient ?? 1;
    total += score;
    nbEval += 1;
    totalCoef += coef;
    totalNotesCoef += score * coef;
  }
  const average = nbEval > 0 ? round2(total / nbEval) : null;
  const averagePondernee = totalCoef > 0 ? round2(totalNotesCoef / totalCoef) : null;
  return {
    total: round2(total),
    nbEval,
    average,
    totalCoef: round2(totalCoef),
    totalNotesCoef: round2(totalNotesCoef),
    averagePondernee,
    finalAverage: useSimpleAverage ? average : averagePondernee,
  };
}

/** Rangs denses (ex æquo) par moyenne retenue décroissante. */
export function denseRanks(entries: Array<{ id: string; value: number | null }>): Map<string, number> {
  const ranks = new Map<string, number>();
  const sorted = entries
    .filter((e) => e.value !== null)
    .sort((a, b) => (b.value as number) - (a.value as number));
  let currentRank = 0;
  let previous: number | null = null;
  for (const entry of sorted) {
    if (previous === null || entry.value !== previous) {
      currentRank += 1;
      previous = entry.value;
    }
    ranks.set(entry.id, currentRank);
  }
  return ranks;
}

/** Appréciation (échelle du secondaire Helm). */
export function appreciationFor(average: number | null): string {
  if (average === null) return '—';
  if (average >= 16) return 'Très Bien';
  if (average >= 14) return 'Bien';
  if (average >= 12) return 'Assez Bien';
  if (average >= 10) return 'Passable';
  if (average >= 8) return 'Insuffisant';
  return 'Faible';
}

/** Mention nationale (barème du palmarès Federis). */
export function mentionFor(average: number | null): string {
  if (average === null) return '—';
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  return 'Passable';
}

/** 1er / 1re / 2e / 3e… (pattern formatRank des bulletins Helm). */
export function formatRankFr(rank: number | null | undefined, female?: boolean): string {
  if (rank === null || rank === undefined) return '—';
  if (rank === 1) return female ? '1re' : '1er';
  return `${rank}e`;
}

/** Note formatée : 15 → « 15 », 12.5 → « 12,50 », null → « — ». */
export function fmtNote(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return fixed.replace('.', ',');
}

/** Format d'affichage d'un candidat selon le mode (identité ou anonymat). */
export function candidateDisplayName(
  c: { firstName: string; lastName: string; anonymatCode: string | null; matricule: string },
  anonymous: boolean,
): { main: string; sub: string } {
  if (anonymous) {
    return {
      main: c.anonymatCode ?? 'Sans anonymat',
      sub: c.anonymatCode ? 'Identité masquée' : c.matricule,
    };
  }
  return {
    main: `${c.lastName} ${c.firstName}`,
    sub: c.matricule,
  };
}
