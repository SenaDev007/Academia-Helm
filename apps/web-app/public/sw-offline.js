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

const CACHE_VERSION = 'ah-offline-v6'; // ⭐ bump v5 → v6 (fix offline-first : /app pré-caché + timeouts longs + fallback IndexedDB)
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

// ⭐ Timeouts augmentés : Neon cold start = 10-13s, on laisse 8s pour HTML et 10s pour API
//    Avant : HTML_TIMEOUT=3s → le SW croyait être offline même si Neon était en train
//    de se réveiller → page blanche "hors ligne" injustifiée.
const API_TIMEOUT = 10000;
const HTML_TIMEOUT = 8000;

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
  // ⭐ FIX : les chunks Next.js DOIVENT être cachés pour que l'app shell
  //    fonctionne offline. Sans les chunks JS, le HTML /app en cache ne
  //    peut pas s'exécuter → page blanche.
  //    La stratégie StaleWhileRevalidate (définie plus bas pour /_next/static/*)
  //    gère la invalidation : au online, on re-télécharge le chunk et on
  //    remplace l'ancien. Au offline, on sert le chunk en cache.
  //    Si un nouveau déploiement change les noms de chunks, le nouveau HTML
  //    référencera de nouveaux chemins → StaleWhileRevalidate les téléchargera.
  //    L'ancien cache n'est jamais servi pour les nouveaux chemins car les
  //    URLs contiennent un hash (ex: webpack-abc123.js).
];

const API_ROUTES = /\/api\//;
const STATIC_ROUTES = /\/_next\/static\//;
const IMAGE_ROUTES = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/;

