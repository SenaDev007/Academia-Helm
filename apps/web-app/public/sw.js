/**
 * ============================================================================
 * SERVICE WORKER UNIFIÉ — Academia Helm (v3.3 « offline lecture API GET »)
 * ============================================================================
 *
 * ⭐ SW UNIQUE à la racine du domaine (scope: '/'). NE PAS enregistrer
 *    d'autres service workers au même scope — les anciens sw-offline.js,
 *    sw-site.js et sw-chat.js sont OBSOLÈTES et sont désinstallés par
 *    UniversalSWRegister à la première visite.
 *
 * v3.4.0 : (1) CORRECTIF CRITIQUE (retour terrain « connexion indisponible
 *    pour /app/pedagogy » hors ligne) — le multi-tenant SANS sous-domaine fait
 *    naviguer l'app avec ?tenant=… sur TOUS les liens (sidebar, redirections
 *    post-login) ; les entrées pré-cachées SANS query ne matchaient JAMAIS
 *    ces navigations (Cache.match exact) → réponse sobre même avec un
 *    pré-cache complet. Désormais les handlers HTML/RSC matchent en cascade :
 *    exact → sans query params (ignoreSearch) ; et le pré-cache embarque le
 *    ?tenant= courant envoyé par le client.
 *    (2) PRÉ-CACHE FIABILISÉ — le SW ACK chaque route (message
 *    PRECACHE_MODULE_RESULT) : le client ne marque le pré-cache « frais » QUE
 *    si ≥ 90 % des routes ont réussi (retries incluses) — sinon il est
 *    retenté au prochain montage / au retour du réseau (fini le fire-and-
 *    forget aveugle dont le flag optimiste masquait les échecs 2G/3G).
 *    (3) PRÉ-CACHE RSC — payload flight par route (best-effort) → navigation
 *    client hors ligne SANS rechargement dur.
 *    (4) Vary supprimé des copies mises en cache (une entrée RSC cachée
 *    depuis un prefetch ne matchait JAMAIS une navigation : Vary mismatch).
 *    (5) réponse sobre enrichie : page HTML sobre + auto-rechargement au
 *    retour du réseau (script inline « online » → reload).
 *
 * v3.3.1 : (1) à l'activation, les pages ouvertes sont notifiées
 *    (SW_ACTIVATED) afin d'invalider le flag 24 h du pré-cache des modules
 *    — les caches ah-pages-<version> étant purgés à chaque version, un flag
 *    « frais » survivant au bump de version laissait l'app SANS modules
 *    offline (le shell dashboard était servi à la place des modules) ;
 *    (2) réponse au message GET_SW_VERSION (le client compare la version
 *    active du SW à celle enregistrée au dernier pré-cache) ;
 *    (3) le fallback shell /app n'est servi QUE pour la racine /app — pour
 *    un module profond non caché, réponse sobre (jamais le dashboard).
 *
 * Responsabilités (fusion v3, sept. 2026) :
 *   1. WEB PUSH + notificationclick + pushsubscriptionchange
 *   2. APP-SHELL OFFLINE pour /app/* (pattern PWA) :
 *        - offline → cache exact de la route, sinon shell /app pré-caché
 *        - online  → réseau (8 s timeout) → cache write → fallback shell
 *      ⭐ AUCUNE page « Mode hors ligne » plein écran N'EST JAMAIS servie :
 *        l'utilisateur garde ses données (IndexedDB) et peut continuer à
 *        travailler — un simple toast ≤ 10 s l'informe du passage hors ligne.
 *   3. BACKGROUND SYNC (tag 'sync-outbox') : quand l'onglet est fermé et que
 *      le réseau revient, le SW pousse lui-même l'outbox IndexedDB vers
 *      /api/sync/push (JWT miroité dans Cache API par client-access-token.ts).
 *   4. PRÉ-CACHE DE MODULES (message PRECACHE_MODULE) : HTML + chunks JS/CSS
 *      des routes /app/* visitées, pour naviguer hors ligne.
 *   5. FETCH handler avec cache prudent :
 *        - Assets statiques immuables (_next/static, images, fonts)
 *          → CacheFirst (1 an)
 *        - Navigations HTML PUBLIQUES (site institutionnel, login, landing)
 *          → NetworkFirst (4 s timeout) + fallback cache + shell /app
 *        - ⭐ v3.3.0 — API GET /api/* (hors auth/sync) → NetworkFirst (8 s)
 *          + cache CACHÉ IDENTITAIRE (clé scopée par tenant/session via
 *          cookies d'identité + Authorization → aucune fuite cross-tenant)
 *          + fallback offline → 503 rapide si absent du cache.
 *          Concerne TOUTES les UI (dashboards, sidebar feature codes,
 *          enseignant, parent, secrétaire, site public…) — le SW étant SOUS
 *          tous les fetch de la page, aucune race d'installation possible.
 *        - Tout le reste (mutations, /platform/*, cross-origin)
 *          → PAS D'INTERCEPTION (réseau direct)
 *
 * ⛔ JAMAIS de cache pour :
 *   - /api/auth/*, /api/sync/*, /api/*-auth/* (sessions/tokens — toujours réseau)
 *   - les mutations POST/PUT/PATCH/DELETE (jamais interceptées — GET uniquement)
 *   - /app/*, /platform/*, /patronat, /federis, /saisiemaster
 *     (pages authentifiées — servies via l'app-shell, pas mises en cache HTML)
 *   - les scripts SW eux-mêmes (/sw*.js)
 * ⛔ JAMAIS de page « hors ligne » de substitution (supprimée volontairement :
 *    expérience WhatsApp — l'app reste utilisable, un toast suffit).
 * ============================================================================
 */

