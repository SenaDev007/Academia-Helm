/**
 * ============================================================================
 * ACADEMIA HELM — Service Worker Offline-First (Vercel)
 * ============================================================================
 *
 * Stratégies de cache :
 *   - API /api/* → NetworkFirst (timeout 5s, fallback cache)
 *   - Assets /_next/static/* → StaleWhileRevalidate
 *   - Pages HTML → NetworkFirst (timeout 3s)
 *   - Images → CacheFirst (30 jours)
 *   - Auth/Export → NetworkOnly (jamais caché)
 *
 * Ce SW est enregistré par OfflineSWRegister.tsx dans layout-client.tsx.
 * ============================================================================
 */

const CACHE_VERSION = 'academia-helm-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const API_TIMEOUT = 5000; // 5s
const HTML_TIMEOUT = 3000; // 3s

// Routes à NE JAMAIS cacher
const NEVER_CACHE = [
  /\/api\/auth\//,
  /\/api\/sync\//,
  /\/api\/.*\/export/,
  /\/api\/.*\/pdf/,
  /\.pdf$/,
  /\.xlsx$/,
  /\.csv$/,
  /\/sw\.js$/,
];

// Routes API à cacher (NetworkFirst)
const API_ROUTES = /\/api\//;

// Assets statiques
const STATIC_ROUTES = /\/_next\/static\//;

// Images
const IMAGE_ROUTES = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/;

// ─── INSTALL : pré-cache des assets critiques ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
      ]).catch(() => {}); // Ignorer les échecs
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE : nettoyer les anciens caches ───
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

// ─── FETCH : intercepter les requêtes ───
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignorer les routes à ne jamais cacher
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Ignorer les requêtes cross-origin (sauf assets statiques)
  if (url.origin !== self.location.origin && !STATIC_ROUTES.test(url.pathname)) return;

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

  // ─── Strategy 3: Images → CacheFirst ───
  if (IMAGE_ROUTES.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // ─── Strategy 4: HTML → NetworkFirst (timeout court) ───
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE, HTML_TIMEOUT));
    return;
  }
});

// ─── Helpers ───

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);

  try {
    // Tenter le réseau avec timeout
    const networkResponse = await fetchWithTimeout(request, timeoutMs);
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
    // Dernier recours: page offline
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline');
      if (offlinePage) return offlinePage;
    }
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
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Pas de cache, pas de réseau → erreur
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

// ─── MESSAGE : permettre au client de forcer une sync ───
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