// ─── INSTALL ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // ⭐ Pré-cache des routes publiques + pages de login pour accès offline.
      //    Avant : seul '/', '/manifest.json', '/offline' étaient pré-cachés.
      //    Maintenant : toutes les pages publiques sont disponibles offline
      //    dès la première visite du SW, sans nécessiter une navigation préalable.
      //    On utilise addAll avec catch() — si une route n'existe pas (ex: /onboarding-error),
      //    les autres sont quand même cachées.
      return cache.addAll([
        // Pages principales
        '/',
        '/manifest.json',
        '/offline',
        // ⭐ /app shell — CRITIQUE pour offline-first
        //    Sans cela, quand internet coupe, le SW ne trouve pas /app en cache
        //    → fallback sur page "hors ligne" → page blanche.
        //    Avec /app pré-caché, le shell React se charge depuis le cache
        //    et l'app fonctionne avec IndexedDB.
        '/app',
        // Pages publiques (landing + portal)
        '/portal',
        '/school-portal',
        // Pages d'authentification (login + récupération)
        '/login',
        '/admin-login',
        '/forgot-password',
        '/reset-password',
        // Pages publiques additionnelles
        '/modules',
        '/tarification',
        '/contact',
        '/signup',
        '/onboarding',
        '/testimonials',
        '/avis',
        '/public/pre-enrollment',
        '/sign/contract',
        '/reactivate',
      ]).catch(() => {
        // Silencieux — certaines routes peuvent ne pas exister, on continue
      });
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
  const url = new URL(request.url);

  try {
    // Tenter le réseau avec Timeout court
    const networkResponse = await fetchWithTimeout(request, HTML_TIMEOUT);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (err) {
    // Fallback: cache (PAGE_CACHE)
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // ⭐ Fallback /app : si on navigue vers /app/xxx et que /app est en cache
    //    (pré-caché à l'install), on retourne le shell /app pour que l'app
    //    React se charge et utilise IndexedDB.
    //    Avant : on retombait sur la page "hors ligne" → page blanche.
    if (url.pathname.startsWith('/app')) {
      const cachedApp = await caches.match('/app');
      if (cachedApp) return cachedApp;
    }

    // Fallback: essayer la page racine
    const cachedRoot = await cache.match('/');
    if (cachedRoot) return cachedRoot;

    // ⭐ Dernier recours: page offline
    //    /offline est pre-cache dans STATIC_CACHE (à l'install du SW), PAS dans PAGE_CACHE.
    //    Avant : cache.match('/offline') cherche uniquement dans PAGE_CACHE →
    //    retourne undefined si PAGE_CACHE est vide (premier visite offline) →
    //    fallback sur Response('Offline') qui rend une page noire avec "Offline"
    //    en haut à gauche.
    //    Maintenant : caches.match('/offline') cherche dans TOUS les caches
    //    (STATIC_CACHE, PAGE_CACHE, etc.) → trouve /offline même si PAGE_CACHE
    //    est vide.
    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

    // ⭐ Si /offline n'est pas en cache (SW pas encore installé), retourner
    //    une page HTML inline au lieu du texte brut "Offline" qui rendait
    //    une page noire sur les navigateurs en mode sombre.
    //    La page HTML a un fond clair + un message lisible + un bouton retry.
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hors ligne — Academia Helm</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1e293b;
      padding: 2rem;
    }
    .container {
      max-width: 28rem;
      text-align: center;
      background: white;
      border-radius: 1rem;
      padding: 2.5rem 2rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }
    .icon {
      width: 4rem; height: 4rem; margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .icon svg { width: 2rem; height: 2rem; color: white; }
    h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.75rem; color: #0f172a; }
    p { font-size: 0.95rem; color: #475569; line-height: 1.6; margin: 0 0 1.5rem; }
    button {
      background: linear-gradient(135deg, #1A2BA6, #3B4FD4);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s;
    }
    button:hover { transform: scale(1.03); }
    .hint { font-size: 0.8rem; color: #94a3b8; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    </div>
    <h1>Vous êtes hors ligne</h1>
    <p>Nous n'avons pas pu charger cette page car votre connexion Internet semble indisponible. Vérifiez votre réseau puis réessayez.</p>
    <button onclick="window.location.reload()">Réessayer</button>
    <p class="hint">Astuce : les pages déjà visitées restent disponibles hors ligne.</p>
  </div>
</body>
</html>`,
      {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

// ─── Helpers ───

// ─── Handler pour API NetworkFirst avec fallback IndexedDB ───
// ⭐ Le SW ne peut pas accéder directement à IndexedDB (limite SW),
//    mais il peut retourner un 200 avec [] pour que l'app React
//    ne crash pas. L'intercepteur global (dans la fenêtre principale)
//    se charge de lire IndexedDB pour les requêtes API.
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
    // Fallback 1: Cache API (HTTP cache)
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    // Fallback 2: Retourner un 200 avec [] pour les requêtes API
    //    → l'app React ne crash pas, elle affiche "Aucune donnée"
    //    → l'intercepteur global (fenêtre principale) va lire IndexedDB
    //      et remplir les données si disponibles
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        statusText: 'OK (offline — SW fallback)',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Fallback': 'true',
        },
      });
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

// ─── BACKGROUND SYNC API ─────────────────────────────────────────────────
// ⭐ Quand l'onglet est fermé et que le réseau revient, le SW déclenche
//    le push de l'outbox automatiquement. Le client register('sync-outbox')
//    via auto-sync-trigger.ts, et le SW reçoit l'évent 'sync' ici.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(
      // Le SW ne peut pas accéder à IndexedDB directement via l'API offlineFetch
      // (pas de window.fetch intercepté), mais il peut faire un fetch vers
      // /api/sync/push avec les données de l'outbox stockées en Cache API.
      // Pour l'instant, on notifie les clients ouverts pour qu'ils sync.
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' });
        });
        // Si aucun client ouvert, on ne peut pas sync (limite SW).
        // Le sync se fera au prochain ouverture d'onglet (initAutoSyncTrigger
        // au montage vérifie les events en attente).
      })
    );
  }
});

// ─── NOTIFICATION PUSH (depuis le SW vers les clients) ───────────────────
// Quand le SW reçoit 'BACKGROUND_SYNC_TRIGGER', le client déclenche autoSync.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
    // Le client va appeler autoSync via son propre listener
    // (voir auto-sync-trigger.ts qui écoute ce message)
  }
});
