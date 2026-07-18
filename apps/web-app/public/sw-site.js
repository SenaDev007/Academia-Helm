/**
 * ============================================================================
 * SERVICE WORKER — Site institutionnel PWA
 * ============================================================================
 *
 * Stratégie de cache :
 *   - Cache-first pour les assets statiques (images, CSS, JS, fonts)
 *   - Network-first pour les pages HTML (toujours fraîches si online)
 *   - Stale-while-revalidate pour les API calls
 *
 * Le SW ne cache QUE les routes du site institutionnel :
 *   - / (homepage tenant)
 *   - /school-portal/* (site institutionnel)
 *   - /manifest-site.webmanifest
 *   - /api/tenants/* (branding)
 *
 * Il NE cache PAS :
 *   - /app/* (application authentifiée — trop dynamique)
 *   - /api/auth/* (sécurité)
 *   - /platform/* (admin)
 * ============================================================================
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `ah-static-${CACHE_VERSION}`;
const PAGE_CACHE = `ah-pages-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ah-runtime-${CACHE_VERSION}`;

// Routes à cacher (site institutionnel uniquement)
const INSTITUTIONAL_ROUTES = [
  '/',
  '/school-portal',
];

const STATIC_ASSET_PATTERNS = [
  /\/_next\/static\//,
  /\/_next\/image\//,
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|css|js)$/i,
];

const NEVER_CACHE_PATTERNS = [
  /\/app\//,
  /\/api\/auth\//,
  /\/api\/students\//,
  /\/api\/finance\//,
  /\/platform\//,
  /\/admin/,
  /\/portal\//,
  /chrome-extension:/,
];

// ─── INSTALL : pré-cache des routes institutionnelles ─────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(INSTITUTIONAL_ROUTES).catch(() => {
        // Ignorer les erreurs (offline au 1er install par exemple)
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE : nettoyage des anciens caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ah-') && !name.endsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH : stratégie selon le type de requête ───────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET (POST, PUT, DELETE...)
  if (request.method !== 'GET') return;

  // Ignorer les routes à ne jamais cacher
  if (NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  // Ignorer les cross-origin requests (sauf assets statiques)
  if (url.origin !== self.location.origin && !STATIC_ASSET_PATTERNS.some((p) => p.test(url.pathname))) {
    return;
  }

  // ─── Cache-first pour les assets statiques ────────────────────────────
  if (STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ─── Network-first pour les pages HTML ────────────────────────────────
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Page offline par défaut
            return caches.match('/offline');
          });
        })
    );
    return;
  }

  // ─── Stale-while-revalidate pour les API ──────────────────────────────
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/tenants/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok && response.status === 200) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// ─── MESSAGE : permettre au client de forcer l'update ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
