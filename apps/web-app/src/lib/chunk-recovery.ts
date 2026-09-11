/**
 * Récupération des échecs de chargement de chunks JS/CSS.
 *
 * ⭐ PROBLÈME ADRESSÉ (sept. 2026) — erreur vue en production :
 *    « Failed to load chunk /_next/static/immutable/chunks/1vmyhiw7yj5em.js
 *     from module 172724 »
 *
 *    Sur réseau instable (2G/3G, canicule réseau au Bénin) ou juste après un
 *    déploiement (les chunks du build précédent n'existent plus côté serveur),
 *    le runtime Turbopack/webpack échoue à charger un chunk → l'error boundary
 *    affichait une erreur générique disgracieuse, parfois en purgeant TOUT le
 *    cache offline (contre-productif) ou en rechargant en boucle.
 *
 * ⛔ NE JAMAIS purger le Cache Storage sur ces erreurs : les chunks
 *    /_next/static/ sont immuables et mis en cache par le SW ; les purger
 *    détruirait le mode hors-ligne et imposerait un re-téléchargement complet
 *    sur un réseau déjà fragile.
 *
 * ✅ Stratégie : rechargement automatique LIMITÉ (anti-boucle) —
 *    un reload résout les DEUX causes :
 *      - déploiement récent → le HTML frais référence les nouveaux chunks ;
 *      - réseau instable    → nouvelle tentative de chargement (le SW sert
 *        le chunk depuis son cache s'il l'a déjà).
 */

'use client';

/** Clé sessionStorage de l'état anti-boucle. */
const RELOAD_STATE_KEY = 'ah_chunk_reload_state';

/** Fenêtre glissante pendant laquelle on limite les reloads auto. */
const WINDOW_MS = 60_000;

/** Nombre max de rechargements AUTOMATIQUES dans la fenêtre. */
const MAX_AUTO_RELOADS = 2;

/** Délai avant rechargement (laisse le temps à l'UI d'erreur de s'afficher). */
const RELOAD_DELAY_MS = 600;

interface ReloadState {
  /** timestamp du dernier reload déclenché */
  t: number;
  /** nombre de reloads dans la fenêtre courante */
  n: number;
}

/**
 * Détecte un échec de chargement de chunk/module, tous runtimes confondus.
 *
 * - Turbopack (Next 15/16) : « Failed to load chunk /_next/static/... from module 172724 »
 * - webpack : « Loading chunk 12 failed. », « Loading CSS chunk 12 failed. »,
 *   « ChunkLoadError »
 * - import() navigateur : « Failed to fetch dynamically imported module ... »,
 *   « Error loading dynamically imported module ... »
 * - Safari : « Importing a module script failed. »
 */
export function isChunkLoadFailure(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('failed to load chunk') || // ⭐ Turbopack Next 15/16 — le cas production
    m.includes('loading chunk') ||
    m.includes('loading css chunk') ||
    m.includes('chunkloaderror') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('importing a module script failed') ||
    m.includes('error loading module script')
  );
}

/**
 * Détecte un échec de chargement depuis l'évènement brut `error` :
 * les <script>/<link> qui échouent ne portent pas de message — la cible
 * porte l'URL du chunk.
 */
export function isChunkResourceFailure(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement & { src?: string; href?: string };
  const url = el?.src || el?.href || '';
  return /\/_next\/static\/[^?]+\.(?:js|css)(?:\?|$)/.test(url);
}

function readState(): ReloadState | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReloadState;
    if (typeof parsed?.t !== 'number' || typeof parsed?.n !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Rechargement auto autorisé ? (max N reloads par fenêtre de 60 s) */
function canAutoReload(): boolean {
  const s = readState();
  if (!s) return true;
  if (Date.now() - s.t > WINDOW_MS) return true; // fenêtre expirée → repart à zéro
  return s.n < MAX_AUTO_RELOADS;
}

function markReload(): void {
  try {
    const prev = readState();
    const expired = !prev || Date.now() - prev.t > WINDOW_MS;
    const state: ReloadState = {
      t: Date.now(),
      n: expired ? 1 : prev!.n + 1,
    };
    sessionStorage.setItem(RELOAD_STATE_KEY, JSON.stringify(state));
  } catch {
    /* sessionStorage indisponible (mode privé Safari) — on recharge quand même */
  }
}

let scheduled = false;

/**
 * Programme un rechargement AUTOMATIQUE si la garde anti-boucle l'autorise.
 * Retourne true si le reload a été programmé, false sinon (garde active :
 * l'appelant doit alors afficher l'UI d'erreur avec bouton manuel).
 */
export function scheduleChunkRecoveryReload(delayMs: number = RELOAD_DELAY_MS): boolean {
  if (typeof window === 'undefined') return false;
  if (scheduled) return true; // déjà programmé
  if (!canAutoReload()) return false;
  scheduled = true;
  markReload();
  setTimeout(() => window.location.reload(), delayMs);
  return true;
}

/**
 * Rechargement MANUEL (bouton « Récharger ») — outrepasse la garde anti-boucle
 * (l'utilisateur a décidé) mais marque le reload pour éviter qu'un auto-reload
 * ultérieur ne s'ajoute en boucle.
 */
export function forceChunkRecoveryReload(): void {
  if (typeof window === 'undefined') return;
  markReload();
  window.location.reload();
}

/**
 * À appeler dans un error boundary : détecte l'échec de chunk et déclenche
 * la récupération automatique (sans purge de cache).
 * Retourne true si l'erreur est bien un échec de chunk.
 */
export function recoverFromChunkError(error: { message?: string } | null | undefined): boolean {
  if (!isChunkLoadFailure(error?.message)) return false;
  scheduleChunkRecoveryReload();
  return true;
}

/**
 * Garde anti-boucle déjà épuisée ? (lecture pure — pour l'affichage UI via
 * useState(() => hasExhaustedAutoReloads()), évite tout setState dans un effet.)
 */
export function hasExhaustedAutoReloads(): boolean {
  if (typeof window === 'undefined') return false;
  const s = readState();
  if (!s) return false;
  if (Date.now() - s.t > WINDOW_MS) return false;
  return s.n >= MAX_AUTO_RELOADS;
}
