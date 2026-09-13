/**
 * ============================================================================
 * OFFLINE READINESS — état de préparation hors ligne (v4.1.0)
 * ============================================================================
 *
 * ⭐ Exigence produit (sept. 2026) : « l'utilisateur doit savoir À TEL MOMENT
 *    il peut couper sa connexion (économiser son forfait internet) et
 *    continuer à travailler ». Ce store agrège la progression du pré-cache :
 *    routes des modules (poids 25 %) + vague 1 des données API (50 %) +
 *    vague 2 dynamique (25 %) → progression 0..1 + phase.
 *
 * Sources : module-precache.service (routes + vagues API) pousse des « marks »
 * ici ; le composant OfflineReadinessIndicator s'abonne et affiche :
 *   - pill discrète « Préparation hors ligne · NN % » pendant le téléchargement ;
 *   - toast vert UNE FOIS quand tout est prêt : « vous pouvez couper votre
 *     connexion et continuer à travailler ».
 *
 * Ce module est volontairement SANS dépendance (pas d'import de React ni du
 * service de pré-cache) : il est la brique la plus basse — le service et le
 * composant pointent vers lui (aucun cycle d'imports).
 */

'use client';

export type OfflineReadinessPhase =
  | 'idle'        // évaluation initiale pas encore faite / pas de run
  | 'preparing'   // un pré-cache est en cours
  | 'ready'       // routes + données API fraîches (< 24 h)
  | 'incomplete'; // run terminé mais incomplet → retry au retour réseau

export interface OfflineReadinessState {
  phase: OfflineReadinessPhase;
  /** Progression globale 0..1 (routes 25 % + vague 1 50 % + vague 2 25 %). */
  progress: number;
  routesDone: number;
  routesTotal: number;
  /** Vague 1 (statique ~290 endpoints) — données de tous les onglets. */
  wave1Done: number;
  wave1Total: number;
  /** Vague 2 (dynamique par entité) — notes/EDT/comptes élèves/cdd… */
  wave2Done: number;
  wave2Total: number;
  /** Timestamp du dernier passage en état prêt (null si jamais). */
  readyAt: number | null;
}

/** Événement DOM diffusé à chaque changement (le composant écoute). */
export const OFFLINE_READINESS_EVENT = 'offline-readiness-change';

const READY_AT_KEY = 'academia_helm_offline_ready_at';

/** Poids relatifs des 3 segments de progression. */
const W_ROUTES = 0.25;
const W_WAVE1 = 0.5;
const W_WAVE2 = 0.25;

/** Throttle d'émission des événements de progression (ms). */
const EMIT_THROTTLE_MS = 400;

let state: OfflineReadinessState = {
  phase: 'idle',
  progress: 0,
  routesDone: 0,
  routesTotal: 0,
  wave1Done: 0,
  wave1Total: 0,
  wave2Done: 0,
  wave2Total: 0,
  readyAt: readStoredReadyAt(),
};

let lastEmit = 0;
let emitTimer: ReturnType<typeof setTimeout> | null = null;

function readStoredReadyAt(): number | null {
  try {
    const v = Number(localStorage.getItem(READY_AT_KEY) || 0);
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function computeProgress(s: OfflineReadinessState): number {
  // En état « prêt », la progression est complète par définition (les segments
  // peuvent être désynchronisés si un run de rafraîchissement a fini plus tôt)
  if (s.phase === 'ready') return 1;
  const routes = s.routesTotal > 0 ? s.routesDone / s.routesTotal : 0;
  const w1 = s.wave1Total > 0 ? s.wave1Done / s.wave1Total : 0;
  const w2 = s.wave2Total > 0 ? s.wave2Done / s.wave2Total : 0;
  return Math.min(1, routes * W_ROUTES + w1 * W_WAVE1 + w2 * W_WAVE2);
}

function emitNow(): void {
  lastEmit = Date.now();
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_READINESS_EVENT, { detail: { ...state } }));
  } catch {
    /* environnement sans CustomEvent — le composant retombera sur le polling */
  }
}

/** Diffusion immédiate pour un changement de PHASE, throttlée pour la pure progression. */
function emit(phaseChanged: boolean): void {
  if (phaseChanged) {
    if (emitTimer) { clearTimeout(emitTimer); emitTimer = null; }
    emitNow();
    return;
  }
  if (Date.now() - lastEmit >= EMIT_THROTTLE_MS) {
    emitNow();
    return;
  }
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    emitNow();
  }, EMIT_THROTTLE_MS);
}

function patch(next: Partial<OfflineReadinessState>, phaseChanged = false): void {
  state = { ...state, ...next };
  state.progress = computeProgress(state);
  emit(phaseChanged);
}

/* ═══ API « marks » — appelée par module-precache.service ══════════════════ */

/** Progression du pré-cache des ROUTES (poids 25 %). */
export function markRoutesProgress(done: number, total: number): void {
  if (state.phase === 'ready') return; // un run de rafraîchissement ne doit pas régresser l'état affiché
  const phaseChanged = state.phase === 'idle';
  patch({ routesDone: done, routesTotal: total, phase: 'preparing' }, phaseChanged);
}

/** Progression d'une vague de données API (1 = statique, 2 = dynamique). */
export function markWaveProgress(wave: 1 | 2, done: number, total: number): void {
  if (state.phase === 'ready') return;
  const phaseChanged = state.phase === 'idle';
  if (wave === 1) {
    patch({ wave1Done: done, wave1Total: total, phase: 'preparing' }, phaseChanged);
  } else {
    patch({ wave2Done: done, wave2Total: total, phase: 'preparing' }, phaseChanged);
  }
}

/**
 * Fin d'un run complet (routes ou vagues) : « prêt » uniquement si les DEUX
 * flags (routes + données API) sont posés — sinon « incomplete » → le layout
 * retentera au prochain montage / retour du réseau.
 */
export function markRunFinished(routesOk: boolean, apiOk: boolean): void {
  const now = Date.now();
  if (routesOk && apiOk) {
    try { localStorage.setItem(READY_AT_KEY, String(now)); } catch { /* noop */ }
    patch({ phase: 'ready', readyAt: now, progress: 1 }, true);
  } else {
    patch({ phase: 'incomplete' }, true);
  }
}

/** État initial : l'app est déjà prête (flags < 24 h) — SILENCIEUX (pas de toast). */
export function markInitialReady(): void {
  const now = Date.now();
  const stored = readStoredReadyAt();
  try { if (!stored) localStorage.setItem(READY_AT_KEY, String(now)); } catch { /* noop */ }
  patch({ phase: 'ready', readyAt: stored || now, progress: 1 }, true);
}

/** Une nouvelle version du SW s'active → invalidation → retour à l'évaluation. */
export function resetOfflineReadiness(): void {
  try { localStorage.removeItem(READY_AT_KEY); } catch { /* noop */ }
  patch({
    phase: 'idle', progress: 0,
    routesDone: 0, routesTotal: 0,
    wave1Done: 0, wave1Total: 0,
    wave2Done: 0, wave2Total: 0,
    readyAt: null,
  }, true);
}

/* ═══ API « read » — appelée par le composant ═══════════════════════════════ */

export function getOfflineReadiness(): OfflineReadinessState {
  return { ...state };
}
