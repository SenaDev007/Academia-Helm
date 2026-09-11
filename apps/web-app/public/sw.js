/**
 * ============================================================================
 * SERVICE WORKER UNIFIÉ — Academia Helm (v3.1 « offline-first sans page hors-ligne »)
 * ============================================================================
 *
 * ⭐ SW UNIQUE à la racine du domaine (scope: '/'). NE PAS enregistrer
 *    d'autres service workers au même scope — les anciens sw-offline.js,
 *    sw-site.js et sw-chat.js sont OBSOLÈTES et sont désinstallés par
 *    UniversalSWRegister à la première visite.
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
 *        - Tout le reste (API, /platform/*, cross-origin)
 *          → PAS D'INTERCEPTION (réseau direct — l'intercepteur global de la
 *            page lit IndexedDB en offline, cf. global-fetch-interceptor.ts)
 *
 * ⛔ JAMAIS de cache pour :
 *   - /api/* (données dynamiques + sécurité — gérées par IndexedDB/intercepteur)
 *   - /app/*, /platform/*, /patronat, /federis, /saisiemaster
 *     (pages authentifiées — servies via l'app-shell, pas mises en cache HTML)
 *   - les scripts SW eux-mêmes (/sw*.js)
 * ⛔ JAMAIS de page « hors ligne » de substitution (supprimée volontairement :
 *    expérience WhatsApp — l'app reste utilisable, un toast suffit).
 * ============================================================================
 */

const SW_VERSION = 'v3.1.0';
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

// ⭐ Shell pré-caché au premier install : l'app PWA démarre hors ligne sans
//    page de substitution. '/login' couvre la start_url, '/app' l'application.
const PRECACHE_URLS = ['/app', '/login', '/manifest.json'];

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
  /^\/api\//, // API (BFF + données dynamiques — IndexedDB/intercepteur page)
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
            !name.endsWith(SW_VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
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
async function handleAppShellNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);

  // ⭐ ÉTAPE 1 : hors ligne (navigator.onLine === false) → cache immédiat
  //    (zéro latence — pas de timeout inutile, pas de page blanche)
  if (!self.navigator || self.navigator.onLine === false) {
    const cachedExact = await cache.match(request);
    if (cachedExact) return cachedExact;
    const cachedShell = await cache.match('/app');
    if (cachedShell) return cachedShell; // app shell → routing client + IndexedDB
  }

  // ⭐ ÉTAPE 2 : en ligne (ou détection navigateur incertaine) → réseau avec
  //    timeout, cache write, puis fallback shell SANS page « hors ligne ».
  try {
    const networkResponse = await fetchWithTimeout(request, HTML_TIMEOUT);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch {
    // Réseau échoué/timeout (Wifi sans Internet, Neon qui se réveille…)
    // → cache exact de la route si déjà visitée
    const cachedExact = await cache.match(request);
    if (cachedExact) return cachedExact;
    // → sinon le SHELL /app pré-caché : l'utilisateur continue de travailler,
    //   les données viennent d'IndexedDB (l'app est offline-first)
    const cachedShell = await cache.match('/app');
    if (cachedShell) return cachedShell;
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
    const cachedExact = await cache.match(request);
    if (cachedExact) return cachedExact;
    const cachedShell = await cache.match('/login');
    if (cachedShell) return cachedShell;
    const cachedApp = await cache.match('/app');
    if (cachedApp) return cachedApp;
    return offlineMinimalResponse(url.pathname);
  }

  try {
    const networkResponse = await fetchWithTimeout(request, 4000);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch {
    const cachedExact = await cache.match(request);
    if (cachedExact) return cachedExact;
    const cachedShell = await cache.match('/login');
    if (cachedShell) return cachedShell;
    const cachedApp = await cache.match('/app');
    if (cachedApp) return cachedApp;
    return offlineMinimalResponse(url.pathname);
  }
}

// ⭐ Réponse minimale de dernier recours — délibérément sobre (une ligne de
//    texte, PAS une page plein écran avec boutons) : cas ultra-marginale d'un
//    navigateur hors ligne AVANT tout pré-cache. L'utilisateur recharge dès
//    qu'il a du réseau ; aucune page « hors ligne » bloquante ne s'affiche.
function offlineMinimalResponse(pathname) {
  const body = `Academia Helm — connexion indisponible pour ${pathname}. Reconnectez-vous puis rechargez la page : vos données locales restent intactes.`;
  return new Response(body, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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
  if (event.data && event.data.type === 'PRECACHE_MODULE' && event.data.url) {
    event.waitUntil(precacheModule(event.data.url));
  }
});

// ─── Pré-cache d'un module (HTML + chunks JS/CSS référencés) ──────────────
async function precacheModule(routeUrl) {
  try {
    const cache = await caches.open(PAGE_CACHE);
    const staticCache = await caches.open(IMMUTABLE_CACHE); // ⭐ chunks immuables — cache persistant

    const response = await fetchWithTimeout(new Request(routeUrl, {
      credentials: 'include',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    }), 10000);

    if (!response || !response.ok) return;

    await cache.put(routeUrl, response.clone());

    const html = await response.text();
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
    if (chunks.length === 0) return;

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
  } catch {
    // Non-bloquant
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
