/**
 * ============================================================================
 * MODULE PRECACHE SERVICE — Pré-cache HTML + RSC + chunks JS des modules
 * ============================================================================
 *
 * ⭐ RÔLE : au bootstrap (1er login sur un device), pré-cacher TOUTES les
 *    routes /app/* pour que l'utilisateur puisse naviguer en offline vers
 *    N'IMPORTE QUEL module sans avoir besoin de l'avoir visité en online avant.
 *
 * ⭐ FLUX :
 *    1. Bootstrap IDB (30 tables essentielles) → données métier
 *    2. Module precache (121 routes) → chunks JS + HTML + payload RSC
 *    3. L'utilisateur peut couper internet et naviguer partout
 *
 * ⭐ v3.4.0 — FIABILISATION (retour terrain sept. 2026 : « connexion
 *    indisponible pour /app/pedagogy » hors ligne) :
 *    - ANCIENNEMENT fire-and-forget : le flag 24 h était posé au DISPATCH
 *      des messages, avant tout résultat → un pré-cache à moitié échoué
 *      (timeouts 2G/3G silencieux) passait pour « frais » → modules
 *      manquants offline pendant 24 h.
 *    - Désormais le SW ACK chaque route (PRECACHE_MODULE_RESULT) ; le flag
 *      n'est posé QUE si ≥ 90 % des routes ont réussi (retries incluses),
 *      sinon le pré-cache sera retenté au prochain montage / au retour du
 *      réseau (listener « online » du layout-client).
 *    - Les URLs de pré-cache portent le ?tenant= courant : les navigations
 *      réelles de l'app (sidebar /app/pedagogy?tenant=…) matchent les
 *      entrées de cache EXACTEMENT (le SW matche aussi en ignoreSearch en
 *      secours).
 *    - Garde de concurrence : mount + listener online ne déclenchent qu'une
 *      seule exécution à la fois.
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
// (le fetch effectif est fait par le SW — timeout 10 s côté sw.js precacheModule)

/** ⭐ v3.4.0 — Attente max des ACK du SW par passe (fetch 10 s + marge). */
const ACK_TIMEOUT_MS = 30000;
/** ⭐ v3.4.0 — Passe initiale + 2 retries pour les routes échouées. */
const MAX_PASSES = 3;
/** ⭐ v3.4.0 — Taux de réussite minimum pour poser le flag 24 h. */
const MIN_SUCCESS_RATE = 0.9;

/** ⭐ v3.4.0 — Garde de concurrence (mount + listener online simultanés). */
let inFlightRun: Promise<void> | null = null;

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
 * chaque route + parser le HTML pour extraire et cacher les chunks JS/CSS
 * (+ le payload RSC de la route, best-effort — sw.js v3.4.0).
 *
 * ⭐ v3.4.0 — FIABILISÉ :
 *   - le SW ACK chaque route (PRECACHE_MODULE_RESULT) ;
 *   - les routes échouées sont retentées (MAX_PASSES au total) ;
 *   - le flag 24 h n'est posé QUE si ≥ MIN_SUCCESS_RATE des routes ont
 *     réussi — sinon le pré-cache sera retenté au prochain montage / au
 *     retour du réseau (fini le flag optimiste posé au dispatch).
 *   - les URLs portent le ?tenant= courant (les navigations réelles de
 *     l'app l'ont aussi) ;
 *   - garde de concurrence (mount + listener « online »).
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

  // ⭐ v3.4.0 — Garde de concurrence : le layout appelle run() au montage ET
  //    au retour du réseau — une seule exécution à la fois.
  if (inFlightRun) return inFlightRun;

  inFlightRun = runPrecache(activeVersion, onProgress).finally(() => {
    inFlightRun = null;
  });
  return inFlightRun;
}

