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
 * ⭐ v3.6.0 — PRÉ-CACHE DES DONNÉES API : TOUS LES MODULES, TOUS LES ONGLETS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * EXIGENCE PRODUIT (sept. 2026, retour terrain) : « tous les modules
 * fonctionnels, tous les onglets, tous les sous-onglets, les modales —
 * tout s'affiche correctement offline et charge bien leurs données
 * respectives offline ». Les vagues précédentes (v3.5.0) ne couvraient que
 * les ~40 endpoints KPI des DASHBOARDS : les onglets/sous-onglets des
 * modules n'avaient des données hors ligne QUE s'ils avaient été visités
 * en ligne avant (modèle « lazy cache » rejeté explicitement).
 *
 * SOLUTION v3.6.0 — 2 VAGUES PROACTIVES (après login, 1×/24 h) :
 *   VAGUE 1 (statique, ~230 endpoints) : l'inventaire exhaustif des GET
 *   émis au montage de CHAQUE onglet/sous-onglet des 15 modules :
 *   pilotage, organisation pédagogique, espace censeur, élèves & scolarité,
 *   vie scolaire, espace directeur, finances & économat, examens/notes,
 *   personnel RH, Helm Connect, cantine, EduCast, Academia Shop, site
 *   institutionnel (CMS), paramètres — + les portails enseignant/parent.
 *   Gating par rôle (buckets STAFF / TEACHER / PARENT) pour ne pas gaspiller
 *   la bande passante 2G/3G sur des endpoints qui répondraient 403.
 *   VAGUE 2 (dynamique, par entité) : les familles d'URLs à paramètre
 *   d'entité (notes par évaluation, EDT par horaire, endpoints par enfant
 *   du parent, plans annuels par niveau, risk-score par trimestre) sont
 *   construites en LECTURE des listes de la vague 1 (déjà en cache SW).
 *
 * ACK « skip-aware » (sw.js v3.6.0) : les 400/401/403/404/405 = endpoint
 * non applicable au rôle → skipCount — le taux de réussite se calcule sur
 * okCount/(total−skipCount) (avant : un rôle restreint faisait échouer le
 * flag 24 h → retries permanents).
 */

/** Flag 24 h propre aux données API (le cache ah-api n'est pas versionné). */
const API_PRECACHE_TS_KEY = 'academia_helm_api_precached_at';
const API_PRECACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Taux de réussite minimum (okCount / (total − skipCount)) pour le flag 24 h. */
const API_MIN_SUCCESS_RATE = 0.7;
/** Attente max de l'ACK PRECACHE_API_RESULT PAR VAGUE (~230 endpoints,
 *  batchs de 6 × 15 s — le SW traite en arrière-plan, non bloquant). */
const API_ACK_TIMEOUT_MS = 600000;

let inFlightApiRun: Promise<void> | null = null;