const SW_VERSION = 'v3.4.0';
const STATIC_CACHE = `ah-static-${SW_VERSION}`;
const PAGE_CACHE = `ah-pages-${SW_VERSION}`;
const AUTH_CACHE = 'ah-auth-token'; // ⭐ miroir JWT pour le background sync — JAMAIS purgé

// ⭐ v3.1.0 — CACHE IMMUABLE PERSISTANT (JAMAIS purgé, même à l'activation
//    d'une nouvelle version du SW) : les chunks /_next/static/ sont immuables
//    par définition (hash dans le nom). Avant, ils vivaient dans
//    ah-static-<version> → CHAQUE mise à jour du SW purgeait TOUS les chunks
//    → re-téléchargement complet sur réseau instable → « Failed to load chunk »
//    massif. Désormais les chunks survivent aux mises à jour du SW (les vieux
//    builds restent en cache : un onglet resté ouvert sur l'ancien build
//    continue de fonctionner). Contrepartie : taille croissante — purgée
//    uniquement via CLEAR_CACHE (dépannage explicite).
const IMMUTABLE_CACHE = 'ah-static-immutable';

// ⭐ v3.2.0 — CACHE DES PAYLOADS RSC (flight du routeur Next 16).
//    PROBLÈME (sept. 2026) : la navigation client (changement de module/
//    onglet) fetch le payload RSC de la route cible (headers `rsc: 1`,
//    `next-router-prefetch`, param `?_rsc=`). Ces requêtes n'étaient PAS
//    interceptées → réseau direct → hors ligne : échec → SPINNER INFINI
//    (« la page tourne ») jusqu'au retour du réseau.
//    Désormais : en ligne → réponse mise en cache ; hors ligne/réseau KO →
//    cache servi ; pas de cache → 503 IMMÉDIAT (le routeur déclenche
//    l'error boundary → UI hors ligne, JAMAIS de spinner infini).
//    Clés normalisées SANS le param _rsc (le hash varie par build → les
//    prefetch d'un build restent réutilisables). LRU : max 250 entrées.
const RSC_CACHE = 'ah-rsc';
// ⭐ v3.4.0 — 250 (121 routes de modules pré-cachées + navigations normales :
//    avec 150, le LRU évictait les entrées de modules au profit des visites).
const RSC_CACHE_MAX = 250;
const RSC_TIMEOUT = 4000;

// ⭐ v3.3.0 — CACHE DES RÉPONSES API GET (lecture hors ligne).
//    PROBLÈME (sept. 2026, retour terrain) : hors ligne, après un changement
//    de module (navigation complète servie par le SW), la sidebar tombait à
//    4 modules (feature codes /api/settings/features non servis) et AUCUNE
//    donnée ne s'affichait (agrégats /api/general/* vides). Causes :
//    - le SW n'interceptait AUCUNE requête /api/* (NEVER_INTERCEPT) ;
//    - le fallback IndexedDB de la page échoue silencieusement pour les
//      réponses sans champ `id` (stores keyPath:'id') — listes de features,
//      objets d'agrégats… jamais cachées.
//    Désormais : NetworkFirst (8 s) → cache 200 JSON ; hors ligne / réseau KO
//    → dernière réponse en cache ; absent → 503 IMMÉDIAT (jamais de spinner).
//    CLÉ IDENTITAIRE : la clé de cache intègre un hash des identifiants de la
//    requête (Authorization, cookies d'identité, x-tenant-id) → un utilisateur
//    d'une AUTRE école/session ne peut jamais être servi avec le cache du
//    précédent (isolation tenant stricte, même offline).
//    Requêtes avec cookies mais SANS identité reconnue → réseau direct (pas
//    de cache — anti-fuite). Requêtes anonymes (site public) → clé URL simple.
const API_CACHE = 'ah-api';
const API_CACHE_MAX = 300;
const API_TIMEOUT = 8000;

// ⭐ Shell pré-caché au premier install : l'app PWA démarre hors ligne sans
//    page de substitution. '/login' couvre la start_url, '/app' l'application.
// ⭐ v3.2.0 : + pages publiques principales → le site public fonctionne hors
//    ligne dès le premier visite (sinon seules les pages DÉJÀ visitées en
//    ligne l'étaient — « rien ne fonctionne en mode hors ligne »).
const PRECACHE_URLS = [
  '/app',
  '/login',
  '/manifest.json',
  '/', // site institutionnel (racine du sous-domaine école)
  '/portal',
  '/tarification',
  '/modules',
  '/contact',
  '/actualites',
];

// Assets statiques mutables (images, uploads — versionnés, purge à chaque version)
const STATIC_ASSET_PATTERNS = [
  /\/_next\/image\//,
  /\/images\//,
  /\/fonts\//,
  /\/icons\//,
  /\/logos\//,
  /\/sounds\//,
  /\/uploads\//,
  /\/pwa-icon\?/,
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp3|mp4|wav)$/i,
];

// ⭐ Chunks immuables Next.js (Turbopack : /_next/static/immutable/chunks/...)
//    → cache PERSISTANT (IMMUTABLE_CACHE) — cf. commentaire ci-dessus.
const IMMUTABLE_ASSET_PATTERNS = [
  /\/_next\/static\//,
];

// Pages HTML dont le cache hors-ligne est AUTORISÉ (publiques uniquement)
const CACHEABLE_HTML_PATTERNS = [
  /^\/$/, // site institutionnel (racine du sous-domaine)
  /^\/school-portal(\/|$)/, // site institutionnel école
  /^\/login(\/|$)/, // connexion (start_url de l'app PWA)
  /^\/portal(\/|$)/, // sélection de portails
  /^\/jobs(\/|$)/, // recrutement
  /^\/actualites(\/|$)/,
  /^\/public\/pre-enrollment(\/|$)/, // pré-inscription
  /^\/federis(\/|$)/,
  /^\/en(\/|$)/,
  /^\/contact(\/|$)/,
  /^\/tarification(\/|$)/,
  /^\/modules(\/|$)/,
  /^\/blog(\/|$)/,
  /^\/downloads(\/|$)/,
  /^\/tenant-not-found(\/|$)/,
];

