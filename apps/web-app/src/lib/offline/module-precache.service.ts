/**
 * ============================================================================
 * MODULE PRECACHE SERVICE — Pré-cache tous les chunks JS des modules au login
 * ============================================================================
 *
 * ⭐ RÔLE : au bootstrap (1er login sur un device), pré-cacher TOUTES les
 *    routes /app/* pour que l'utilisateur puisse naviguer en offline vers
 *    N'IMPORTE QUEL module sans avoir besoin de l'avoir visité en online avant.
 *
 *    Avant : seuls les modules visités en online étaient cachés (StaleWhileRevalidate)
 *    → en offline, un module non visité affichait "pas de données" ou page blanche
 *    Maintenant : au login, on fetch toutes les routes /app/* en arrière-plan
 *    → le SW les met en cache → tous les modules accessibles offline
 *
 * ⭐ FLUX :
 *    1. Bootstrap IDB (30 tables essentielles) → données métier
 *    2. Module precache (121 routes) → chunks JS + HTML de chaque module
 *    3. L'utilisateur peut couper internet et naviguer partout
 *
 * ⭐ PERFORMANCE :
 *    - 121 routes × ~50-200KB chacune = ~6-24 MB total
 *    - Fetch en parallèle (batch de 5) → ~30-60s au login
 *    - Fire-and-forget (non bloquant — l'utilisateur peut utiliser l'app pendant)
 * ============================================================================
 */

const MODULE_ROUTES: string[] = [
  // ─── Modules principaux ───
  '/app',
  '/app/finance',
  '/app/finance/accounts',
  '/app/finance/fees',
  '/app/finance/payments',
  '/app/finance/collection-summary',
  '/app/finance/collection',
  '/app/finance/expenses',
  '/app/finance/cash-registers',
  '/app/finance/treasury',
  '/app/finance/aggregation',
  '/app/finance/reports',
  '/app/finance/audit',
  '/app/finance/settings',
  '/app/students',
  '/app/students/enrollments',
  '/app/students/classes',
  '/app/students/attendance',
  '/app/students/discipline',
  '/app/students/documents',
  '/app/students/id-cards',
  '/app/students/guardians',
  '/app/students/aggregation',
  '/app/hr',
  '/app/hr/staff',
  '/app/hr/contracts',
  '/app/hr/planning',
  '/app/hr/reporting',
  '/app/hr/cnss',
  '/app/hr/taxes',
  '/app/pedagogy',
  '/app/pedagogy/daily-logs',
  '/app/pedagogy/class-logs',
  '/app/pedagogy/subjects',
  '/app/pedagogy/teachers',
  '/app/pedagogy/timetables',
  '/app/pedagogy/academic-levels',
  '/app/pedagogy/academic-series',
  '/app/pedagogy/academic-cycles',
  '/app/pedagogy/rooms',
  '/app/pedagogy/control',
  '/app/pedagogy/weekly-reports',
  '/app/exams',
  '/app/exams/evaluations',
  '/app/exams/grades',
  '/app/exams/bulletins',
  '/app/exams/councils',
  '/app/exams/analytics',
  '/app/exams/audit',
  '/app/exams/registre',
  '/app/exams/settings',
  '/app/exams/unlock-requests',
  '/app/exams/validation',
  '/app/communication',
  '/app/communication/dashboard',
  '/app/communication/messages',
  '/app/communication/templates',
  '/app/communication/inbox',
  '/app/communication/history',
  '/app/communication/scheduled-emails',
  '/app/canteen',
  '/app/cms',
  '/app/educast',
  '/app/infirmary',
  '/app/library',
  '/app/parent',
  '/app/qhse',
  '/app/saisiemaster',
  '/app/settings',
  '/app/shop',
  '/app/teacher',
  '/app/transport',
];

const BATCH_SIZE = 5; // 5 routes en parallèle
const FETCH_TIMEOUT_MS = 10000; // 10s par route

/**
 * Garde anti-répétition : re-pré-cache au plus 1×/24 h (et après chaque
 * logout/invalidation). Un flag booléen à vie cassait la navigation offline
 * après chaque déploiement (nouveaux chunks jamais pré-cachés).
 */
const PRECACHE_TS_KEY = 'academia_helm_modules_precached_at';
const PRECACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/** ⭐ v3.3.1 — Version du SW au moment du dernier pré-cache.
 *    Les caches du SW sont VERSIONNÉS (ah-pages-v3.3.1…) et PURGÉS à chaque
 *    nouvelle version du SW, mais l'ancien flag 24 h (localStorage) survivait
 *    au bump → le pré-cache était esquivé alors que les caches venaient d'être
 *    vidés → PLUS AUCUN module offline après un déploiement (le shell du
 *    dashboard était servi à la place des modules). Désormais le flag n'est
 *    valable QUE s'il correspond à la version ACTIVE du SW.
 */
const PRECACHE_SW_VERSION_KEY = 'academia_helm_precache_sw_version';

