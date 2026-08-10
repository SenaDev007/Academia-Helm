/**
 * ============================================================================
 * ACADEMIA HELM — Service Worker Offline-First (UNIVERSEL)
 * ============================================================================
 *
 * Couvre TOUS les flux :
 *   - Site public (academiahelm.com, sous-domaines écoles)
 *   - Pages de login (/login, /admin-login, portal logins)
 *   - Application authentifiée (/app/*)
 *   - Portails (teacher, parent, school)
 *
 * Stratégies de cache :
 *   - Pages HTML → NetworkFirst (3s timeout, fallback cache) — permet de charger
 *     la page même offline si elle a déjà été visitée
 *   - API /api/* (sauf auth/sync/export) → NetworkFirst (5s timeout, fallback cache)
 *   - Assets /_next/static/* → StaleWhileRevalidate
 *   - Images/Fonts → CacheFirst (30 jours)
 *   - Auth/Export/Sync → NetworkOnly (jamais caché)
 *
 * ⭐ Le login API ne peut pas fonctionner offline (besoin du serveur).
 *    Mais si l'utilisateur a déjà une session valide (token en localStorage),
 *    il peut accéder à l'app directement depuis le cache.
 * ============================================================================
 */

const CACHE_VERSION = 'ah-offline-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const API_TIMEOUT = 5000;
const HTML_TIMEOUT = 3000;

// Routes à NE JAMAIS cacher
const NEVER_CACHE = [
  /\/api\/auth\//,
  /\/api\/sync\//,
  /\/api\/admin-auth\//,
  /\/api\/portal\/auth\//,
  /\/api\/.*\/export/,
  /\/api\/.*\/pdf/,
  /\/api\/.*\/download/,
  /\.pdf$/,
  /\.xlsx$/,
  /\.csv$/,
  /\/sw\.js$/,
  /\/sw-offline\.js$/,
  /\/sw-site\.js$/,
  // ⭐ Ne JAMAIS cacher les chunks Next.js — ils changent à chaque déploiement
  //    Si on les cache, le nouveau HTML référence des chunks inexistants → erreur
  /\/_next\/static\/chunks\//,
];

const API_ROUTES = /\/api\//;
const STATIC_ROUTES = /\/_next\/static\//;
const IMAGE_ROUTES = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/;

// ─── INSTALL ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/offline',
      ]).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH ───
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignorer les routes à ne jamais cacher
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Ignorer les requêtes cross-origin
  if (url.origin !== self.location.origin) return;

  // ─── Strategy 1: API → NetworkFirst ───
  if (API_ROUTES.test(url.pathname)) {
    event.respondWith(networkFirst(request, API_CACHE, API_TIMEOUT));
    return;
  }

  // ─── Strategy 2: Static assets → StaleWhileRevalidate ───
  if (STATIC_ROUTES.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // ─── Strategy 3: Images/Fonts → CacheFirst ───
  if (IMAGE_ROUTES.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // ─── Strategy 4: HTML pages → NetworkFirst (court timeout) ───
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(handlePageRequest(request));
    return;
  }
});

// ─── Handler spécial pour les pages HTML ───
async function handlePageRequest(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    // Tenter le réseau avec timeout court
    const networkResponse = await fetchWithTimeout(request, HTML_TIMEOUT);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (err) {
    // Fallback: cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback: essayer la page racine
    const cachedRoot = await cache.match('/');
    if (cachedRoot) return cachedRoot;

    // Dernier recours: page offline
    const offlinePage = await cache.match('/offline');
    if (offlinePage) return offlinePage;

    // Si rien en cache, retourner une réponse vide
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// ─── Helpers ───

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetchWithTimeout(request, timeoutMs);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (err) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    throw err;
  }
}

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

// ─── MESSAGE ───
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      Promise.all(names.map((name) => caches.delete(name)));
    });
  }
});