// ⛔ Requêtes à ne JAMAIS intercepter
const NEVER_INTERCEPT = [
  // ⭐ v3.3.0 — API : uniquement auth/sync/webhooks restent hors cache (tokens,
  //    sessions, files d'attente). Les AUTRES /api/* GET passent désormais par
  //    handleApiGet (NetworkFirst + cache identitaire + fallback offline).
  /^\/api\/(auth|admin-auth|school-auth|portal\/auth|sync|webhooks?|billing\/webhook|health|monitoring)(\/|$)/,
  /^\/platform\//, // back-office admin
  /^\/patronat(\/|$)/,
  /^\/saisiemaster(\/|$)/,
  /^\/admin(\/|$)/, // routes admin
  /^\/sign\//, // signature de contrats (tokens)
  /^\/receipt\//, // reçus (tokens)
  /^\/sw[\w.-]*\.js$/, // scripts service worker
  /^\/manifest.*\.webmanifest$/, // manifests dynamiques (toujours frais)
];

// ⭐ Timeouts : Neon cold start = 10-13 s → 8 s HTML avant fallback shell
const HTML_TIMEOUT = 8000;

// ─── INSTALL : pré-cache du shell hors ligne ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
      )
      .then(() => self.skipWaiting()),
  );
});

// ─── ACTIVATE : nettoyage des anciens caches + claim ──────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // ⭐ v3.1.0 — MIGRATION : avant de purger les anciens ah-static-*, on
      //    transfère les chunks /_next/static/ (immuables) vers IMMUTABLE_CACHE
      //    pour ne PAS perdre le cache offline des utilisateurs existants.
      try {
        const allNames = await caches.keys();
        const legacyNames = allNames.filter(
          (n) => n.startsWith('ah-static-') && n !== IMMUTABLE_CACHE,
        );
        const immutable = await caches.open(IMMUTABLE_CACHE);
        for (const legacyName of legacyNames) {
          const legacy = await caches.open(legacyName);
          const keys = await legacy.keys();
          await Promise.all(
            keys.map(async (req) => {
              if (req.url.includes('/_next/static/')) {
                const res = await legacy.match(req);
                if (res) await immutable.put(req, res);
              }
            }),
          );
        }
      } catch {
        // Migration non-bloquante
      }

      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('ah-') && !name.startsWith(AUTH_CACHE) &&
            name !== IMMUTABLE_CACHE && // ⭐ chunks immuables JAMAIS purgés
            name !== RSC_CACHE && // ⭐ payloads RSC — survivent aux mises à jour (LRU)
            name !== API_CACHE && // ⭐ v3.3.0 — réponses API GET — survivent (LRU, NetworkFirst en ligne)
            !name.endsWith(SW_VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();

      // ⭐ v3.3.1 — Notifier les pages ouvertes : la version du SW vient de
      //    changer → les caches versionnés (ah-pages-*) ont été purgés → le
      //    flag 24 h du pré-cache des modules (localStorage, côté client) est
      //    désormais PÉRIMÉ et doit être invalidé, sinon l'app n'a plus AUCUN
      //    module offline jusqu'à l'expiration du flag (symptôme : le shell
      //    dashboard est servi à la place des modules après un déploiement).
      try {
        const clientList = await self.clients.matchAll({ type: 'window' });
        for (const client of clientList) {
          client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
        }
      } catch {
        /* non-bloquant */
      }
    })(),
  );
});

// ─── FETCH : stratégies de cache prudentes ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Uniquement GET, même origine
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // Routes interdites → réseau direct
  if (NEVER_INTERCEPT.some((pattern) => pattern.test(pathname))) return;

  // ⭐ v3.2.0 — Requêtes RSC/flight du routeur Next 16 (navigation client) :
  //    `rsc: 1` (navigation), `next-router-prefetch: 1` (préchargement liens),
  //    `next-router-segment-prefetch` (segments), `?_rsc=` (clé de cache).
  //    AVANT : aucune interception → hors ligne, échec réseau direct →
  //    SPINNER INFINI au changement de module. MAINTENANT : cache + 503 rapide.
  if (isRscRequest(request, url)) {
    event.respondWith(handleRsc(request));
    return;
  }

  // ⭐ v3.3.0 — API GET /api/* : NetworkFirst + cache identitaire + fallback
  //    offline (les chemins auth/sync/webhooks ont déjà été exclus par
  //    NEVER_INTERCEPT ci-dessus ; les non-GET sont sortis en tête de handler).
  if (pathname.startsWith('/api/')) {
    event.respondWith(handleApiGet(request));
    return;
  }

  // ⭐ Chunks immuables /_next/static/ → cache PERSISTANT + retry réseau
  if (IMMUTABLE_ASSET_PATTERNS.some((pattern) => pattern.test(request.url))) {
    event.respondWith(serveImmutable(request));
    return;
  }

  // ─── Assets statiques (mutables) : CacheFirst ────────────────────────
  if (STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(request.url))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // ─── Navigations HTML ──────────────────────────────────────────────────
  const isHtmlNavigation =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isHtmlNavigation) {
    // ⭐ PATTERN APP-SHELL : les navigations /app/* passent par le shell
    //    pré-caché → l'app React démarre depuis le cache, les données viennent
    //    d'IndexedDB. AUCUNE page « hors ligne » n'est jamais substituée.
    if (pathname.startsWith('/app')) {
      event.respondWith(handleAppShellNavigation(request));
      return;
    }

    // Pages publiques autorisées au cache HTML
    if (CACHEABLE_HTML_PATTERNS.some((pattern) => pattern.test(pathname))) {
      event.respondWith(handlePublicPageNavigation(request));
      return;
    }

    // Autres navigations (non listées) → réseau direct, PAS d'interception
    return;
  }

  // Chunks JS/CSS dynamiques Next.js (hors /static/) → cache persistant + retry
  if (url.pathname.includes('/_next/') && (pathname.endsWith('.js') || pathname.endsWith('.css'))) {
    event.respondWith(serveImmutable(request));
    return;
  }

  // Tout le reste : pas d'interception (réseau direct)
});