/** ⭐ v3.4.0 — Cœur du pré-cache (ACK-based, retries, flag conditionnel). */
async function runPrecache(
  activeVersion: string | null,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const startTime = Date.now();

  // ⭐ Attendre que le SW soit prêt
  const registration = await navigator.serviceWorker.ready;
  const sw = registration.active;
  if (!sw) {
    console.warn('[ModulePrecache] No active SW — skipping');
    return;
  }

  // ⭐ v3.4.0 — Contexte tenant courant : les URLs de l'app portent toutes
  //    ?tenant=… (mode multi-tenant SANS sous-domaine) — le pré-cache doit
  //    stocker les MÊMES URLs pour que Cache.match fonctionne hors ligne.
  const tenantQuery = buildTenantQuery();
  const routeUrls = MODULE_ROUTES.map((route) => buildRouteUrl(route, tenantQuery));
  const total = routeUrls.length;

  console.log(
    `[ModulePrecache] Starting — ${total} routes to cache` +
      (tenantQuery ? ` (tenant: ${tenantQuery.split('&')[0]})` : ''),
  );

  // ⭐ v3.4.0 — Écoute des ACK du SW (résultat réel par route)
  const results = new Map<string, boolean>();
  const onMessage = (event: MessageEvent) => {
    const data = event.data as
      | { type?: string; url?: string; ok?: boolean; rscOk?: boolean }
      | null;
    if (data?.type === 'PRECACHE_MODULE_RESULT' && typeof data.url === 'string') {
      results.set(data.url, Boolean(data.ok));
    }
  };
  navigator.serviceWorker.addEventListener('message', onMessage);

  try {
    let pending = routeUrls;
    let dispatchedTotal = 0;

    // ⭐ Passe initiale + retries des échecs (MAX_PASSES au total)
    for (let pass = 1; pass <= MAX_PASSES && pending.length > 0; pass++) {
      if (!navigator.onLine) {
        console.warn(`[ModulePrecache] Connection perdue (passe ${pass}) — arrêt`);
        break;
      }

      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);

        await Promise.allSettled(
          batch.map(async (url) => {
            try {
              sw.postMessage({ type: 'PRECACHE_MODULE', url });
              dispatchedTotal++;
              onProgress?.(Math.min(dispatchedTotal, total), total);
              // Petite attente pour ne pas saturer le SW
              await new Promise((r) => setTimeout(r, 500));
            } catch (err) {
              console.warn(
                `[ModulePrecache] Dispatch failed: ${url}`,
                err instanceof Error ? err.message : '',
              );
            }
          }),
        );

        // Pause entre les batches
        if (i + BATCH_SIZE < pending.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // ⭐ v3.4.0 — Attendre les ACK de cette passe (le SW fetch ~10 s/route)
      await waitForAcks(results, pending, ACK_TIMEOUT_MS);

      const failed = pending.filter((url) => !results.get(url));
      if (failed.length === 0) break;
      if (pass < MAX_PASSES) {
        console.warn(
          `[ModulePrecache] Passe ${pass}: ${failed.length}/${pending.length} routes échouées — retry`,
        );
      }
      pending = failed;
    }

    // ⭐ v3.4.0 — Bilan RÉEL (ACK-based) : le flag n'est posé que si ≥ 90 %
    const okCount = routeUrls.filter((url) => results.get(url)).length;
    const successRate = okCount / total;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[ModulePrecache] Complete — ${okCount}/${total} routes cached ` +
        `(${(successRate * 100).toFixed(0)}%) in ${duration}s`,
    );

    if (successRate >= MIN_SUCCESS_RATE && navigator.onLine) {
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
    } else {
      // ⚠️ PAS de flag : le pré-cache incomplet sera retenté au prochain
      // montage (15 s) ou au retour du réseau (listener « online »).
      console.warn(
        `[ModulePrecache] Succès insuffisant (${okCount}/${total}) — flag NON posé, retry au prochain montage/online`,
      );
    }
  } finally {
    navigator.serviceWorker.removeEventListener('message', onMessage);
  }
}

/** ⭐ v3.4.0 — Query string tenant courant (mode multi-tenant sans sous-domaine).
 *  Priorité : URL courante (?tenant= / ?tenant_id=) puis session localStorage. */
function buildTenantQuery(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    let tenant = params.get('tenant') || '';
    let tenantId = params.get('tenant_id') || '';
    if (!tenant || !tenantId) {
      const raw = localStorage.getItem('session');
      if (raw) {
        const session = JSON.parse(raw) as {
          tenantId?: string;
          tenant?: { id?: string; slug?: string; subdomain?: string };
        };
        tenant = tenant || session.tenant?.slug || session.tenant?.subdomain || '';
        tenantId = tenantId || session.tenantId || session.tenant?.id || '';
      }
    }
    const parts: string[] = [];
    if (tenant) parts.push(`tenant=${encodeURIComponent(tenant)}`);
    if (tenantId) parts.push(`tenant_id=${encodeURIComponent(tenantId)}`);
    return parts.join('&');
  } catch {
    return '';
  }
}

/** ⭐ v3.4.0 — URL absolue de la route avec le query tenant courant. */
function buildRouteUrl(route: string, tenantQuery: string): string {
  const base = new URL(route, window.location.origin).href;
  if (!tenantQuery) return base;
  return base + (base.includes('?') ? '&' : '?') + tenantQuery;
}

/** ⭐ v3.4.0 — Attend (poll léger) que toutes les URLs données aient reçu
 *  leur ACK du SW, ou le timeout (les ACK manquants comptent échecs). */
function waitForAcks(results: Map<string, boolean>, urls: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const allSettled = urls.every((u) => results.has(u));
      if (allSettled || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
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