/** Retourne true si un pré-cache a été fait il y a moins de 24 h. */
function isPrecacheFresh(): boolean {
  try {
    const ts = Number(localStorage.getItem(PRECACHE_TS_KEY) || 0);
    return ts > 0 && Date.now() - ts < PRECACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Version enregistrée lors du dernier pré-cache (null si absente). */
function getStoredPrecacheVersion(): string | null {
  try {
    return localStorage.getItem(PRECACHE_SW_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * ⭐ v3.3.1 — Version du SW ACTIF, demandée au SW via message (réponse
 *    SW_VERSION). Null si le SW ne répond pas (ancienne version sans le
 *    handler, timeout, SW non installé) → l'appelant re-pré-cache (sécurité).
 */
function getActiveSwVersion(timeoutMs = 2000): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      resolve(null);
      return;
    }
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
    const done = (version: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(version);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_VERSION' && event.data.version) {
        done(String(event.data.version));
      }
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker
      .ready
      .then((registration) => {
        const sw = registration.active;
        if (!sw) {
          done(null);
          return;
        }
        sw.postMessage({ type: 'GET_SW_VERSION' });
      })
      .catch(() => done(null));
  });
}

let swActivatedListenerBound = false;

/**
 * ⭐ v3.3.1 — Écoute les activations de NOUVELLES versions du SW : à chaque
 *    bump, les caches ah-pages-<version> sont purgés → on invalide le flag
 *    24 h pour que le pré-cache soit refait dès que possible (montage suivant
 *    ou retour du réseau). À appeler une fois au montage de l'app.
 */
export function initModulePrecacheInvalidation(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (swActivatedListenerBound) return;
  swActivatedListenerBound = true;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_ACTIVATED') {
      console.log(`[ModulePrecache] SW ${event.data.version} activé — invalidation du flag de pré-cache (caches purgés)`);
      invalidateModulePrecache();
    }
  });
}

/**
 * Pré-cache tous les modules en demandant au Service Worker de fetcher
 * chaque route + parser le HTML pour extraire et cacher les chunks JS/CSS.
 *
 * Le SW fait le travail efficace (parse HTML + fetch chunks en parallèle).
 * Le client se contente d'envoyer des messages `PRECACHE_MODULE` au SW.
 *
 * Fire-and-forget — non bloquant pour l'utilisateur.
 *
 * @param onProgress callback optionnel (current, total)
 */
export async function precacheAllModules(
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!navigator.onLine) {
    console.log('[ModulePrecache] Offline — skipping');
    return;
  }

  // ⭐ Vérifier si déjà pré-caché récemment pour ce device (1×/24 h)
  //    ⭐ v3.3.1 — ET pour la version ACTIVE du SW : les caches ah-pages-*
  //    sont purgés à chaque nouvelle version du SW ; un flag « frais » d'une
  //    version précédente ne vaut plus rien. Si le SW ne répond pas (null),
  //    on re-pré-cache (par sécurité — coût : quelques MB refetchés).
  const activeVersion = await getActiveSwVersion();
  const storedVersion = getStoredPrecacheVersion();
  if (isPrecacheFresh() && activeVersion && storedVersion === activeVersion) {
    console.log(`[ModulePrecache] Fresh (<24 h, SW ${storedVersion}) — skipping`);
    return;
  }

  console.log(`[ModulePrecache] Starting — ${MODULE_ROUTES.length} routes to cache`);
  const startTime = Date.now();

  // ⭐ Attendre que le SW soit prêt
  const registration = await navigator.serviceWorker.ready;
  const sw = registration.active;
  if (!sw) {
    console.warn('[ModulePrecache] No active SW — skipping');
    return;
  }

  let completed = 0;
  const total = MODULE_ROUTES.length;

  // Traiter par batches de BATCH_SIZE
  for (let i = 0; i < MODULE_ROUTES.length; i += BATCH_SIZE) {
    const batch = MODULE_ROUTES.slice(i, i + BATCH_SIZE);

    // ⭐ Envoyer un message PRECACHE_MODULE au SW pour chaque route
    //    Le SW fetch la route + parse le HTML + cache les chunks JS/CSS
    await Promise.allSettled(
      batch.map(async (route) => {
        try {
          // Construire l'URL absolue
          const absoluteUrl = new URL(route, window.location.origin).href;

          // Envoyer le message au SW
          // ⭐ Le SW ne renvoie pas de réponse — on attend juste un peu
          //    pour étaler la charge. Le SW fait le travail en arrière-plan.
          sw.postMessage({
            type: 'PRECACHE_MODULE',
            url: absoluteUrl,
          });

          // Petite attente pour ne pas saturer le SW
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.warn(`[ModulePrecache] Failed: ${route}`, err instanceof Error ? err.message : '');
        } finally {
          completed++;
          onProgress?.(completed, total);
        }
      }),
    );

    // Pause entre les batches
    if (i + BATCH_SIZE < MODULE_ROUTES.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[ModulePrecache] Complete — ${completed}/${total} routes dispatched to SW in ${duration}s`);

  // ⭐ Marquer comme pré-caché (le SW continue en arrière-plan) — timestamp
  //    pour re-pré-cacher demain (nouveaux déploiements = nouveaux chunks)
  //    + version du SW pour détecter les bumps (caches purgés → re-pré-cache)
  try {
    localStorage.setItem(PRECACHE_TS_KEY, String(Date.now()));
    if (activeVersion) {
      localStorage.setItem(PRECACHE_SW_VERSION_KEY, activeVersion);
    } else {
      localStorage.removeItem(PRECACHE_SW_VERSION_KEY); // version inconnue → re-pré-cache au prochain montage
    }
    localStorage.removeItem('academia_helm_modules_precached'); // legacy
  } catch {
    /* localStorage indisponible — le pré-cache se refera au prochain montage */
  }
}

/**
 * Invalide le flag de pré-cache (à appeler au logout ou changement de tenant,
 * ou automatiquement quand une nouvelle version du SW s'active).
 */
export function invalidateModulePrecache(): void {
  try {
    localStorage.removeItem(PRECACHE_TS_KEY);
    localStorage.removeItem(PRECACHE_SW_VERSION_KEY); // ⭐ v3.3.1
    localStorage.removeItem('academia_helm_modules_precached'); // legacy
  } catch {
    /* noop */
  }
}
