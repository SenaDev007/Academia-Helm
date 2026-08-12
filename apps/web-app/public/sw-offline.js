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
          // ⭐ P2 — préserver le cache 'ah-auth-token' qui contient le miroir
          //    du JWT pour le background sync. Sans cela, le SW perdrait le
          //    token à chaque activation et ne pourrait plus pousser l'outbox
          //    quand l'onglet est fermé.
          .filter((name) => !name.startsWith(CACHE_VERSION) && !name.startsWith('ah-auth-'))
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
// ⭐ P2 — Quand l'onglet est fermé et que le réseau revient, le SW déclenche
//    le push de l'outbox LUI-MÊME (et non plus seulement via postMessage
//    aux clients ouverts, qui ne marche pas si l'onglet est fermé).
//
//    Le SW a accès à IndexedDB (globals `indexedDB` et `caches`) — il peut
//    donc lire le store `outbox_events`, envoyer les events PENDING vers
//    /api/sync/push par batchs de 50, et mettre à jour leur statut en IDB.
//
//    Le token JWT (qui n'est pas accessible depuis le SW car stocké dans
//    localStorage) est miroité dans Cache API par client-access-token.ts
//    (fonction mirrorTokenToCacheApi) sous la clé `ah-auth-token`.
//
//    Le postMessage aux clients ouverts est conservé pour qu'ils puissent
//    faire le pull et mettre à jour l'UI (le SW ne fait que le push).
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(
      (async () => {
        // ⭐ P2 — 1. Push direct depuis le SW (marche même si aucun client ouvert)
        try {
          await swPushOutboxFromIDB();
        } catch (err) {
          console.error('[SW P2] Background push failed:', err);
        }

        // ⭐ P2 — 2. Notifier les clients ouverts (pour pull + MAJ UI)
        //    Le push a déjà été fait par le SW ; le client ne devrait faire
        //    que le pull. On ajoute `source: 'sw'` pour que le client sache
        //    qu'il peut skip le push (économie de doublons idempotents).
        try {
          const clients = await self.clients.matchAll({ includeUncontrolled: true });
          clients.forEach((client) => {
            client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER', source: 'sw' });
          });
        } catch (err) {
          // Non-critique — le push a déjà été fait
          console.warn('[SW P2] postMessage to clients failed:', err);
        }
      })()
    );
  }
});

// ─── P2 — HELPERS POUR LE PUSH DEPUIS LE SW ───────────────────────────────

// ⭐ P2 — Constantes pour le push direct depuis le SW.
//    Ces constantes doivent rester en phase avec :
//    - local-db.service.ts (DB name='academia-helm-local', version=15)
//    - client-access-token.ts (cache name='ah-auth-token', URL='/__sw_auth_token__')
//    - sync-engine.service.ts (endpoint='/api/sync/push', BATCH_SIZE=50)
const SW_DB_NAME = 'academia-helm-local';
const SW_DB_VERSION = 15;
const SW_OUTBOX_STORE = 'outbox_events';
const SW_AUTH_CACHE_NAME = 'ah-auth-token';
const SW_AUTH_TOKEN_URL = '/__sw_auth_token__';
const SW_SYNC_PUSH_BATCH = 50;
const SW_SYNC_MAX_RETRIES = 3;
const SW_DEVICE_ID = 'sw-bg-sync';

/**
 * ⭐ P2 — Récupère le token JWT depuis le Cache API.
 *    Le SW n'a pas accès à localStorage, mais le main thread y écrit une
 *    copie via mirrorTokenToCacheApi() dans client-access-token.ts.
 *    Retourne null si le token n'est pas trouvé (sans crasher).
 */
async function swGetAuthToken() {
  try {
    const cache = await caches.open(SW_AUTH_CACHE_NAME);
    const response = await cache.match(SW_AUTH_TOKEN_URL);
    if (!response) return null;
    const text = await response.text();
    return text && text.trim() ? text.trim() : null;
  } catch (err) {
    console.warn('[SW P2] Failed to read auth token from Cache API:', err);
    return null;
  }
}

