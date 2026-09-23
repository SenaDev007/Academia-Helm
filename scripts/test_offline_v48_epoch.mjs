/**
 * ============================================================================
 * TEST V4.8 — Époque de build + routes publiques anonymes (trou de déploiement)
 * ============================================================================
 * Retour terrain 23/09/2026 : « dès qu'on quitte le module courant en mode
 * hors ligne → page "Connexion instable" ; impossible de naviguer entre
 * modules ou de se déconnecter offline ».
 * CAUSE : un déploiement Vercel sans modification de sw.js ne déclenche ni
 * update du SW ni SW_ACTIVATED → flag 24 h « frais » → chunks du NOUVEAU
 * build jamais pré-cachés → navigation offline vers un module non visité
 * en ligne = ChunkLoadError.
 * CORRECTIF v4.8.0 :
 *   [1] ÉPOCH DE BUILD — le SW hache l'ensemble des chunks du shell /app
 *       servi en ligne (HTML frais) ; changement de build SANS bump sw.js →
 *       BUILD_EPOCH_CHANGED diffusé → re-pré-cache immédiat côté client.
 *   [2] GET_BUILD_EPOCH — le client peut interroger l'epoch courante
 *       (rattrapage d'un message manqué).
 *   [3] ROUTES PUBLIQUES ANONYMES — /login, /portal, / pré-cachées avec
 *       credentials omit (connecté, le middleware les redirige sinon →
 *       jamais cachées → déconnexion offline sur HTML périmé).
 * Méthode : sw.js exécuté en vm (même harnais que test_offline_v43).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const SW_PATH = path.join(ROOT, 'apps/web-app/public/sw.js');
const SW_SOURCE = fs.readFileSync(SW_PATH, 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}`); }
}

const ORIGIN = 'https://app.academiahelm.com';

// ─── Fabriques de mocks (repris du harnais v43/v40) ────────────────────────
function idbReq(result) {
  return {
    onsuccess: null, onerror: null, result: undefined, __result: result,
    __fire() { this.result = this.__result; this.onsuccess && this.onsuccess({ target: this }); },
  };
}
function fire(req) { if (req && typeof req.__fire === 'function') req.__fire(); return req; }

function makeMockIdb(stores) {
  const storeNames = new Set(Object.keys(stores));
  const makeStore = (name) => ({
    getAll: () => { const r = idbReq([...(stores[name] || [])]); queueMicrotask(() => fire(r)); return r; },
    get: (k) => { const v = (stores[name] || []).find((x) => x && x.id === k); const r = idbReq(v); queueMicrotask(() => fire(r)); return r; },
    put: (v) => {
      const arr = stores[name] = stores[name] || [];
      const i = arr.findIndex((x) => x && x.id === v.id);
      if (i >= 0) arr[i] = v; else arr.push(v);
      const r = idbReq(v); queueMicrotask(() => fire(r)); return r;
    },
    delete: (k) => { stores[name] = (stores[name] || []).filter((x) => x && x.id !== k); const r = idbReq(undefined); queueMicrotask(() => fire(r)); return r; },
  });
  const db = {
    objectStoreNames: { contains: (s) => storeNames.has(s) },
    transaction(_n, _m) { return { objectStore: (name) => makeStore(name) }; },
  };
  return {
    stores,
    open(_name) { const r = idbReq(db); queueMicrotask(() => fire(r)); return r; },
  };
}

function makeMockCaches() {
  const cachesMap = new Map();
  return {
    open: async (name) => {
      if (!cachesMap.has(name)) cachesMap.set(name, new Map());
      const map = cachesMap.get(name);
      return {
        match: async (reqOrKey) => {
          const key = typeof reqOrKey === 'string' ? reqOrKey : reqOrKey.url;
          const hit = map.get(key);
          return hit ? hit.clone() : undefined;
        },
        put: async (reqOrKey, response) => {
          const key = typeof reqOrKey === 'string' ? reqOrKey : reqOrKey.url;
          map.set(key, response.clone());
        },
        delete: async (reqOrKey) => {
          const key = typeof reqOrKey === 'string' ? reqOrKey : reqOrKey.url;
          return map.delete(key);
        },
        keys: async () => [...map.keys()].map((u) => new Request(u)),
      };
    },
    keys: async () => [...cachesMap.keys()],
    delete: async (name) => cachesMap.delete(name),
    __map: cachesMap,
  };
}

/** HTML de shell avec un ensemble de chunks donné (déterministe par build). */
function shellHtml(chunks) {
  const scripts = chunks.map((c) => `<script src="${c}" defer></script>`).join('\n');
  return `<!DOCTYPE html><html><head></head><body><div id="root">shell</div>\n${scripts}\n</body></html>`;
}