// ─── Requêtes RSC/flight : cache + fallback offline + échec rapide ───────
function isRscRequest(request, url) {
  if (request.method !== 'GET') return false;
  const h = request.headers;
  if (h.has('rsc')) return true; // navigation du routeur
  if (h.has('next-router-prefetch')) return true; // prefetch des <Link>
  if (h.has('next-router-segment-prefetch')) return true;
  if (h.has('next-router-state-tree')) return true;
  if ((h.get('accept') || '').includes('text/x-component')) return true;
  try {
    if (url.searchParams.has('_rsc')) return true;
  } catch {
    /* URL déjà validée en amont */
  }
  return false;
}

/** Clé de cache normalisée : URL SANS le param _rsc (hash par build).
 *  Accepte un Request OU une URL en string (le pré-cache v3.4.0 passe une URL). */
function rscCacheKey(requestOrUrl) {
  const u = new URL(typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url);
  u.searchParams.delete('_rsc');
  return u.toString();
}

// ─── v3.4.0 — Helpers de cache fiables ──────────────────────────────────

/** En-têtes « cachables » : SANS Vary (une entrée cachée depuis un prefetch
 *  ne matcherait JAMAIS une navigation : Vary: RSC, Next-Router-Prefetch…),
 *  SANS Content-Encoding/Length (le corps est décodé par .text()). */
function cacheableHeaders(response) {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === 'vary' || lk === 'content-encoding' || lk === 'content-length') return;
    headers.set(key, value);
  });
  return headers;
}

/** Copie « cachable » d'une réponse (Vary retiré, corps décodé).
 *  ⚠️ clone() AVANT tout await → utilisable en fire-and-forget pendant que
 *  la réponse d'origine est renvoyée à la page. */
async function toCacheableCopy(response) {
  const clone = response.clone();
  const headers = cacheableHeaders(response);
  const body = await clone.text();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** ⭐ v3.4.0 — Matching en cascade : exact PUIS sans query params.
 *    CORRECTIF CRITIQUE : les liens de l'app portent tous ?tenant=… (mode
 *    multi-tenant SANS sous-domaine) alors que le pré-cache stockait des
 *    routes SANS query → cache.match(request) échouait TOUJOURS hors ligne
 *    → « connexion indisponible pour /app/<module> » même pré-caché. */
async function matchRouteCache(cache, requestOrUrl) {
  try {
    const exact = await cache.match(requestOrUrl);
    if (exact) return exact;
    const loose = await cache.match(requestOrUrl, { ignoreSearch: true });
    return loose || null;
  } catch {
    return null;
  }
}

async function handleRsc(request) {
  const cache = await caches.open(RSC_CACHE);
  const key = rscCacheKey(request);
  const offline = !self.navigator || self.navigator.onLine === false;

  if (!offline) {
    try {
      const response = await fetchWithTimeout(request, RSC_TIMEOUT);
      if (response && response.status === 200 && !response.redirected) {
        // ⭐ v3.4.0 — copie SANS Vary : une entrée cachée depuis un prefetch
        //    (Next-Router-Prefetch: 1) ne matchait JAMAIS une navigation réelle
        //    (Vary mismatch) → le cache RSC semblait vide hors ligne.
        toCacheableCopy(response)
          .then((copy) => cache.put(new Request(key), copy))
          .then(() => trimRscCache())
          .catch(() => {});
      }
      return response;
    } catch {
      // Réseau KO (connexion instable) → tentative de cache ci-dessous
    }
  }

  // Hors ligne (ou réseau KO) → payload en cache ?
  // ⭐ v3.4.0 — cascade exact → ignoreSearch : le pré-cache stocke la clé
  //    SANS le ?tenant= courant, les navigations réelles l'ont AVEC.
  let cached = null;
  try {
    cached = await matchRouteCache(cache, key);
  } catch {
    /* cache illisible */
  }
  if (cached) return cached;

  // Pas de cache + réseau indisponible → échec RAPIDE (fini le spinner
  // infini) : le routeur Next déclenche l'error boundary → UI hors ligne.
  return new Response(
    JSON.stringify({ error: 'offline', message: 'Page non disponible hors ligne (payload RSC absent du cache)' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
    },
  );
}

/** LRU simple : garde au plus RSC_CACHE_MAX entrées (ordre d'insertion). */
async function trimRscCache() {
  try {
    const cache = await caches.open(RSC_CACHE);
    const keys = await cache.keys();
    if (keys.length > RSC_CACHE_MAX) {
      const excess = keys.slice(0, keys.length - RSC_CACHE_MAX);
      await Promise.all(excess.map((k) => cache.delete(k)));
    }
  } catch {
    /* non-bloquant */
  }
}

// ─── API GET : NetworkFirst + cache identitaire + fallback offline ────────

/** Hash FNV-1a 32 bits — condense l'identité (Authorization/cookies) en clé. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/**
 * Identité de la requête pour le scoping du cache API (isolation tenant).
 * Sources reconnues, par ordre de fiabilité :
 *   - header `x-tenant-id`
 *   - header `Authorization` (Bearer JWT — signature distinctive en queue)
 *   - cookies d'identité (noms contenant token/session/tenant/auth :
 *     academia_session, academia_token, x-tenant-id, …)
 * Retour :
 *   - string non vide → identité → clé = URL + '?__ah_t=' + hash
 *   - null            → cookies présents mais AUCUNE identité reconnue →
 *                       réseau direct, JAMAIS servi depuis le cache (anti-fuite
 *                       cross-tenant sur contexte de session inconnu)
 *   - 'ANONYMOUS'     → ni identité ni cookies → données publiques → clé = URL
 */
function apiIdentity(request) {
  const parts = [];
  const xtid = request.headers.get('x-tenant-id');
  if (xtid) parts.push('xtid:' + xtid);
  const authz = request.headers.get('authorization');
  if (authz) parts.push('authz:' + authz.length + ':' + authz.slice(-48));
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const pairs = cookieHeader.split(';').map((s) => s.trim()).filter(Boolean);
    const identityPairs = pairs.filter((p) => {
      const name = (p.split('=')[0] || '').toLowerCase();
      return /token|session|tenant|auth/.test(name);
    });
    if (identityPairs.length) parts.push('cookie:' + identityPairs.join('&'));
  }
  if (parts.length) return parts.join('|');
  if (cookieHeader) return null;
  return 'ANONYMOUS';
}

