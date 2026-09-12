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

/**
 * ⭐ v3.5.0 — LISTE COMPLÈTE des routes /app/* (112 routes STATIQUES réelles,
 *    énumérées depuis tous les page.tsx sous src/app/app — hors routes
 *    dynamiques [id]).
 *    ANCIENNEMENT (v3.4) : 72 routes « à la main » → ~40 routes manquantes,
 *    dont /app/pedagogy/academic-structure (retour terrain : « connexion
 *    indisponible pour /app/pedagogy/academic-structure » hors ligne).
 *    Les routes inexistantes de l'ancienne liste (ex. /app/students/enrollments)
 *    ont été retirées (404 au pré-cache = ACK échoué = retries inutiles).
 */
const MODULE_ROUTES: string[] = [
  // ─── Racine + portails par rôle ───
  '/app',
  '/app/censeur',
  '/app/comptable',
  '/app/director',
  '/app/director/oversight',
  '/app/discipline',
  '/app/secretaire',
  '/app/secretaire-comptable',
  '/app/surveillant',
  // ─── Cantine / CMS / EduCast / Infirmerie / Bibliothèque / QHSE / Shop ───
  '/app/canteen',
  '/app/cms',
  '/app/educast',
  '/app/infirmary',
  '/app/library',
  '/app/qhse',
  '/app/shop',
  '/app/saisiemaster',
  '/app/transport',
  // ─── Communication ───
  '/app/communication',
  '/app/communication/dashboard',
  '/app/communication/history',
  '/app/communication/inbox',
  '/app/communication/messages',
  '/app/communication/scheduled-emails',
  '/app/communication/templates',
  // ─── Examens ───
  '/app/exams',
  '/app/exams/analytics',
  '/app/exams/audit',
  '/app/exams/bulletins',
  '/app/exams/councils',
  '/app/exams/evaluations',
  '/app/exams/grades',
  '/app/exams/recap',
  '/app/exams/registre',
  '/app/exams/settings',
  '/app/exams/unlock-requests',
  '/app/exams/validation',
  // ─── Finances ───
  '/app/finance',
  '/app/finance/accounts',
  '/app/finance/aggregation',
  '/app/finance/audit',
  '/app/finance/cash-registers',
  '/app/finance/collection',
  '/app/finance/collection-summary',
  '/app/finance/expenses',
  '/app/finance/fees',
  '/app/finance/general-fees',
  '/app/finance/overrides',
  '/app/finance/payments',
  '/app/finance/reports',
  '/app/finance/settings',
  '/app/finance/treasury',
  // ─── RH ───
  '/app/hr',
  '/app/hr/administration',
  '/app/hr/allowances',
  '/app/hr/attendance',
  '/app/hr/cnss',
  '/app/hr/collaborators',
  '/app/hr/contracts',
  '/app/hr/embauche',
  '/app/hr/ia',
  '/app/hr/internships',
  '/app/hr/leaves',
  '/app/hr/payroll',
  '/app/hr/planning',
  '/app/hr/recruitment',
  '/app/hr/recruitment/settings',
  '/app/hr/reporting',
  '/app/hr/settings',
  '/app/hr/staff',
  // ─── Parents ───
  '/app/parent',
  '/app/parent/attendance',
  '/app/parent/cahier-journal',
  '/app/parent/children',
  '/app/parent/documents',
  '/app/parent/messages',
  '/app/parent/payments',
  '/app/parent/results',
  '/app/parent/tasks',
  '/app/parent/timetable',
  // ─── Pédagogie ───
  '/app/pedagogy',
  '/app/pedagogy/academic-structure',
  '/app/pedagogy/annual-planning',
  '/app/pedagogy/assignments',
  '/app/pedagogy/class-diaries',
  '/app/pedagogy/control',
  '/app/pedagogy/control-en',
  '/app/pedagogy/global-library',
  '/app/pedagogy/orion',
  '/app/pedagogy/pedagogical-materials',
  '/app/pedagogy/production',
  '/app/pedagogy/production-en',
  '/app/pedagogy/sara-compose',
  '/app/pedagogy/subjects',
  '/app/pedagogy/tasks',
  '/app/pedagogy/teachers',
  '/app/pedagogy/timetable-engine',
  '/app/pedagogy/timetables',
  // ─── Paramètres ───
  '/app/settings',
  '/app/settings/billing',
  // ─── Élèves ───
  '/app/students',
  // ─── Enseignants ───
  '/app/teacher',
  '/app/teacher/annual-planning',
  '/app/teacher/classes',
  '/app/teacher/communication',
  '/app/teacher/educast',
  '/app/teacher/exams',
  '/app/teacher/library',
  '/app/teacher/orion',
  '/app/teacher/pedagogy',
  '/app/teacher/tasks',
  '/app/teacher/timetable',
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
    localStorage.removeItem(API_PRECACHE_TS_KEY); // ⭐ v3.5.0 — données KPI aussi
  } catch {
    /* noop */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * ⭐ v3.5.0 — PRÉ-CACHE DES DONNÉES API (KPIs des dashboards)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * PROBLÈME (retour terrain, sept. 2026) : « je me suis connecté, j'ai coupé
 * la connexion, je suis passé sur un autre module → affiché mais avec de
 * FAUSSES données (KPI faux) ». Cause : les réponses API n'étaient mises en
 * cache par le SW (ah-api) qu'au moment où la page les FETCHAIT en ligne —
 * un module jamais visité n'avait AUCUNE donnée cachée → KPI vides/à zéro.
 *
 * SOLUTION offline-first : après le login (et 1×/24 h), le client envoie au
 * SW la liste des endpoints KPI de TOUS les dashboards + ses headers
 * d'authentification → le SW fetch chaque endpoint et l'écrit dans ah-api
 * sous la clé normalisée (tenant|user — cf. sw.js v3.5.0). Hors ligne, les
 * dashboards servent les VRAIES données, SANS visite préalable.
 */

/** Flag 24 h propre aux données API (le cache ah-api n'est pas versionné). */
const API_PRECACHE_TS_KEY = 'academia_helm_api_precached_at';
const API_PRECACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Taux de réussite minimum (ACK du SW) pour poser le flag 24 h. */
const API_MIN_SUCCESS_RATE = 0.7;
/** Attente max de l'ACK PRECACHE_API_RESULT (le SW fetch ~15 s/endpoint). */
const API_ACK_TIMEOUT_MS = 120000;

let inFlightApiRun: Promise<void> | null = null;

function isApiPrecacheFresh(): boolean {
  try {
    const ts = Number(localStorage.getItem(API_PRECACHE_TS_KEY) || 0);
    return ts > 0 && Date.now() - ts < API_PRECACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Session persistée (localStorage) — tenant + user pour les query params. */
function readSessionContext(): { tenantId?: string; userId?: string } {
  try {
    const raw = localStorage.getItem('session');
    if (raw) {
      const s = JSON.parse(raw) as {
        tenantId?: string; user?: { id?: string; tenantId?: string };
        tenant?: { id?: string };
      };
      return {
        tenantId: s.tenantId || s.tenant?.id || s.user?.tenantId || undefined,
        userId: s.user?.id || undefined,
      };
    }
  } catch { /* session corrompue */ }
  return {};
}

/** Année académique active : localStorage currentAcademicYearId | academicYear.id. */
function readAcademicYearId(): string | null {
  try {
    const direct = localStorage.getItem('currentAcademicYearId');
    if (direct) return direct;
    const raw = localStorage.getItem('academicYear');
    if (raw) {
      const y = JSON.parse(raw) as { id?: string };
      if (y?.id) return String(y.id);
    }
  } catch { /* non-bloquant */ }
  return null;
}

/** Niveau scolaire courant : 'ALL' ou UUID (localStorage). */
function readSchoolLevelId(): string | null {
  try {
    const direct = localStorage.getItem('currentSchoolLevelId');
    if (direct) return direct;
    const raw = localStorage.getItem('schoolLevel');
    if (raw) {
      const sl = JSON.parse(raw) as { schoolLevelId?: string; id?: string };
      const id = sl?.schoolLevelId || sl?.id;
      if (id) return String(id);
    }
  } catch { /* non-bloquant */ }
  return null;
}

/** Construit un query string en ignorant les valeurs vides/nulles. */
function qs(params: Record<string, string | number | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && String(v) !== '');
  if (!parts.length) return '';
  return '?' + parts.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

/**
 * Liste des endpoints GET chargés par les DASHBOARDS de chaque module
 * (inventaire exhaustif des composants *Dashboard* / hooks *DashboardQueries*).
 * Query params résolus depuis localStorage (année/niveau/session) — les mêmes
 * sources que celles des hooks au montage.
 */
function buildApiPrecacheUrls(apiBase: string): string[] {
  const year = readAcademicYearId();
  const level = readSchoolLevelId();
  const levelParam = level && level !== 'ALL' ? level : null; // 'ALL' → param omis
  const { tenantId, userId } = readSessionContext();
  const urls: string[] = [];

  // ─── Contexte transverse (providers du layout — chargés sur TOUTES les pages) ───
  urls.push('/api/academic-years');
  urls.push('/api/school-levels');
  // ─── Sidebar (feature codes — sinon la sidebar tombe à 4 modules hors ligne) ───
  urls.push(`/api/settings/features${qs({ tenant_id: tenantId })}`);

  // ─── Dashboard principal /app (PilotageDashboardV2) ───
  urls.push(`/api/general/consolidated-report${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
  urls.push(`/api/general/weighted-average${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
  urls.push(`/api/students/statistics${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
  urls.push(`/api/finance/reports/kpi${qs({ tenantId, academicYearId: year })}`);
  urls.push('/api/finance/payments/today');
  urls.push(`/api/dashboard/tuition-personalizations${qs({ academicYearId: year })}`);
  urls.push(`/api/dashboard/grade-evolution${qs({ academicYearId: year })}`);
  urls.push(`/api/dashboard/hr-overview${qs({ tenantId, academicYearId: year })}`);
  urls.push(`/api/dashboard/age-distribution${qs({ tenantId, academicYearId: year })}`);
  urls.push(`/api/dashboard/grade-analytics${qs({ tenantId, academicYearId: year })}`);
  urls.push(`/api/dashboard/overview${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
  urls.push(`/api/orion/alerts${qs({ academicYearId: year, schoolLevelId: levelParam, status: 'active', limit: 3 })}`);

  // ─── Pédagogie (PedagogyModuleDashboard) ───
  urls.push(`/api/pedagogy/control/dashboard${qs({ academicYearId: year })}`);
  urls.push(`/api/pedagogy/control/snapshots${qs({ academicYearId: year })}`);
  urls.push(`/api/pedagogy/orion-advanced/dashboard${qs({ academicYearId: year })}`);
  urls.push(`/api/pedagogy/orion/kpis${qs({ academicYearId: year })}`);
  urls.push(`/api/pedagogy/academic-structure/levels${qs({ academicYearId: year })}`);
  urls.push(`/api/timetables${qs({ academicYearId: year })}`);
  urls.push(`/api/rooms${qs({ academicYearId: year })}`);
  urls.push('/api/subjects');

  // ─── Finances (FinanceDashboardV2) ───
  urls.push(`/api/finance/student-accounts${qs({ academicYearId: year, exportAll: 'true' })}`);
  urls.push(`/api/finance/fee-structures/overrides${qs({ academicYearId: year })}`);

  // ─── RH (HROverview — le cache-buster _t est retiré par la clé SW) ───
  urls.push(`/api/hr/overview/dashboard${qs({ tenantId, academicYearId: year })}`);

  // ─── Examens ───
  urls.push('/api/all-classes');

  // ─── Élèves (StudentsModuleDashboard) ───
  urls.push(`/api/classes${qs({ academicYearId: year, schoolLevelId: level || 'ALL' })}`);

  // ─── Communication (WhatsAppChat au montage) ───
  if (userId) {
    urls.push(`/api/chat/conversations${qs({ userId })}`);
    urls.push(`/api/chat/channels${qs({ userId })}`);
    urls.push(`/api/chat/v2/notifications/muted-conversations${qs({ userId })}`);
  }
  urls.push('/api/chat/auto-groups');
  urls.push('/api/chat/live-streams');

  // ─── Cross-origin (axios apiClient → apiBase, ex. https://api.<domaine>/api) ───
  if (apiBase) {
    // Pédagogie — dashboard directeur (pedagogySpaceService)
    urls.push(`${apiBase}/pedagogy-space/director/pedagogy-dashboard${qs({ academicYearId: year })}`);
    // Examens — evaluations (institutionalExams.service) — FR + EN
    const evalParams = { academicYearId: year, schoolLevelId: levelParam };
    urls.push(`${apiBase}/institutional-exams/evaluations${qs({ ...evalParams, language: 'FR' })}`);
    urls.push(`${apiBase}/institutional-exams/evaluations${qs({ ...evalParams, language: 'EN' })}`);
  }

  return urls;
}

/**
 * Pré-cache les données API (KPIs) via le SW — fire-and-forget, non bloquant.
 * Auto-gardé (1×/24 h) + garde de concurrence + flag posé seulement si ≥ 70 %
 * des endpoints ont réellement été cachés (ACK PRECACHE_API_RESULT du SW).
 */
export async function precacheApiData(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!navigator.onLine) {
    console.log('[ApiPrecache] Offline — skipping');
    return;
  }
  if (isApiPrecacheFresh()) {
    console.log('[ApiPrecache] Fresh (<24 h) — skipping');
    return;
  }
  if (inFlightApiRun) return inFlightApiRun;

  inFlightApiRun = runApiPrecache().finally(() => {
    inFlightApiRun = null;
  });
  return inFlightApiRun;
}

async function runApiPrecache(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const sw = registration.active;
  if (!sw) {
    console.warn('[ApiPrecache] No active SW — skipping');
    return;
  }

  // Origine réelle de l'API (pour les endpoints axios cross-origin)
  let apiBase = '';
  try {
    const { getApiBaseUrl } = await import('@/lib/utils/urls');
    apiBase = getApiBaseUrl().replace(/\/+$/, '');
  } catch {
    /* pas d'origine cross-origin → endpoints relatifs seulement */
  }

  const urls = buildApiPrecacheUrls(apiBase);
  if (!urls.length) return;

  // Headers d'authentification — les MÊMES que ceux des appels réels de la
  // page (axios/fetch) → le SW calcule la même identité (tenant|user) → la
  // clé de cache correspondra exactement à celle des requêtes hors ligne.
  let headers: Record<string, string> = {};
  try {
    const { getClientAuthorizationHeader } = await import('@/lib/auth/client-access-token');
    headers = { ...getClientAuthorizationHeader() };
  } catch {
    /* sans JWT → endpoints publics seulement */
  }
  const { tenantId } = readSessionContext();
  if (tenantId && !headers['X-Tenant-ID']) {
    headers['X-Tenant-ID'] = tenantId;
  }

  // ACK du SW (wrapper objet : TS ne narrow pas une propriété assignée dans
  // une closure — contrairement à une variable locale)
  const ack: { value: { okCount: number; total: number } | null } = { value: null };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; okCount?: number; total?: number } | null;
    if (data?.type === 'PRECACHE_API_RESULT') {
      ack.value = { okCount: Number(data.okCount || 0), total: Number(data.total || 0) };
    }
  };
  navigator.serviceWorker.addEventListener('message', onMessage);

  try {
    console.log(`[ApiPrecache] Dispatching ${urls.length} endpoints to SW…`);
    sw.postMessage({ type: 'PRECACHE_API', urls, headers });

    const start = Date.now();
    while (!ack.value && Date.now() - start < API_ACK_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 1500));
    }

    const result = ack.value;
    if (result && result.total > 0 && result.okCount / result.total >= API_MIN_SUCCESS_RATE) {
      try {
        localStorage.setItem(API_PRECACHE_TS_KEY, String(Date.now()));
      } catch { /* localStorage indisponible */ }
      console.log(`[ApiPrecache] Complete — ${result.okCount}/${result.total} endpoints cached`);
    } else {
      // Pas de flag → re-tentative au prochain montage ou au retour du réseau
      console.warn(
        `[ApiPrecache] Incomplete (${result ? `${result.okCount}/${result.total}` : 'no ACK'}) — flag non posé`,
      );
    }
  } finally {
    navigator.serviceWorker.removeEventListener('message', onMessage);
  }
}