function buildSwContext({ idb, cachesApi, fetchImpl, onLine, broadcastClients }) {
  const handlers = {};
  const selfObj = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: ORIGIN, hostname: 'app.academiahelm.com', protocol: 'https:' },
    navigator: { onLine },
    registration: { sync: { register: async () => true } },
    clients: { matchAll: async () => broadcastClients || [] },
    skipWaiting: async () => {},
    postMessage: () => {},
  };
  const sandbox = {
    self: selfObj, console, setTimeout, clearTimeout, queueMicrotask,
    AbortController, AbortSignal,
    fetch: fetchImpl, indexedDB: idb, caches: cachesApi,
    URL, URLSearchParams, Request, Response, Headers,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    TextEncoder, TextDecoder,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox, { filename: 'sw.js' });
  return { handlers, sandbox };
}

async function driveFetch(handlers, request) {
  let resolveRespond;
  const responded = new Promise((r) => { resolveRespond = r; });
  let handled = false;
  await handlers.fetch({ request, respondWith: (p) => { handled = true; resolveRespond(Promise.resolve(p)); } });
  if (!handled) return { handled: false, response: null };
  return { handled: true, response: await responded };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════
async function main() {

  const BUILD1 = [
    '/_next/static/immutable/chunks/entry-a1.js',
    '/_next/static/immutable/chunks/vendor-b2.js',
    '/_next/static/immutable/chunks/style-c3.css',
  ];
  const BUILD2 = [
    '/_next/static/immutable/chunks/entry-z9.js',
    '/_next/static/immutable/chunks/vendor-b2.js',
    '/_next/static/immutable/chunks/style-d4.css',
  ];

  // ─── [1] ÉPOCH : stockée au pré-cache du shell /app + interrogeable ─────
  console.log('\n[1] Époque de build — stockage (pré-cache /app) + GET_BUILD_EPOCH');
  {
    const cachesApi = makeMockCaches();
    const broadcasts = [];
    const broadcastClients = [{ postMessage: (m) => broadcasts.push(m) }];
    let credentialsSeen = [];
    const ctx = buildSwContext({
      idb: makeMockIdb({}), cachesApi, onLine: true, broadcastClients,
      fetchImpl: async (req) => {
        credentialsSeen.push(req.credentials);
        const u = new URL(req.url);
        if (u.pathname === '/app') return new Response(shellHtml(BUILD1), { status: 200, headers: { 'content-type': 'text/html' } });
        if (u.search.includes('_rsc')) return new Response('flight', { status: 200, headers: { 'content-type': 'text/x-component' } });
        if (u.pathname.endsWith('.js') || u.pathname.endsWith('.css')) return new Response('export default 1;', { status: 200 });
        return new Response('404', { status: 404 });
      },
    });
    let waitP = null;
    const client = { postMessage: () => {} };
    await ctx.handlers.message({
      data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app?tenant=demo` },
      source: client,
      waitUntil: (p) => { waitP = p; },
    });
    await waitP;
    await sleep(20);

    const metaMap = cachesApi.__map.get('ah-meta');
    check('ah-meta créé avec la clé epoch', Boolean(metaMap && metaMap.get('/__ah_build_epoch')));
    const epoch1 = metaMap ? await metaMap.get('/__ah_build_epoch').text() : null;
    check('epoch non vide et déterministe (build 1)', Boolean(epoch1 && epoch1.length > 4));

    // 2e pré-cache du MÊME build → PAS de diffusion (epoch inchangée)
    broadcasts.length = 0;
    let waitP2 = null;
    await ctx.handlers.message({
      data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app?tenant=demo` },
      source: client,
      waitUntil: (p) => { waitP2 = p; },
    });
    await waitP2;
    await sleep(20);
    check('même build → AUCUNE diffusion BUILD_EPOCH_CHANGED', broadcasts.length === 0);

    // GET_BUILD_EPOCH → réponse à la source
    const epochReplies = [];
    await ctx.handlers.message({
      data: { type: 'GET_BUILD_EPOCH' },
      source: { postMessage: (m) => epochReplies.push(m) },
      waitUntil: () => {},
    });
    await sleep(20);
    check(
      'GET_BUILD_EPOCH répond l\'epoch stockée',
      epochReplies.some((m) => m.type === 'BUILD_EPOCH' && m.epoch === epoch1),
    );
  }

  // ─── [2] ÉPOCH CHANGÉE (déploiement sans bump sw.js) → DIFFUSION ────────
  console.log('\n[2] Déploiement détecté — BUILD_EPOCH_CHANGED diffusé aux clients');
  {
    const cachesApi = makeMockCaches();
    const broadcasts = [];
    const broadcastClients = [{ postMessage: (m) => broadcasts.push(m) }];
    let currentBuild = shellHtml(BUILD1);
    const ctx = buildSwContext({
      idb: makeMockIdb({}), cachesApi, onLine: true, broadcastClients,
      fetchImpl: async (req) => {
        const u = new URL(req.url);
        if (u.pathname === '/app') return new Response(currentBuild, { status: 200, headers: { 'content-type': 'text/html' } });
        if (u.search.includes('_rsc')) return new Response('flight', { status: 200, headers: { 'content-type': 'text/x-component' } });
        if (u.pathname.endsWith('.js') || u.pathname.endsWith('.css')) return new Response('export default 1;', { status: 200 });
        return new Response('404', { status: 404 });
      },
    });
    const client = { postMessage: () => {} };

    // Pré-cache initial (build 1)
    let waitP = null;
    await ctx.handlers.message({ data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app` }, source: client, waitUntil: (p) => { waitP = p; } });
    await waitP; await sleep(20);

    // DÉPLOIEMENT : le HTML servi change (chunks du build 2)
    currentBuild = shellHtml(BUILD2);
    broadcasts.length = 0;
    let waitP2 = null;
    await ctx.handlers.message({ data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app` }, source: client, waitUntil: (p) => { waitP2 = p; } });
    await waitP2; await sleep(20);

    const changed = broadcasts.find((m) => m.type === 'BUILD_EPOCH_CHANGED');
    check('BUILD_EPOCH_CHANGED diffusé (previous ≠ epoch)', Boolean(changed && changed.previous !== changed.epoch));
    const metaMap = cachesApi.__map.get('ah-meta');
    const epoch2 = metaMap ? await metaMap.get('/__ah_build_epoch').text() : null;
    check('epoch mise à jour vers le build 2', Boolean(changed && changed.epoch === epoch2));

    // Les chunks du NOUVEAU build sont pré-cachés dans le même run
    const immutableMap = cachesApi.__map.get('ah-static-immutable') || new Map();
    const cachedKeys = [...immutableMap.keys()].join(' ');
    check('chunks du build 2 pré-cachés (entry-z9 + style-d4)', cachedKeys.includes('entry-z9') && cachedKeys.includes('style-d4'));
    check('chunks du build 1 conservés (entry-a1 — immuables, jamais purgés)', cachedKeys.includes('entry-a1'));
  }

  // ─── [3] ROUTES PUBLIQUES ANONYMES (credentials omit) ───────────────────
  console.log('\n[3] /login, /portal, / — pré-cache ANONYME (credentials omit)');
  {
    const cachesApi = makeMockCaches();
    const credsByPath = {};
    const ctx = buildSwContext({
      idb: makeMockIdb({}), cachesApi, onLine: true, broadcastClients: [],
      fetchImpl: async (req) => {
        const u = new URL(req.url);
        credsByPath[u.pathname] = req.credentials;
        if (u.pathname === '/login' || u.pathname === '/portal' || u.pathname === '/') {
          return new Response(shellHtml(['/_next/static/immutable/chunks/pub-x1.js']), { status: 200, headers: { 'content-type': 'text/html' } });
        }
        if (u.search.includes('_rsc')) return new Response('flight', { status: 200, headers: { 'content-type': 'text/x-component' } });
        if (u.pathname.endsWith('.js')) return new Response('export default 1;', { status: 200 });
        return new Response('404', { status: 404 });
      },
    });
    let waitP = null;
    const acks = [];
    const client = { postMessage: (m) => acks.push(m) };
    await ctx.handlers.message({
      data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/login?tenant=demo`, anonymous: true },
      source: client,
      waitUntil: (p) => { waitP = p; },
    });
    await waitP; await sleep(20);

    check('HTML /login fetché avec credentials=omit', credsByPath['/login'] === 'omit');
    check('RSC /login aussi en omit', credsByPath['/login'] === 'omit');
    const pagesMap = cachesApi.__map.get('ah-pages') || new Map();
    check('HTML /login caché dans ah-pages', [...pagesMap.keys()].some((k) => k.includes('/login')));
    const immutableMap = cachesApi.__map.get('ah-static-immutable') || new Map();
    check('chunks de /login pré-cachés', [...immutableMap.keys()].some((k) => k.includes('pub-x1.js')));
    check('ACK ok=true pour /login anonyme', acks.some((m) => m.type === 'PRECACHE_MODULE_RESULT' && m.ok === true));

    // Mode authentifié (sans anonymous) : credentials include (comportement inchangé)
    credsByPath['/login'] = undefined;
    let waitP2 = null;
    await ctx.handlers.message({
      data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app` },
      source: client,
      waitUntil: (p) => { waitP2 = p; },
    });
    await waitP2; await sleep(20);
    check('sans anonymous → credentials=include (non-régression /app)', credsByPath['/app'] === 'include');
  }

  // ─── [4] Navigation shell en ligne → epoch suivie (handleAppShell) ──────
  console.log('\n[4] Navigation /app en ligne — epoch suivie par le fetch handler');
  {
    const cachesApi = makeMockCaches();
    const broadcasts = [];
    const broadcastClients = [{ postMessage: (m) => broadcasts.push(m) }];
    let currentBuild = shellHtml(BUILD1);
    const ctx = buildSwContext({
      idb: makeMockIdb({}), cachesApi, onLine: true, broadcastClients,
      fetchImpl: async (req) => {
        const u = new URL(req.url);
        if (u.pathname === '/app') return new Response(currentBuild, { status: 200, headers: { 'content-type': 'text/html' } });
        return new Response('404', { status: 404 });
      },
    });
    // Navigation 1 (build 1) — accept: text/html (le SW traite comme navigation)
    const req1 = new Request(`${ORIGIN}/app?tenant=demo`, { headers: { accept: 'text/html,application/xhtml+xml' } });
    const r1 = await driveFetch(ctx.handlers, req1);
    check('navigation /app en ligne servie depuis le réseau', r1.handled && r1.response.ok);
    await sleep(40);
    const metaMap = cachesApi.__map.get('ah-meta');
    check('epoch stockée dès la 1re navigation (pas de diffusion — prev=null)', Boolean(metaMap && metaMap.get('/__ah_build_epoch')) && broadcasts.length === 0);

    // DÉPLOIEMENT → navigation 2 (build 2) → diffusion
    currentBuild = shellHtml(BUILD2);
    const req2 = new Request(`${ORIGIN}/app?tenant=demo`, { headers: { accept: 'text/html,application/xhtml+xml' } });
    await driveFetch(ctx.handlers, req2);
    await sleep(40);
    check('navigation après déploiement → BUILD_EPOCH_CHANGED diffusé', broadcasts.some((m) => m.type === 'BUILD_EPOCH_CHANGED'));
  }

  // ─── [5] Version + crawl élargi ──────────────────────────────────────────
  console.log('\n[5] Version SW + crawl');
  {
    check('SW_VERSION = v4.8.0 (bump → SW_ACTIVATED → re-pré-cache général)', SW_SOURCE.includes("const SW_VERSION = 'v4.8.0'"));
    check('CHUNK_CRAWL_MAX_NEW relevé à 120', /CHUNK_CRAWL_MAX_NEW = 120/.test(SW_SOURCE));
    check('GET_BUILD_EPOCH branché dans le message handler', SW_SOURCE.includes("event.data?.type === 'GET_BUILD_EPOCH'"));
    check('anonymous branché sur PRECACHE_MODULE', /PRECACHE_MODULE' && event\.data\.url[\s\S]{0,200}anonymous === true/.test(SW_SOURCE));
  }

  // ─── BILAN ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
    console.log('v4.8.0 — époque de build + routes publiques anonymes : TOUS LES TESTS PASSENT');
    process.exit(0);
  } else {
    console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
    console.log('ÉCHECS :');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERREUR FATALE DU HARNais :', err);
  process.exit(1);
});