async function handleApiGet(request) {
  const identity = apiIdentity(request);
  // Contexte de session inconnu (cookies sans identité reconnue) → réseau
  // direct : on ne met PAS en cache et on ne sert JAMAIS depuis le cache.
  if (identity === null) return fetch(request);

  const key = identity === 'ANONYMOUS'
    ? request.url
    // ⚠️ PAS de fragment (#) — le constructeur Request SUPPRIME les fragments
    // d'URL → la clé perdrerait son scope identitaire. On utilise un query
    // param (préservé dans request.url, comme _rsc pour le cache RSC).
    : request.url + (request.url.includes('?') ? '&' : '?') + '__ah_t=' + fnv1a(identity);
  const cache = await caches.open(API_CACHE);
  const offline = !self.navigator || self.navigator.onLine === false;

  if (!offline) {
    try {
      const response = await fetchWithTimeout(request, API_TIMEOUT);
      if (response && response.status === 200 && !response.redirected) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('json')) {
          // ⭐ v3.4.0 — copie SANS Vary (la clé identitaire __ah_t protège
          //    déjà l'isolation tenant : le Vary sur la copie cachée ne
          //    servait qu'à faire échouer le matching).
          toCacheableCopy(response)
            .then((copy) => cache.put(new Request(key), copy))
            .then(() => trimApiCache())
            .catch(() => {});
        }
      }
      return response;
    } catch {
      // Réseau KO (2G/3G instable) → fallback cache ci-dessous
    }
  }

  // Hors ligne (ou réseau KO) → dernière réponse en cache ?
  let cached = null;
  try {
    cached = await cache.match(key);
  } catch {
    /* cache illisible */
  }
  if (cached) return cached;

  // Pas de cache + réseau indisponible → échec RAPIDE avec corps explicite :
  // le fetcher de la page (fetchJson → null, offlineFetch → IDB) gère ce 503
  // proprement — JAMAIS de spinner infini.
  return new Response(
    JSON.stringify({ error: 'offline', message: 'Données non disponibles hors ligne (aucune copie locale)' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
    },
  );
}

/** LRU simple : garde au plus API_CACHE_MAX entrées (ordre d'insertion). */
async function trimApiCache() {
  try {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    if (keys.length > API_CACHE_MAX) {
      const excess = keys.slice(0, keys.length - API_CACHE_MAX);
      await Promise.all(excess.map((k) => cache.delete(k)));
    }
  } catch {
    /* non-bloquant */
  }
}

// ─── Chunks immuables : CacheFirst persistant + retry réseau ────────────
// ⭐ Réseau instable (2G/3G) : le 1er fetch d'un chunk échoue souvent →
//    1 RETRY automatique côté SW AVANT de laisser l'erreur remonter au
//    runtime Next (sinon : « Failed to load chunk ... from module N » →
//    error boundary). Si le réseau rejette 2 fois, l'erreur remonte : le
//    client la gère (rechargement anti-boucle, cf. chunk-recovery.ts).
async function serveImmutable(request) {
  const cached = await caches.match(request, { cacheName: IMMUTABLE_CACHE });
  if (cached) return cached;

  try {
    return await fetchAndCacheImmutable(request);
  } catch (firstError) {
    // Réseau instable → courte pause puis 1 nouvelle tentative
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      return await fetchAndCacheImmutable(request);
    } catch (secondError) {
      // Pas de cache + réseau KO : erreur réseau (le client gère la récupération)
      throw secondError;
    }
  }
}

async function fetchAndCacheImmutable(request) {
  const response = await fetch(request);
  if (response && response.status === 200) {
    const clone = response.clone();
    // Pas d'await : ne pas bloquer la réponse sur l'écriture du cache
    caches.open(IMMUTABLE_CACHE).then((cache) => cache.put(request, clone));
  }
  return response;
}

// ─── Handler : navigations /app/* (app shell, jamais de page offline) ─────

/** ⭐ v3.3.1 — La racine de l'app uniquement (pas les modules profonds). */
function isAppRootNavigation(pathname) {
  return pathname === '/app' || pathname === '/app/';
}