/**
 * ⭐ P2 — Ouvre IndexedDB (même base que local-db.service.ts).
 *    Le SW ne déclenche PAS onupgradeneeded — il ne fait que lire/écrire
 *    dans les stores existants. Si la base n'existe pas encore (premier
 *    visite), la lecture échouera et le push sera skip sans crasher.
 */
function swOpenLocalDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(SW_DB_NAME, SW_DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      // ⭐ Pas de onupgradeneeded — le SW ne doit PAS modifier le schéma IDB.
      //    Si la version actuelle de la base diffère de SW_DB_VERSION, IDB
      //    lèvera une VersionChangeEvent qu'on ignore (le SW n'a pas besoin
      //    de migrer — il sera réessayé au prochain sync event une fois que
      //    le main thread aura migré).
      req.onblocked = () => reject(new Error('IDB open blocked'));
      req.onupgradeneeded = (event) => {
        // Si IDB veut upgrade/downgrade, on abandonne proprement — le main
        // thread gérera la migration. On ne touche pas au schéma depuis le SW.
        event.target.transaction && event.target.transaction.abort();
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * ⭐ P2 — Lit les événements PENDING depuis l'outbox IndexedDB (tous tenants).
 */
function swReadPendingEvents(db, limit = 500) {
  return new Promise((resolve, reject) => {
    try {
      // Vérifier que le store existe (sinon la transaction lèverait une erreur)
      if (!db.objectStoreNames.contains(SW_OUTBOX_STORE)) {
        console.warn(`[SW P2] Store '${SW_OUTBOX_STORE}' not found in IDB — skipping`);
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

/**
 * ⭐ P2 — Met à jour le statut d'un événement outbox dans IndexedDB.
 */
function swUpdateEventStatus(db, eventId, patch) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([SW_OUTBOX_STORE], 'readwrite');
      const store = tx.objectStore(SW_OUTBOX_STORE);
      const getReq = store.get(eventId);
      getReq.onsuccess = () => {
        const event = getReq.result;
        if (!event) {
          // Déjà supprimé par un autre process (ex: foreground sync)
          resolve();
          return;
        }
        const updated = { ...event, ...patch };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * ⭐ P2 — Construit le payload d'opération attendu par le backend /api/sync/push.
 *    Miroir minimal de toBackendOperation() dans sync-engine.service.ts.
 *    Le SW n'a pas accès au map complet ENTITY_TO_TABLE (500+ entrées) — on
 *    utilise le fallback `entityType.toLowerCase() + 's'` qui est la même
 *    règle que dans sync-engine.service.ts pour les entités non mappées.
 */
function swToBackendOperation(event) {
  const tableName = (event.entityType || '').toLowerCase() + 's';
  const opMap = { CREATE: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE' };
  const operationType = opMap[event.operation] || event.operation;

  // Payload — peut être une string JSON ou un objet (selon outbox.service.ts)
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

/**
 * ⭐ P2 — Envoie un batch d'opérations vers /api/sync/push.
 *    Retourne la réponse JSON du backend.
 *    Lance une Error si le fetch échoue ou si la réponse n'est pas ok
 *    (pour déclencher le retry au niveau supérieur).
 */
async function swPushBatch(authToken, tenantId, operations) {
  const body = {
    tenantId,
    sqliteSchemaHash: 'unknown', // Le SW n'a pas accès au schema hash
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
    credentials: 'include', // Pour les cookies httpOnly (si utilisés)
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Push HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * ⭐ P2 — Orchestrateur principal du push depuis le SW.
 *
 *    Étapes :
 *      1. Lit le token JWT depuis Cache API (skip si absent)
 *      2. Ouvre IndexedDB (skip si erreur)
 *      3. Lit les events PENDING (tous tenants, max 500)
 *      4. Groupe par tenantId
 *      5. Pour chaque tenant, envoie par batchs de 50 (max 3 retries / batch)
 *      6. Pour chaque résultat (SUCCESS/CONFLICT/FAILED), met à jour le statut
 *
 *    Sécurité :
 *      - Ne boucle pas infiniment (max 3 retries par batch)
 *      - Ne marque PAS les events comme FAILED en cas d'erreur réseau
 *        (ils seront retry au prochain sync event ou au prochain foreground sync)
 *      - Skip silencieux si le token ou la base n'est pas disponible
 */
async function swPushOutboxFromIDB() {
  // 1. Token JWT
  const authToken = await swGetAuthToken();
  if (!authToken) {
    console.warn(
      '[SW P2] No auth token in Cache API — skipping background push. ' +
      'Le token sera écrit au prochain login ou au prochain chargement de page.'
    );
    return;
  }

  // 2. IndexedDB
  let db;
  try {
    db = await swOpenLocalDB();
  } catch (err) {
    console.warn('[SW P2] Cannot open IndexedDB — skipping:', err?.message || err);
    return;
  }

  // 3. Lire PENDING events
  let pendingEvents;
  try {
    pendingEvents = await swReadPendingEvents(db, 500);
  } catch (err) {
    console.warn('[SW P2] Cannot read outbox_events store — skipping:', err?.message || err);
    return;
  }

  if (pendingEvents.length === 0) {
    console.log('[SW P2] No pending events — nothing to push.');
    return;
  }

  console.log(`[SW P2] Found ${pendingEvents.length} pending events to push from SW`);

  // 4. Grouper par tenantId
  const byTenant = new Map();
  for (const event of pendingEvents) {
    const tid = event.tenantId;
    if (!tid) continue; // Sans tenantId, on ne peut pas push (le backend l'exige)
    if (!byTenant.has(tid)) byTenant.set(tid, []);
    byTenant.get(tid).push(event);
  }

  // 5. Pour chaque tenant, envoyer par batchs de SW_SYNC_PUSH_BATCH
  for (const [tenantId, events] of byTenant) {
    for (let i = 0; i < events.length; i += SW_SYNC_PUSH_BATCH) {
      const batch = events.slice(i, i + SW_SYNC_PUSH_BATCH);
      const operations = batch.map(swToBackendOperation);

      let success = false;
      let lastError = null;
      for (let attempt = 1; attempt <= SW_SYNC_MAX_RETRIES; attempt++) {
        try {
          const result = await swPushBatch(authToken, tenantId, operations);

          // Traiter les résultats individuels
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
              // FAILED (erreur applicative — pas réseau)
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
          console.log(
            `[SW P2] Batch push success (tenant ${tenantId.substring(0, 8)}…): ` +
            `${result?.successful_operations || 0} ok, ` +
            `${result?.conflicted_operations || 0} conflicts, ` +
            `${result?.failed_operations || 0} errors`
          );
          break;
        } catch (err) {
          lastError = err;
          console.warn(
            `[SW P2] Push attempt ${attempt}/${SW_SYNC_MAX_RETRIES} failed:`,
            err?.message || err
          );
          if (attempt < SW_SYNC_MAX_RETRIES) {
            // Backoff exponentiel : 1s, 2s, 4s (max 3 tentatives)
            const delayMs = 1000 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }

      if (!success) {
        console.error(
          `[SW P2] Batch push failed after ${SW_SYNC_MAX_RETRIES} attempts:`,
          lastError?.message || lastError
        );
        // ⭐ Ne PAS marquer les events comme FAILED ici : l'échec est réseau,
        //    pas applicatif. Les events seront retry au prochain 'sync' event
        //    ou au prochain foreground sync (auto-sync-trigger.ts).
      }
    }
  }

  console.log('[SW P2] Background push complete.');
}

// ─── NOTIFICATION PUSH (depuis le SW vers les clients) ───────────────────
// Quand le SW reçoit 'BACKGROUND_SYNC_TRIGGER', le client déclenche autoSync.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
    // Le client va appeler autoSync via son propre listener
    // (voir auto-sync-trigger.ts qui écoute ce message)
  }
});