function isApiPrecacheFresh(): boolean {
  try {
    const ts = Number(localStorage.getItem(API_PRECACHE_TS_KEY) || 0);
    return ts > 0 && Date.now() - ts < API_PRECACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Session persistée (localStorage) — contexte complet pour les buckets par rôle. */
interface PrecacheSessionContext {
  tenantId?: string;
  userId?: string;
  /** Profil Teacher lié (double casquette directeur-enseignant) — le même
   *  fallback que les pages : user.teacherId || user.id (portail enseignant). */
  teacherId?: string;
  portalType?: string;
  role?: string;
}

function readSessionContext(): PrecacheSessionContext {
  try {
    const raw = localStorage.getItem('session');
    if (raw) {
      const s = JSON.parse(raw) as {
        tenantId?: string; user?: {
          id?: string; tenantId?: string; role?: string; teacherId?: string;
        }; tenant?: { id?: string };
        portalType?: string;
      };
      const teacherId = s.user?.teacherId ||
        (s.portalType === 'TEACHER' ? s.user?.id : undefined);
      return {
        tenantId: s.tenantId || s.tenant?.id || s.user?.tenantId || undefined,
        userId: s.user?.id || undefined,
        teacherId: teacherId || undefined,
        portalType: s.portalType || undefined,
        role: s.user?.role || undefined,
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
 * ⭐ v3.6.0 — VAGUE 1 (statique) : inventaire exhaustif des GET émis au
 * montage de chaque onglet/sous-onglet des 15 modules. Query params résolus
 * depuis localStorage (année/niveau/session) — les MÊMES sources que celles
 * des pages au montage (clés de cache identiques → cache retrouvé offline).
 *
 * ⚠️ Les variantes de paramètres comptent : une URL `?academicYearId=x` et
 * `?academicYearId=x&schoolLevelId=y` sont DEUX clés de cache distinctes.
 * Quand le niveau courant est défini (≠ ALL), on pré-cache les deux formes
 * (la page émet l'une ou l'autre selon son état de filtre au montage).
 *
 * Gating par rôle (buckets) :
 *   - TEACHER  : user.teacherId (double casquette) OU portail enseignant
 *   - PARENT   : portail parent
 *   - STAFF    : tout le reste (admin/direction/promoteur/secrétariat/…)
 *     (FINANCE / RH en sous-gating par rôles — cf. PilotageSidebar)
 */
function buildApiPrecacheUrls(apiBase: string, ctx: PrecacheSessionContext): string[] {
  const year = readAcademicYearId();
  const level = readSchoolLevelId();
  const levelParam = level && level !== 'ALL' ? level : null; // 'ALL' → param omis
  const { tenantId, userId, teacherId, portalType, role } = ctx;

  // ─── Buckets par rôle ───
  const isTeacher = Boolean(teacherId) || portalType === 'TEACHER' ||
    ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE',
      'RESP_MATERNELLE', 'PEDAGOGIC_COORDINATOR'].includes(String(role));
  const isParent = portalType === 'PARENT' || role === 'PARENT';
  // Staff = portail SCHOOL/PLATFORM, ou ni enseignant ni parent (défaut sûr)
  const isStaff = !isParent && (portalType === 'SCHOOL' || portalType === 'PLATFORM' ||
    (!isTeacher || portalType === undefined));
  const hasFinance = isStaff && [
    'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_BILLING',
    'PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'CAISSIER', 'COMPTABLE',
    'SECRETAIRE_COMPTABLE', 'ECONOME', 'INTENDANT', 'DIRECTEUR_GENERAL',
    'DIRECTEUR_ETABLISSEMENT', 'DIRECTEUR', 'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE',
    'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI', 'CFO', 'FINANCE_MANAGER',
    'ACCOUNTANT', 'CASHIER', 'RECOVERY_MANAGER', 'admin', 'ADMIN',
  ].includes(String(role));
  const hasHr = isStaff && [
    'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PROMOTER', 'PROMOTEUR',
    'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
    'DIRECTEUR', 'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE',
    'DIRECTEUR_MAT_PRI', 'HR_MANAGER', 'PAYROLL_MANAGER', 'SECRETAIRE_COMPTABLE',
    'SCOLARITE', 'admin', 'ADMIN',
  ].includes(String(role));

  const urls: string[] = [];

  // ═══ 1. CONTEXTE TRANSVERSE (providers du layout — toutes les pages) ═══
  urls.push('/api/context/bootstrap');
  urls.push('/api/academic-years');
  urls.push('/api/school-levels');
  if (tenantId) {
    urls.push(`/api/settings/academic-years${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/academic-years/active${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/billing/subscription-status/${tenantId}`);
  }
  // Périodes de l'année active (examens/bulletins/conseils — l'id est CONNU)
  if (year) urls.push(`/api/settings/academic-years/${year}/periods`);
  // Sidebar (feature codes — sinon la sidebar tombe à 4 modules hors ligne)
  urls.push(`/api/settings/features${qs({ tenant_id: tenantId })}`);
  urls.push('/api/settings/identity');
  urls.push(`/api/settings/bilingual${qs({ tenant_id: tenantId })}`);
  urls.push('/api/tenant-theme');
  if (apiBase) urls.push(`${apiBase}/tenant-features/check/BILINGUAL_TRACK`);
  // Cloche de notifications (tous les shells)
  if (apiBase) {
    urls.push(`${apiBase}/notifications/unread-count`);
    urls.push(`${apiBase}/notifications?limit=20`);
  }

  // ═══ 2. TABLEAU DE PILOTAGE (PilotageDashboardV2 / FinanceDashboardV2) ═══
  if (isStaff) {
    urls.push(`/api/general/consolidated-report${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    urls.push(`/api/general/weighted-average${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    urls.push(`/api/students/statistics${qs({ academicYearId: year })}`);
    if (levelParam) urls.push(`/api/students/statistics${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    urls.push(`/api/finance/reports/kpi${qs({ tenantId, academicYearId: year })}`);
    urls.push('/api/finance/payments/today');
    urls.push(`/api/dashboard/tuition-personalizations${qs({ academicYearId: year })}`);
    urls.push(`/api/dashboard/grade-evolution${qs({ academicYearId: year })}`);
    urls.push(`/api/dashboard/hr-overview${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/dashboard/age-distribution${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/dashboard/grade-analytics${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/dashboard/overview${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    urls.push(`/api/orion/alerts${qs({ academicYearId: year, schoolLevelId: levelParam, status: 'active', limit: 3 })}`);
    if (levelParam) urls.push(`/api/orion/alerts${qs({ status: 'active', limit: 10 })}`);
  }

  // ═══ 3. ORGANISATION PÉDAGOGIQUE (17 sous-onglets) ═══
  if (isStaff) {
    // Dashboard du module
    urls.push(`/api/pedagogy/control/dashboard${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/control/snapshots${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/orion-advanced/dashboard${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/orion/kpis${qs({ academicYearId: year })}`);
    // Structure académique (onglet + modales)
    urls.push(`/api/pedagogy/academic-structure/levels${qs({ academicYearId: year, tenant_id: tenantId })}`);
    urls.push(`/api/pedagogy/academic-structure/cycles${qs({ academicYearId: year, tenant_id: tenantId })}`);
    urls.push(`/api/pedagogy/academic-structure/classes${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/academic-structure/sections${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/academic-series${qs({ academicYearId: year })}`);
    // Onglet enseignants + affectations
    urls.push('/api/teachers');
    urls.push(`/api/pedagogy/teacher-profiles${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/teacher-class-assignments${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/class-subjects${qs({ academicYearId: year })}`);
    urls.push(`/api/multigrade${qs({ academicYearId: year, isActive: 'true' })}`);
    // Onglet matières
    urls.push(`/api/subjects${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/subjects${qs({ academicYearId: year })}`);
    if (levelParam) urls.push(`/api/pedagogy/subjects${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    // Onglet EDT (moteur + édition manuelle)
    urls.push(`/api/timetables${qs({ academicYearId: year })}`);
    urls.push(`/api/rooms${qs({ academicYearId: year })}`);
    urls.push('/api/rooms');
    if (levelParam) {
      urls.push(`/api/timetable-engine/config${qs({ schoolLevelId: levelParam, academicYearId: year })}`);
      urls.push(`/api/timetable-engine/teachers${qs({ schoolLevelId: levelParam })}`);
      urls.push(`/api/timetable-engine/constraints${qs({ schoolLevelId: levelParam })}`);
    }
    urls.push('/api/pedagogy-space/school-identity');
    // Onglet contrôle (directeur)
    urls.push(`/api/pedagogy/monthly-plans/pending${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/monthly-plans/pending${qs({ academicYearId: year, status: 'PENDING' })}`);
    // Onglet matériel pédagogique
    urls.push(`/api/pedagogy/pedagogical-materials${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/material-returns/school-levels${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/material-returns/teachers-by-level${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/teacher-material-assignments${qs({ academicYearId: year, page: 1, limit: 100 })}`);
    urls.push(`/api/pedagogy/material-returns/pending${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/material-returns/return-comparison${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/material-returns/history${qs({ academicYearId: year })}`);
    // Cross-origin (pedagogySpaceService — dashboard directeur + files d'attente)
    if (apiBase) {
      urls.push(`${apiBase}/pedagogy-space/director/pedagogy-dashboard${qs({ academicYearId: year })}`);
      urls.push(`${apiBase}/pedagogy-space/director/pending-cahier-journals${qs({ academicYearId: year, status: 'PENDING' })}`);
      urls.push(`${apiBase}/pedagogy-space/director/pending-registers${qs({ academicYearId: year, status: 'PENDING' })}`);
      urls.push(`${apiBase}/pedagogy-space/director/pending-evaluations${qs({ academicYearId: year, status: 'PENDING' })}`);
      urls.push(`${apiBase}/pedagogy-space/seminar-config${qs({ academicYearId: year })}`);
      urls.push(`${apiBase}/pedagogy-space/seminar-config/eligible-teachers${qs({ academicYearId: year })}`);
      urls.push(`${apiBase}/teachers`);
      urls.push(`${apiBase}/pedagogy/teacher-profiles${qs({ academicYearId: year })}`);
    }
  }

  // ═══ 4. ESPACE ENSEIGNANT (production FR/EN, devoirs, semainier) ═══
  if (isTeacher && teacherId) {
    urls.push(`/api/pedagogy-space/my-classes${qs({ teacherId, academicYearId: year })}`);
    urls.push(`/api/pedagogy-space/my-classes${qs({ teacherId, academicYearId: year, language: 'FR' })}`);
    urls.push(`/api/pedagogy-space/my-classes${qs({ teacherId, academicYearId: year, language: 'EN' })}`);
    urls.push(`/api/pedagogy-space/homeworks${qs({ teacherId, academicYearId: year })}`);
    urls.push(`/api/pedagogy-space/homeworks${qs({ teacherId, academicYearId: year, taskType: 'HOMEWORK' })}`);
    urls.push(`/api/pedagogy-space/homeworks${qs({ teacherId, academicYearId: year, taskType: 'LESSON' })}`);
    urls.push(`/api/pedagogy-space/student-engagement${qs({ teacherId, academicYearId: year })}`);
    urls.push(`/api/pedagogy-space/activity-stats${qs({ teacherId, academicYearId: year })}`);
    urls.push(`/api/pedagogy-space/catalogue${qs({ teacherId })}`);
    urls.push(`/api/pedagogy-space/cahier-textes${qs({ teacherId, academicYearId: year })}`);
    if (userId) urls.push(`/api/pedagogy-space/seminar-config/my-teacher-id${qs({ userId })}`);
    if (userId) urls.push(`/api/pedagogy-space/teacher-signature${qs({ userId })}`);
    urls.push(`/api/pedagogy-space/seminar-config${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/teacher-profiles${qs({ academicYearId: year })}`);
    urls.push(`/api/pedagogy/teacher-class-assignments${qs({ teacherId, academicYearId: year })}`);
    if (userId) urls.push(`/api/pedagogy/material-returns/my-assignments${qs({ userId, academicYearId: year })}`);
    const today = new Date().toISOString().slice(0, 10);
    urls.push(`/api/hr/attendance/my-today${qs({ date: today })}`);
  }

  // ═══ 5. ESPACE CENSEUR ═══ (visits/exams/councils : endpoints backend
  //     inexistants — 404 comptés skip ; sanctions + fraudes couverts)
  if (isStaff) {
    urls.push(`/api/discipline/sanctions${qs({ academicYearId: year, schoolLevelId: levelParam, type: 'ACADEMIC' })}`);
    urls.push(`/api/exam-frauds${qs({ tenantId, academicYearId: year })}`);
  }

  // ═══ 6. ÉLÈVES & SCOLARITÉ ═══
  if (isStaff) {
    // /api/classes EXIGE schoolLevelId ('ALL' = tous) — StudentsModulePage
    urls.push(`/api/classes${qs({ academicYearId: year, schoolLevelId: level || 'ALL' })}`);
    // Liste élèves : variante sans niveau (défaut) + avec niveau
    urls.push(`/api/students${qs({ academicYearId: year })}`);
    if (levelParam) urls.push(`/api/students${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    // Référentiels (sélecteurs + modales d'inscription/transfert)
    urls.push('/api/all-classes');
    urls.push(`/api/all-classes${qs({ academicYearId: year })}`);
    urls.push(`/api/academic-classes${qs({ academicYearId: year })}`);
    urls.push(`/api/academic-classes${qs({ academicYearId: year, isActive: 'true' })}`);
    urls.push(`/api/students/enrollments${qs({ academicYearId: year })}`);
    urls.push('/api/public/schools/list');
    // Cross-origin (studentsService)
    if (apiBase) {
      urls.push(`${apiBase}/students/admissions${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
      urls.push(`${apiBase}/students${qs({ academicYearId: year })}`);
      urls.push(`${apiBase}/students${qs({ academicYearId: year, includeHistory: 'true' })}`);
      urls.push(`${apiBase}/students/students-without-physical-class${qs({ academicYearId: year })}`);
      urls.push(`${apiBase}/students/class-transfers-history${qs({ academicYearId: year })}`);
      urls.push(`${apiBase}/students/transfers/outgoing`);
      urls.push(`${apiBase}/students/transfers/incoming`);
      urls.push(`${apiBase}/students/id-cards/stats${qs({ academicYearId: year })}`);
    }
  }

  // ═══ 7. VIE SCOLAIRE (discipline) ═══
  if (isStaff) {
    urls.push(`/api/discipline/rules${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
    urls.push(`/api/discipline/sanctions${qs({ academicYearId: year, schoolLevelId: levelParam })}`);
  }

  // ═══ 8. ESPACE DIRECTEUR (oversight : risque + décrochage) ═══
  if (isStaff) {
    // quarterId résolu en VAGUE 2 depuis la réponse /api/academic-years
    urls.push(`/api/risk-score/dropout/trends${qs({ tenantId, academicYearId: year })}`);
  }

  // ═══ 9. FINANCES & ÉCONOMAT (14 sous-onglets) ═══
  if (hasFinance) {
    // Dashboard
    urls.push(`/api/finance/student-accounts${qs({ academicYearId: year, exportAll: 'true' })}`);
    urls.push(`/api/finance/fee-structures/overrides${qs({ academicYearId: year })}`);
    // Frais + personnalisations
    urls.push(`/api/finance/fee-structures${qs({ academicYearId: year })}`);
    // Comptes élèves + frais généraux
    urls.push(`/api/finance/student-accounts${qs({ academicYearId: year, page: 1, limit: 50 })}`);
    urls.push(`/api/finance/student-accounts/general-fees${qs({ academicYearId: year, page: 1, limit: 50 })}`);
    // Encaissements (transactions) + ventes boutique
    urls.push(`/api/finance/transactions${qs({ academicYearId: year, page: 1, limit: 25 })}`);
    urls.push(`/api/finance/transactions${qs({ academicYearId: year, page: 1, limit: 25, feeType: 'GENERAL' })}`);
    urls.push(`/api/finance/shop-sales${qs({ academicYearId: year })}`);
    // Multi-caisses
    urls.push('/api/finance/cash-registers');
    urls.push(`/api/finance/cash-registers/dashboard${qs({ academicYearId: year })}`);
    urls.push('/api/finance/cash-registers/transfers?limit=100');
    // Bilan encaissements + recouvrement
    urls.push(`/api/finance/collection-summary${qs({ academicYearId: year, page: 1, limit: 50 })}`);
    urls.push('/api/finance/collection/arrears');
    urls.push(`/api/finance/collection/reminders${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/collection/statistics${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/collection/promises${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/collection/actions${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/collection/cases${qs({ academicYearId: year })}`);
    // Dépenses
    urls.push(`/api/finance/expenses-v2${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/expenses-v2/budgets${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/expenses-v2/monthly-stats${qs({ academicYearId: year })}`);
    urls.push('/api/finance/expenses/categories');
    // Trésorerie
    urls.push(`/api/finance/treasury/daily-closures${qs({ academicYearId: year })}`);
    // Rapports
    urls.push(`/api/finance/reports/monthly-encaissements${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/reports/bilan-periodique${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/reports/journal-caisse${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/reports/comparative-year${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/reports/projection-tresorerie${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/reports/cash-register-comparative${qs({ academicYearId: year })}`);
    // Audit
    urls.push(`/api/finance/anomalies${qs({ limit: 100, academicYearId: year })}`);
    urls.push(`/api/finance/reports/suspicious-transactions${qs({ academicYearId: year, days: 30, minAmount: 100000 })}`);
    urls.push(`/api/finance/reports/cash-mismatches${qs({ academicYearId: year })}`);
    urls.push(`/api/finance/reports/missed-closures${qs({ academicYearId: year, days: 30 })}`);
    urls.push(`/api/finance/reports/top-accountants${qs({ academicYearId: year, days: 30 })}`);
    urls.push('/api/finance/audit-logs?limit=50');
    // Paramétrage
    urls.push('/api/finance/settings');
    urls.push('/api/finance/settings/history');
    urls.push('/api/finance/settings/orion-alerts');
    urls.push('/api/finance/payment-config');
    urls.push('/api/billing/feexpay/school-config');
    // Référentiels communs des onglets finance
    urls.push('/api/settings/users');
    // Sélecteurs de modales (payeurs/caisses)
    if (levelParam) urls.push(`/api/hr/staff${qs({ tenantId, category: 'ADMIN' })}`);
  }

  // ═══ 10. EXAMENS, NOTES & BULLETINS (11 sous-onglets) ═══
  {
    // Référentiels chargés par TOUS les onglets examens
    urls.push('/api/all-classes');
    if (year) urls.push(`/api/settings/academic-years/${year}/periods`);
    if (apiBase) {
      const evalBase = { academicYearId: year, schoolLevelId: levelParam };
      // Dashboard + évaluations (enseignants : filtre teacherId)
      urls.push(`${apiBase}/institutional-exams/evaluations${qs({ ...evalBase, language: 'FR' })}`);
      urls.push(`${apiBase}/institutional-exams/evaluations${qs({ ...evalBase, language: 'EN' })}`);
      if (teacherId) {
        urls.push(`${apiBase}/institutional-exams/evaluations${qs({ academicYearId: year, teacherId, language: 'FR' })}`);
      }
      // Validation / registre / bulletins (variantes par statut)
      urls.push(`${apiBase}/institutional-exams/evaluations${qs({ ...evalBase, status: 'SUBMITTED', language: 'FR' })}`);
      urls.push(`${apiBase}/institutional-exams/evaluations${qs({ ...evalBase, status: 'VALIDATED', language: 'FR' })}`);
      // Paramètres d'examen (configuration d'évaluations)
      urls.push(`${apiBase}/exams/settings${qs({ schoolYearId: year })}`);
      // Conseils de classe + déverrouillages + audit + critères d'envoi
      urls.push(`${apiBase}/institutional-exams/councils${qs({ academicYearId: year, schoolLevelId: levelParam, language: 'FR' })}`);
      urls.push(`${apiBase}/institutional-exams/unlock-requests${qs({ status: 'PENDING', schoolLevelId: levelParam, language: 'FR' })}`);
      urls.push(`${apiBase}/institutional-exams/audit/logs${qs({ academicYearId: year, schoolLevelId: levelParam, language: 'FR' })}`);
      urls.push(`${apiBase}/institutional-exams/bulletins/sending-criteria`);
    }
    // Statistiques (analytics — /api/exams/dashboard par niveau actif)
    if (levelParam) {
      urls.push(`/api/exams/dashboard${qs({ tenantId, academicYearId: year, schoolLevelId: levelParam, language: 'FR' })}`);
    }
  }

  // ═══ 11. PERSONNEL, RH & PAIE (16 sous-onglets) ═══
  if (hasHr) {
    urls.push(`/api/hr/overview/dashboard${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/hr/overview/analytics${qs({ tenantId, academicYearId: year })}`);
    // Administration (annuaire + affectations)
    urls.push('/api/hr/staff?limit=500');
    urls.push(`/api/hr/staff${qs({ tenantId })}`);
    urls.push('/api/admin-structure/groups');
    urls.push(`/api/staff-admin-assignments${qs({ academicYearId: year })}`);
    urls.push('/api/settings/signatures');
    // Primes, contrats, congés
    urls.push(`/api/hr/allowances/types${qs({ tenantId })}`);
    urls.push(`/api/hr/contracts${qs({ tenantId })}`);
    urls.push(`/api/hr/contracts/alerts${qs({ tenantId })}`);
    urls.push(`/api/hr/contracts/settings${qs({ tenantId })}`);
    urls.push(`/api/hr/evaluations${qs({ tenantId })}`);
    urls.push(`/api/hr/evaluations/trainings${qs({ tenantId })}`);
    urls.push(`/api/hr/leaves/requests${qs({ tenantId, academicYearId: year })}`);
    // CNSS / fiscal
    urls.push(`/api/hr/taxes/dashboard${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/hr/taxes/staff-fiscal${qs({ tenantId })}`);
    urls.push(`/api/hr/taxes/report-header${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/hr/taxes/declarations${qs({ tenantId, academicYearId: year, type: 'CNSS' })}`);
    urls.push(`/api/hr/taxes/declarations${qs({ tenantId, academicYearId: year, type: 'IST' })}`);
    urls.push(`/api/hr/taxes/declarations${qs({ tenantId, academicYearId: year, type: 'AIB' })}`);
    urls.push(`/api/hr/taxes/financial-statements${qs({ tenantId, academicYearId: year, type: 'BILAN' })}`);
    urls.push(`/api/hr/taxes/financial-notes${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/hr/taxes/settings${qs({ tenantId })}`);
    // Collaborateurs / organigramme
    urls.push('/api/hr/organigram/tree');
    urls.push('/api/hr/organigram/stats');
    // Paie
    urls.push(`/api/hr/payroll/periods${qs({ tenantId })}`);
    urls.push(`/api/hr/payroll/statistics${qs({ tenantId, academicYearId: year })}`);
    urls.push(`/api/hr/payroll/rates/active${qs({ tenantId })}`);
    // Planning (semaine courante Lundi→Samedi)
    const now = new Date();
    const monday = new Date(now);
    const dow = (now.getDay() + 6) % 7; // 0 = lundi
    monday.setDate(now.getDate() - dow);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    urls.push(`/api/hr/schedules${qs({
      tenantId,
      startDate: monday.toISOString().slice(0, 10),
      endDate: saturday.toISOString().slice(0, 10),
    })}`);
    // Recrutement
    urls.push(`/api/hr/recruitment/jobs${qs({ tenantId })}`);
    urls.push(`/api/hr/recruitment/candidates${qs({ tenantId })}`);
    urls.push(`/api/hr/recruitment/interviews${qs({ tenantId })}`);
    urls.push(`/api/hr/recruitment/tests${qs({ tenantId })}`);
    urls.push(`/api/hr/recruitment/talent-pool${qs({ tenantId })}`);
    urls.push(`/api/hr/recruitment/recruiter-profile${qs({ tenantId })}`);
    urls.push(`/api/hr/recruitment/questionnaires${qs({ tenantId })}`);
    urls.push(`/api/departments${qs({ tenantId })}`);
    // Stagiaires + IA RH
    urls.push(`/api/hr/internships${qs({ tenantId })}`);
    urls.push(`/api/hr/ia/status${qs({ tenantId })}`);
    urls.push(`/api/hr/ia/match-candidates${qs({ tenantId })}`);
    urls.push(`/api/hr/ia/detect-fraud${qs({ tenantId })}`);
  }

  // ═══ 12. HELM CONNECT (communication : messages, inbox, historique,
  //      emails planifiés, modèles) ═══
  if (userId) {
    urls.push(`/api/chat/conversations${qs({ userId })}`);
    urls.push(`/api/chat/channels${qs({ userId })}`);
    urls.push(`/api/chat/live-streams`);
    urls.push(`/api/chat/voice-channels`);
    urls.push(`/api/chat/v2/notifications/muted-conversations${qs({ userId })}`);
    urls.push(`/api/chat/profile/${userId}`);
  }
  urls.push('/api/chat/auto-groups');
  if (isStaff && tenantId) {
    urls.push(`/api/communication/email-logs-stats${qs({ tenantId })}`);
    urls.push(`/api/communication/email-logs${qs({ tenantId, page: 1, pageSize: 25 })}`);
    urls.push(`/api/communication/inbound-emails${qs({ tenantId, page: 1, pageSize: 25 })}`);
    urls.push('/api/communication/templates');
    if (apiBase) urls.push(`${apiBase}/communication/scheduled-emails${qs({ tenantId })}`);
  }

  // ═══ 13. CANTINE / EDUCAST / ACADEMIA SHOP (modules complémentaires) ═══
  if (isStaff && apiBase) {
    const mc = `${apiBase}/modules-complementaires`;
    // Cantine (dashboard Nest = canteen/dashboard ; stats = fallback)
    urls.push(`${mc}/canteen/dashboard${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/menus${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/enrollments${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/attendance${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/diets${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/stocks${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/suppliers${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/incidents${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/payments${qs({ academicYearId: year })}`);
    urls.push(`${mc}/canteen/settings${qs({ academicYearId: year })}`);
    // Academia Shop
    urls.push(`${mc}/shop/stats${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/products${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/categories${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/orders${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/sales${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/stocks${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/suppliers${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/purchase-orders${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/discounts${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/kits${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/deliveries${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/returns${qs({ academicYearId: year })}`);
    urls.push(`${mc}/shop/settings${qs({ academicYearId: year })}`);
    // Boutique depuis le module finance (modale de paiement)
    urls.push(`/api/modules-complementaires/shop/products${qs({ academicYearId: year })}`);
  }
  // EduCast (same-origin BFF — flux, favoris, analytics, gains, réglages)
  urls.push(`/api/modules-complementaires/educast/contents${qs({ academicYearId: year })}`);
  if (userId) urls.push(`/api/modules-complementaires/educast/favorites${qs({ userId })}`);
  urls.push(`/api/modules-complementaires/educast/stats-extended${qs({ academicYearId: year })}`);
  if (userId) urls.push(`/api/modules-complementaires/educast/teacher-earnings${qs({ userId })}`);
  urls.push('/api/modules-complementaires/educast/settings');

  // ═══ 14. SITE INSTITUTIONNEL (CMS) ═══
  if (isStaff) {
    urls.push('/api/tenant-website');
    urls.push('/api/tenant-website/news');
    urls.push('/api/tenant-website/events');
    urls.push('/api/tenant-website/gallery');
    urls.push('/api/tenant-website/testimonials');
    urls.push('/api/tenant-website/faq');
    urls.push('/api/tenant-website/contact');
    urls.push('/api/tenant-media?limit=100&offset=0');
    urls.push('/api/tenant-media/folders');
  }

  // ═══ 15. PARAMÈTRES (bootstrap 23 endpoints + onglets) ═══
  if (isStaff && tenantId) {
    urls.push(`/api/settings/general${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/security${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/orion${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/atlas${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/offline-sync${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/history${qs({ tenant_id: tenantId, limit: 50 })}`);
    urls.push(`/api/settings/pedagogical-structure${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/bilingual/check-migration${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/bilingual/billing-impact${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/communication${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/roles${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/permissions${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/users${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/billing${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/billing/plans`);
    urls.push(`/api/settings/billing/invoices${qs({ tenant_id: tenantId, limit: 10 })}`);
    urls.push(`/api/settings/identity/history${qs({ tenant_id: tenantId, limit: 20 })}`);
    urls.push(`/api/settings/education/structure${qs({ tenant_id: tenantId })}`);
    urls.push(`/api/settings/school-calendar-config${qs({ tenant_id: tenantId })}`);
    if (year) {
      urls.push(`/api/settings/education/classrooms${qs({ academic_year_id: year, tenant_id: tenantId })}`);
    }
    urls.push('/api/sync/devices');
  }

  // ═══ 16. PORTAIL PARENT (enfants + notes + finances) ═══
  if (isParent) {
    urls.push(`/api/parent/children${qs({ academicYearId: year })}`);
    if (userId) urls.push(`/api/parent/children${qs({ parentId: userId, academicYearId: year })}`);
  }

  // ⭐ v3.6.0 — Déduplication : les buckets STAFF+TEACHER (double casquette)
  //    partagent des endpoints (all-classes, periods, teacher-profiles…) —
  //    une URL dupliquée = 1 requête 2G/3G gaspillée pour la même clé de cache.
  return Array.from(new Set(urls));
}

/**
 * ⭐ v3.6.0 — VAGUE 2 (dynamique) : URLs à paramètre d'ENTITÉ construites en
 * lisant les listes de la vague 1 (réponses passées par le SW → déjà en
 * cache). Chaque famille est CAPÉE pour rester raisonnable sur 2G/3G.
 */
interface WaveAck {
  okCount: number;
  skipCount: number;
  total: number;
}

/** GET authentifié côté page (traverse le SW → réponse 200 mise en cache). */
async function fetchListJson(
  url: string,
  headers: Record<string, string>,
): Promise<any | null> {
  try {
    const isCrossOrigin = url.startsWith('http');
    const res = await fetch(url, {
      credentials: isCrossOrigin ? 'omit' : 'include',
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Extrait un tableau de façon défensive (data peut être array | {data} | {items} | {evaluations}…). */
function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['data', 'items', 'evaluations', 'list', 'results', 'classes', 'timetables', 'children']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}

function buildDynamicPrecacheUrls(
  apiBase: string,
  ctx: PrecacheSessionContext,
  headers: Record<string, string>,
): Promise<string[]> {
  const year = readAcademicYearId();
  const level = readSchoolLevelId();
  const levelParam = level && level !== 'ALL' ? level : null;
  const { tenantId, teacherId, portalType, role } = ctx;
  const isTeacher = Boolean(teacherId) || portalType === 'TEACHER';
  const isParent = portalType === 'PARENT' || role === 'PARENT';
  const isStaff = !isParent;
  const urls: string[] = [];

  // Toutes les extractions sont best-effort : liste illisible → famille sautée
  return (async () => {
    // 1) EDT : /api/timetables → chaque /api/timetables/{id} (enseignant + parent + pédagogie)
    try {
      const timetables = extractArray(await fetchListJson(
        `/api/timetables${qs({ academicYearId: year })}`, headers));
      for (const t of timetables.slice(0, 40)) {
        if (t?.id) urls.push(`/api/timetables/${t.id}`);
      }
    } catch { /* famille sautée */ }

    // 2) NOTES : évaluations → /institutional-exams/grades/evaluation/{id}
    //    (cœur du module Notes — saisie/registre/bulletins hors ligne)
    if (apiBase) {
      try {
        const seen = new Set<string>();
        const evalParams = { academicYearId: year, schoolLevelId: levelParam };
        for (const language of ['FR', 'EN']) {
          const evals = extractArray(await fetchListJson(
            `${apiBase}/institutional-exams/evaluations${qs({ ...evalParams, language })}`, headers));
          for (const ev of evals) {
            const id = ev?.id || ev?.evaluationId;
            if (id && !seen.has(String(id))) {
              seen.add(String(id));
              urls.push(`${apiBase}/institutional-exams/grades/evaluation/${id}`);
            }
          }
        }
        // Cap : 120 feuilles de notes les plus récentes (2G/3G)
        const gradeUrls = urls.filter((u) => u.includes('/grades/evaluation/'));
        if (gradeUrls.length > 120) {
          for (const u of gradeUrls.slice(120)) urls.splice(urls.indexOf(u), 1);
        }
      } catch { /* famille sautée */ }
    }

    // 3) NIVEAUX : /api/school-levels → plans annuels + config examens + stats par niveau
    try {
      const levels = extractArray(await fetchListJson('/api/school-levels', headers));
      for (const lv of levels.slice(0, 12)) {
        const code = lv?.code || lv?.levelCode || lv?.level;
        const id = lv?.schoolLevelId || lv?.id || lv?.uuid;
        if (code) {
          urls.push(`/api/pedagogy/annual-plans${qs({ academicYearId: year, classLevel: code })}`);
          if (apiBase) {
            urls.push(`${apiBase}/exams/settings/active${qs({ schoolYearId: year, levelCode: code, language: 'FR' })}`);
          }
        }
        if (id && isStaff) {
          urls.push(`/api/exams/dashboard${qs({ tenantId, academicYearId: year, schoolLevelId: id, language: 'FR' })}`);
        }
      }
    } catch { /* famille sautée */ }

    // 4) TRIMESTRE ACTIF : /api/academic-years → activeQuarterId → risk-score
    if (isStaff) {
      try {
        const years = extractArray(await fetchListJson('/api/academic-years', headers));
        const active = years.find((y: any) => y?.isActive || y?.is_active) || years[0];
        const quarterId = active?.activeQuarterId || active?.quarterId;
        if (quarterId) {
          urls.push(`/api/risk-score/dashboard${qs({ tenantId, academicYearId: year, quarterId })}`);
          urls.push(`/api/risk-score/students${qs({ tenantId, academicYearId: year, quarterId, dropoutOnly: 'true' })}`);
          urls.push(`/api/risk-score/dropout/stats${qs({ tenantId, academicYearId: year, quarterId })}`);
          urls.push(`/api/risk-score/dropout/students${qs({ tenantId, academicYearId: year, quarterId })}`);
        }
      } catch { /* famille sautée */ }
    }

    // 5) CLASSES de l'ENSEIGNANT : matières disponibles + fiches par classe
    if (isTeacher && teacherId) {
      try {
        const classes = extractArray(await fetchListJson(
          `/api/pedagogy-space/my-classes${qs({ teacherId, academicYearId: year })}`, headers));
        for (const c of classes.slice(0, 25)) {
          if (c?.id) {
            urls.push(`/api/pedagogy-space/subjects/available${qs({ academicYearId: year, classId: c.id, teacherId })}`);
            urls.push(`/api/pedagogy-space/fiches${qs({ teacherId, academicYearId: year, classId: c.id })}`);
          }
        }
      } catch { /* famille sautée */ }
    }

    // 6) ENFANTS du PARENT : endpoints par enfant (aujourd'hui, notes,
    //    assiduité, bulletins, devoirs, finances) — cap 6 enfants
    if (isParent) {
      try {
        const children = extractArray(await fetchListJson(
          `/api/parent/children${qs({ academicYearId: year })}`, headers));
        for (const child of children.slice(0, 6)) {
          const childId = child?.id || child?.studentId || child?.student?.id;
          if (!childId) continue;
          urls.push(`/api/parent/today/${childId}${qs({ academicYearId: year })}`);
          urls.push(`/api/parent/results/${childId}${qs({ academicYearId: year })}`);
          urls.push(`/api/parent/attendance/${childId}`);
          urls.push(`/api/parent/grades/${childId}${qs({ academicYearId: year })}`);
          urls.push(`/api/parent/homeworks/${childId}${qs({ academicYearId: year })}`);
          urls.push(`/api/parent/finance/${childId}/breakdown${qs({ academicYearId: year })}`);
        }
      } catch { /* famille sautée */ }
    }

    return urls;
  })();
}

/**
 * Pré-cache les données API (tous les modules) via le SW — fire-and-forget,
 * non bloquant. Auto-gardé (1×/24 h) + garde de concurrence + flag posé
 * seulement si ≥ 70 % des endpoints APPLICABLES (hors 403/404) ont été
 * réellement cachés (ACK PRECACHE_API_RESULT du SW).
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

/** Envoie une vague d'URLs au SW et attend son ACK (skip-aware). */
async function dispatchWaveAndWaitAck(
  sw: ServiceWorker,
  urls: string[],
  headers: Record<string, string>,
  label: string,
): Promise<WaveAck | null> {
  if (!urls.length) return null;
  const ack: { value: WaveAck | null } = { value: null };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as
      | { type?: string; okCount?: number; skipCount?: number; total?: number }
      | null;
    if (data?.type === 'PRECACHE_API_RESULT') {
      ack.value = {
        okCount: Number(data.okCount || 0),
        skipCount: Number(data.skipCount || 0),
        total: Number(data.total || 0),
      };
    }
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  try {
    console.log(`[ApiPrecache] Vague ${label} — ${urls.length} endpoints → SW`);
    sw.postMessage({ type: 'PRECACHE_API', urls, headers });

    const start = Date.now();
    while (!ack.value && Date.now() - start < API_ACK_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    return ack.value;
  } finally {
    navigator.serviceWorker.removeEventListener('message', onMessage);
  }
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

  const ctx = readSessionContext();

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
  if (ctx.tenantId && !headers['X-Tenant-ID']) {
    headers['X-Tenant-ID'] = ctx.tenantId;
  }

  // ─── VAGUE 1 : statique (tous les onglets de tous les modules) ───
  const staticUrls = buildApiPrecacheUrls(apiBase, ctx);
  const staticAck = await dispatchWaveAndWaitAck(sw, staticUrls, headers, '1 (statique)');

  // ─── VAGUE 2 : dynamique par entité (notes/EDT/enfants/niveaux/trimestre) ───
  //    Construite en lisant les listes de la vague 1 (déjà en cache SW).
  let dynamicAck: WaveAck | null = null;
  try {
    const dynamicUrls = await buildDynamicPrecacheUrls(apiBase, ctx, headers);
    dynamicAck = await dispatchWaveAndWaitAck(sw, dynamicUrls, headers, '2 (dynamique)');
  } catch {
    console.warn('[ApiPrecache] Vague 2 (dynamique) — échec non bloquant');
  }

  // ─── Flag 24 h : agrégat des 2 vagues, skip-aware ───
  const okCount = (staticAck?.okCount || 0) + (dynamicAck?.okCount || 0);
  const skipCount = (staticAck?.skipCount || 0) + (dynamicAck?.skipCount || 0);
  const total = (staticAck?.total || 0) + (dynamicAck?.total || 0);
  const applicable = Math.max(total - skipCount, 0);

  if (applicable > 0 && okCount / applicable >= API_MIN_SUCCESS_RATE) {
    try {
      localStorage.setItem(API_PRECACHE_TS_KEY, String(Date.now()));
    } catch { /* localStorage indisponible */ }
    console.log(
      `[ApiPrecache] Complete — ${okCount} cachés / ${applicable} applicables ` +
      `(${skipCount} non applicables au rôle, ${total - skipCount - okCount} en échec)`,
    );
  } else {
    // Pas de flag → re-tentative au prochain montage ou au retour du réseau
    console.warn(
      `[ApiPrecache] Incomplete — ${okCount}/${applicable} applicables ` +
      `(${staticAck ? 'ACK vague 1 ok' : 'ACK vague 1 manquant'}) — flag non posé`,
    );
  }
}
