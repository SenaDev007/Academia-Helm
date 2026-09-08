/**
 * ============================================================================
 * SERVICE WORKER UNIFIÉ — Academia Helm
 * ============================================================================
 *
 * ⭐ SW UNIQUE à la racine du domaine (scope: '/'). NE PAS enregistrer
 *    d'autres service workers au même scope (sw-chat.js, sw-offline.js,
 *    sw-site.js sont OBSOLÈTES) : un seul SW par scope, sinon les
 *    enregistrements se remplacent mutuellement en ping-pong.
 *
 * Responsabilités :
 *   1. PUSH + notificationclick + pushsubscriptionchange (Web Push,
 *      utilisé par usePushSubscription.ts et le chat)
 *   2. FETCH handler avec cache prudent — requis pour l'INSTALLABILITÉ
 *      PWA (Chrome/Edge desktop + Android) :
 *        - Assets statiques immuables (_next/static, images, fonts)
 *          → CacheFirst (1 an)
 *        - Pages HTML PUBLIQUES (site institutionnel, login, landing)
 *          → NetworkFirst (4s timeout) + fallback cache + /offline
 *        - Tout le reste (API, /app/*, /platform/*, cross-origin)
 *          → PAS D'INTERCEPTION (réseau direct, zéro risque de données
 *            périmées ou sensibles en cache)
 *
 * ⛔ JAMAIS de cache pour :
 *   - /api/* (données dynamiques + sécurité)
 *   - /app/*, /platform/*, /patronat, /federis, /saisiemaster
 *     (pages authentifiées — privées)
 *   - les scripts SW eux-mêmes (/sw*.js)
 * ============================================================================
 */

const SW_VERSION = 'v2.0.0';
const STATIC_CACHE = `ah-static-${SW_VERSION}`;
const PAGE_CACHE = `ah-pages-${SW_VERSION}`;

// Pages pré-cachées au premier install (shell hors ligne minimal)
const PRECACHE_URLS = ['/offline'];

// Assets statiques immuables → CacheFirst
const STATIC_ASSET_PATTERNS = [
  /\/_next\/static\//,
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

// Pages HTML dont le cache hors-ligne est AUTORISÉ (publiques uniquement)
const CACHEABLE_HTML_PATTERNS = [
  /^\/$/, // site institutionnel (racine du sous-domaine)
  /^\/school-portal(\/|$)/, // site institutionnel école
  /^\/login(\/|$)/, // connexion (start_url de l'app PWA)
  /^\/portal(\/|$)/, // sélection de portails
  /^\/jobs(\/|$)/, // recrutement
  /^\/actualites(\/|$)/,
  /^\/offline(\/|$)/,
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
  /^\/api\//, // API (BFF + données dynamiques)
  /^\/app\//, // application authentifiée
  /^\/platform\//, // back-office admin
  /^\/patronat(\/|$)/,
  /^\/saisiemaster(\/|$)/,
  /^\/admin(\/|$)/, // routes admin
  /^\/sign\//, // signature de contrats (tokens)
  /^\/receipt\//, // reçus (tokens)
  /^\/sw[\w.-]*\.js$/, // scripts service worker
  /^\/manifest.*\.webmanifest$/, // manifests dynamiques (toujours frais)
];

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
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('ah-') && !name.endsWith(SW_VERSION))
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

  // ─── Assets statiques : CacheFirst ─────────────────────────────────────
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

  // ─── Navigations HTML publiques : NetworkFirst + fallback hors ligne ────
  const isHtmlNavigation =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isHtmlNavigation && CACHEABLE_HTML_PATTERNS.some((pattern) => pattern.test(pathname))) {
    event.respondWith(
      (async () => {
        const timeoutMs = 4000;
        try {
          const fetchPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SW_TIMEOUT')), timeoutMs),
          );
          const response = await Promise.race([fetchPromise, timeoutPromise]);

          if (response && response.status === 200) {
            const clone = response.clone();
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, clone);
          }
          return response;
        } catch {
          // Hors ligne → copie en cache, sinon page /offline
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const offline = await caches.match('/offline');
          if (offline) return offline;
          return new Response(
            '<!DOCTYPE html><html lang="fr"><body style="font-family:sans-serif;text-align:center;padding:3rem"><h1>Hors ligne</h1><p>Impossible de charger cette page. Vérifiez votre connexion Internet.</p></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }
      })(),
    );
    return;
  }

  // Tout le reste : pas d'interception (réseau direct)
});

// ─── MESSAGE : update manuelle depuis le client ───────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   WEB PUSH — notifications (chat, alertes finance, absences, etc.)
   ═════════════════════════════════════════════════════════════════════════ */

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