async function handleAppShellNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);

  // ⭐ ÉTAPE 1 : hors ligne (navigator.onLine === false) → cache immédiat
  //    (zéro latence — pas de timeout inutile, pas de page blanche)
  if (!self.navigator || self.navigator.onLine === false) {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (liens ?tenant=…)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.3.1 : shell /app UNIQUEMENT pour la racine — pour un module
    //    profond (/app/finance, /app/hr…) non caché, servir le shell du
    //    dashboard était TROMPEUR (l'hydratation Next rend le dashboard
    //    avec les données du dashboard). Réponse sobre à la place.
    if (isAppRootNavigation(url.pathname)) {
      const cachedShell = await matchRouteCache(cache, '/app');
      if (cachedShell) return cachedShell; // app shell → routing client + IndexedDB
    }
  }

  // ⭐ ÉTAPE 2 : en ligne (ou détection navigateur incertaine) → réseau avec
  //    timeout, cache write, puis fallback shell SANS page « hors ligne ».
  try {
    const networkResponse = await fetchWithTimeout(request, HTML_TIMEOUT);
    if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary (fire-and-forget : la réponse est rendue
      //    à la page immédiatement, la copie se fait en arrière-plan).
      //    ⚠️ PAS de cache des réponses REDIRIGÉES (session expirée → le
      //    middleware renvoie la page login : l'embarquer sous la clé du
      //    module empoisonnerait le cache offline).
      toCacheableCopy(networkResponse)
        .then((copy) => cache.put(request, copy))
        .catch(() => {});
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch {
    // Réseau échoué/timeout (Wifi sans Internet, Neon qui se réveille…)
    // → cache exact de la route si déjà visitée
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (liens ?tenant=…)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.3.1 : shell /app UNIQUEMENT pour la racine (cf. ÉTAPE 1) —
    //    jamais le dashboard en substitut d'un module profond non caché.
    if (isAppRootNavigation(url.pathname)) {
      const cachedShell = await matchRouteCache(cache, '/app');
      if (cachedShell) return cachedShell;
    }
    // Dernier recours (shell pas encore pré-caché, ex. SW fraîchement installé
    // offline) : réponse sobre NON-bloquante — un texte simple, PAS une page
    return offlineMinimalResponse(url.pathname);
  }
}

// ─── Handler : navigations publiques (cache + shell, jamais de page offline) ─
async function handlePublicPageNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);

  if (!self.navigator || self.navigator.onLine === false) {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch : /login?portal=school&tenant=x
    //    matche désormais l'entrée pré-cachée /login (start_url PWA).
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.2.0 : plus de shell /login|/app pour une page publique non visitée
    //    (rendre la page de connexion sous /tarification est trompeur) →
    //    réponse sobre non-bloquante.
    return offlineMinimalResponse(url.pathname);
  }

  try {
    const networkResponse = await fetchWithTimeout(request, 4000);
    if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary (fire-and-forget)
      toCacheableCopy(networkResponse)
        .then((copy) => cache.put(request, copy))
        .catch(() => {});
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (login/portal avec ?tenant=)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    return offlineMinimalResponse(url.pathname);
  }
}

// ⭐ Réponse minimale de dernier recours — volontairement sobre (pas de
//    layout complet) MAIS auto-récupérable (v3.4.0) : elle n'est servie que
//    lorsqu'aucune copie locale n'existe (cas ultra-marginal : module jamais
//    pré-caché + navigateur hors ligne). Un script inline recharge la page
//    dès le retour du réseau (« online ») — l'utilisateur n'a plus besoin
//    de recharger manuellement après sa reconnexion.
function offlineMinimalResponse(pathname) {
  const safePath = String(pathname).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const body = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Academia Helm — hors ligne</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background:#0A2A5E; color:#e8eefc; }
  .card { max-width: 520px; padding: 32px 28px; text-align:center; }
  .logo { font-size: 20px; font-weight: 700; letter-spacing: .5px; color:#F2C94C; margin-bottom: 18px; }
  p { line-height: 1.6; font-size: 15px; color:#c7d5f2; margin:0; }
  .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color:#fff; }
  button { margin-top: 22px; padding: 12px 26px; border:0; border-radius: 10px;
    background:#F2C94C; color:#0A2A5E; font-weight:600; font-size:15px; cursor:pointer; }
  .hint { margin-top:14px; font-size:12px; color:#8fa8d8; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">ACADEMIA HELM</div>
    <p>Connexion indisponible pour <span class="path">${safePath}</span>.<br>
    Reconnectez-vous puis rechargez la page&nbsp;: vos données locales restent intactes.</p>
    <button onclick="window.location.reload()">Réessayer</button>
    <div class="hint">Cette page se rechargera automatiquement au retour du réseau.</div>
  </div>
  <script>
    window.addEventListener('online', function () { window.location.reload(); });
  </script>
</body>
</html>`;
  return new Response(body, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ─── Helpers réseau ───────────────────────────────────────────────────────
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Timeout'));
    }, timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

// ─── MESSAGE : update manuelle + pré-cache de module ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // ⭐ v3.3.1 — Version du SW actif : le client la compare à la version
  //    enregistrée lors du dernier pré-cache des modules (les caches
  //    ah-pages-<version> sont purgés à chaque bump → le pré-cache doit
  //    être refait). Réponse envoyée à la source du message (la page).
  if (event.data?.type === 'GET_SW_VERSION') {
    try {
      if (event.source && typeof event.source.postMessage === 'function') {
        event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
      }
    } catch {
      /* client parti — non-bloquant */
    }
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      Promise.all(
        names
          .filter((n) => n !== AUTH_CACHE)
          .map((n) => caches.delete(n)),
      );
    });
  }

  // ⭐ PRÉ-CACHE DE MODULE — le client demande au SW de fetcher une route
  //    et de mettre en cache son HTML + les chunks JS/CSS référencés.
  //    ⭐ v3.4.0 — la source du message est passée au pré-cache pour l'ACK
  //    (PRECACHE_MODULE_RESULT) : le client sait désormais si la route a
  //    RÉELLEMENT été mise en cache (fini le fire-and-forget aveugle).
  if (event.data && event.data.type === 'PRECACHE_MODULE' && event.data.url) {
    event.waitUntil(precacheModule(event.data.url, event.source));
  }
});

// ─── Pré-cache d'un module (HTML + chunks JS/CSS + payload RSC) ───────────
/**
 * ⭐ v3.4.0 — Trois changements :
 *   1. ACK systématique à la page émettrice (PRECACHE_MODULE_RESULT) — le
 *      client ne marque le pré-cache « frais » que si les routes réussissent.
 *   2. Le HTML est stocké via une copie SANS Vary (le Cache.match d'une
 *      navigation réelle échouait sur les entrées stockées avec Vary).
 *   3. Le payload RSC de la route est pré-caché (best-effort) → navigation
 *      client hors ligne SANS rechargement dur ; si le payload ne matche pas
 *      les attentes du routeur, celui-ci retombe de toute façon sur la
 *      navigation dure → HTML caché (comportement v3.3).
 */
async function precacheModule(routeUrl, sourceClient) {
  let htmlOk = false;
  let rscOk = false;
  try {
    const cache = await caches.open(PAGE_CACHE);
    const staticCache = await caches.open(IMMUTABLE_CACHE); // ⭐ chunks immuables — cache persistant

    const response = await fetchWithTimeout(new Request(routeUrl, {
      credentials: 'include',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    }), 10000);

    if (response && response.ok && !response.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary : les navigations réelles (?tenant=…, sans
      //    headers RSC) matchent désormais l'entrée (Vary: RSC, Next-Router-*
      //    faisait échouer le matching de Cache).
      //    ⚠️ PAS de cache des réponses REDIRIGÉES (tenant invalide/session
      //    expirée → middleware renvoie /portal ou /login : embarquer cette
      //    page sous la clé du module empoisonnerait le cache offline).
      const headers = cacheableHeaders(response);
      const html = await response.text();
      await cache.put(routeUrl, new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }));
      htmlOk = true;

      const chunkUrls = new Set();

      const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
      const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;

      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const src = match[1];
        if (src && (src.includes('/_next/') || src.endsWith('.js'))) {
          chunkUrls.add(new URL(src, routeUrl).href);
        }
      }
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        if (href && (href.includes('/_next/') || href.endsWith('.css'))) {
          chunkUrls.add(new URL(href, routeUrl).href);
        }
      }

      const chunks = Array.from(chunkUrls);
      const BATCH = 5;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async (chunkUrl) => {
            try {
              const existing = await staticCache.match(chunkUrl);
              if (existing) return; // déjà caché, skip
              const chunkRes = await fetchWithTimeout(new Request(chunkUrl), 8000);
              if (chunkRes && chunkRes.ok) {
                await staticCache.put(chunkUrl, chunkRes.clone());
              }
            } catch {
              // Non-bloquant
            }
          }),
        );
      }
    }

    // ⭐ v3.4.0 — PRÉ-CACHE RSC (best-effort, APRÈS l'HTML qui reste la
    //    priorité) : payload flight de la route sous clé normalisée (sans
    //    _rsc). Ne bloque JAMAIS l'ACK HTML.
    try {
      const rscCache = await caches.open(RSC_CACHE);
      const rscUrl = routeUrl + (routeUrl.includes('?') ? '&' : '?') + '_rsc=precache';
      const rscRes = await fetchWithTimeout(new Request(rscUrl, {
        credentials: 'include',
        headers: { RSC: '1', Accept: 'text/x-component' },
      }), 10000);
      if (rscRes && rscRes.ok && !rscRes.redirected) {
        const key = rscCacheKey(rscUrl);
        const copy = await toCacheableCopy(rscRes);
        await rscCache.put(new Request(key), copy);
        rscOk = true;
        trimRscCache();
      }
    } catch {
      // Best-effort : la navigation dure (HTML caché) reste le filet de sécurité
    }
  } catch {
    // Non-bloquant — l'ACK ok:false informe le client (retry / pas de flag)
  }

  // ⭐ v3.4.0 — ACK SYSTÉMATIQUE (même en échec) : le client marque le
  //    pré-cache « frais » uniquement si les routes réussissent réellement.
  if (sourceClient && typeof sourceClient.postMessage === 'function') {
    try {
      sourceClient.postMessage({
        type: 'PRECACHE_MODULE_RESULT',
        url: routeUrl,
        ok: htmlOk,
        rscOk,
      });
    } catch {
      /* client parti — non-bloquant */
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BACKGROUND SYNC API — push de l'outbox quand l'onglet est fermé
   ══════════════════════════════════════════════════════════════════════════ */

// Constantes en phase avec local-db.service.ts (DB 'academia-helm-local'),
// client-access-token.ts (cache 'ah-auth-token') et sync-engine.service.ts
// (endpoint '/api/sync/push', batch 50).
const SW_DB_NAME = 'academia-helm-local';
const SW_DB_VERSION = 15;
const SW_OUTBOX_STORE = 'outbox_events';
const SW_AUTH_CACHE_NAME = 'ah-auth-token';
const SW_AUTH_TOKEN_URL = '/__sw_auth_token__';
const SW_SYNC_PUSH_BATCH = 50;
const SW_SYNC_MAX_RETRIES = 3;
const SW_DEVICE_ID = 'sw-bg-sync';

async function swGetAuthToken() {
  try {
    const cache = await caches.open(SW_AUTH_CACHE_NAME);
    const response = await cache.match(SW_AUTH_TOKEN_URL);
    if (!response) return null;
    const text = await response.text();
    return text && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

function swOpenLocalDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(SW_DB_NAME, SW_DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IDB open blocked'));
      req.onupgradeneeded = (event) => {
        // Le SW ne modifie JAMAIS le schéma IDB — abandon propre si migration
        event.target.transaction && event.target.transaction.abort();
      };
    } catch (err) {
      reject(err);
    }
  });
}

function swReadPendingEvents(db, limit = 500) {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(SW_OUTBOX_STORE)) {
        resolve([]);
        return;
      }
      const tx = db.transaction([SW_OUTBOX_STORE], 'readonly');
      const store = tx.objectStore(SW_OUTBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const pending = all
          .filter((e) => e && e.status === 'PENDING')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(0, limit);
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function swUpdateEventStatus(db, eventId, patch) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([SW_OUTBOX_STORE], 'readwrite');
      const store = tx.objectStore(SW_OUTBOX_STORE);
      const getReq = store.get(eventId);
      getReq.onsuccess = () => {
        const event = getReq.result;
        if (!event) {
          resolve();
          return;
        }
        const putReq = store.put({ ...event, ...patch });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    } catch (err) {
      reject(err);
    }
  });
}

function swToBackendOperation(event) {
  const tableName = (event.entityType || '').toLowerCase() + 's';
  const opMap = { CREATE: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE' };
  const operationType = opMap[event.operation] || event.operation;

  let payload = event.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      // Garder la string brute — le backend gérera
    }
  }
  payload = {
    ...(payload || {}),
    tenantId: event.tenantId,
    version: event.localVersion ?? 1,
  };

  return {
    id: event.id,
    local_id: event.id, // ⭐ idempotence backend
    table_name: tableName,
    record_id: event.entityId,
    operation_type: operationType,
    payload,
    local_updated_at: event.createdAt,
    device_id: SW_DEVICE_ID,
    priority: event.priority || 0,
  };
}

async function swPushBatch(authToken, tenantId, operations) {
  const body = {
    tenantId,
    sqliteSchemaHash: 'unknown',
    sqliteVersion: '1',
    device_id: SW_DEVICE_ID,
    operations,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Push HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * ⭐ Orchestrateur du push background.
 *    NB TENANT-STRICT : les events outbox de l'ANCIEN tenant (appareil partagé)
 *    sont purgés à la bascule par offline-bootstrap.service — et même s'il en
 *    restait, le serveur bloque toute écriture cross-tenant (JWT prime).
 */
async function swPushOutboxFromIDB() {
  const authToken = await swGetAuthToken();
  if (!authToken) {
    return; // Pas de token → rien à pousser (login au prochain chargement)
  }

  let db;
  try {
    db = await swOpenLocalDB();
  } catch {
    return; // Base absente → rien à faire
  }

  let pendingEvents;
  try {
    pendingEvents = await swReadPendingEvents(db, 500);
  } catch {
    return;
  }

  if (pendingEvents.length === 0) return;

  // Grouper par tenantId (le serveur n'applique que le tenant du JWT)
  const byTenant = new Map();
  for (const event of pendingEvents) {
    const tid = event.tenantId;
    if (!tid) continue;
    if (!byTenant.has(tid)) byTenant.set(tid, []);
    byTenant.get(tid).push(event);
  }

  for (const [tenantId, events] of byTenant) {
    for (let i = 0; i < events.length; i += SW_SYNC_PUSH_BATCH) {
      const batch = events.slice(i, i + SW_SYNC_PUSH_BATCH);
      const operations = batch.map(swToBackendOperation);

      let success = false;
      for (let attempt = 1; attempt <= SW_SYNC_MAX_RETRIES; attempt++) {
        try {
          const result = await swPushBatch(authToken, tenantId, operations);
          const results = Array.isArray(result?.results) ? result.results : [];
          const resultById = new Map(results.map((r) => [r.operation_id, r]));

          for (const event of batch) {
            const r = resultById.get(event.id);
            if (!r) continue;
            if (r.status === 'SUCCESS') {
              await swUpdateEventStatus(db, event.id, {
                status: 'ACKNOWLEDGED',
                syncedAt: new Date().toISOString(),
              });
            } else if (r.status === 'CONFLICT') {
              await swUpdateEventStatus(db, event.id, {
                status: 'CONFLICT',
                errorMessage: r.conflict_reason || 'Conflit',
                attemptCount: (event.attemptCount || 0) + 1,
                lastAttemptAt: new Date().toISOString(),
              });
            } else {
              await swUpdateEventStatus(db, event.id, {
                status: 'FAILED',
                errorMessage: r.error_message || 'Erreur (SW push)',
                retryCount: (event.retryCount || 0) + 1,
                attemptCount: (event.attemptCount || 0) + 1,
                lastAttemptAt: new Date().toISOString(),
              });
            }
          }

          success = true;
          break;
        } catch {
          if (attempt < SW_SYNC_MAX_RETRIES) {
            const delayMs = 1000 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
      // Échec réseau après retries → events laissés PENDING (retry au prochain sync)
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(
      (async () => {
        try {
          await swPushOutboxFromIDB();
        } catch {
          // Non-critique — retry au prochain event
        }
        // Notifier les clients ouverts (pull + MAJ UI — source 'sw')
        try {
          const clients = await self.clients.matchAll({ includeUncontrolled: true });
          clients.forEach((client) => {
            client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER', source: 'sw' });
          });
        } catch {
          // Non-critique
        }
      })(),
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   WEB PUSH — notifications (chat, alertes finance, absences, etc.)
   ══════════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Academia Helm', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Academia Helm';
  const options = {
    body: data.body || data.preview || '',
    icon: data.icon || '/web-app-manifest-192x192.png',
    badge: data.badge || '/web-app-manifest-192x192.png',
    data: {
      url: data.data?.url || data.url || '/',
      notificationId: data.data?.notificationId || null,
    },
    tag: data.tag || 'academia-helm-notification',
    requireInteraction: data.requireInteraction || false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click : focus ou ouvrir l'URL ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Chercher un onglet existant sur la même origine
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // PostMessage pour que le frontend navigue vers l'URL
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Aucun onglet ouvert → en ouvrir un nouveau
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// ─── Push subscription change : re-souscription ───────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
      });
    }),
  );
});
