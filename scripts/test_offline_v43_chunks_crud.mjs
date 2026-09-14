/**
 * ============================================================================
 * TEST V4.3 — Crawl du graphe de chunks + identité CookieStore + DELETE offline
 * ============================================================================
 * Retours terrain (sept. 2026) :
 *  [1] « Connexion instable » (error boundary ChunkLoadError) sur le module
 *      élèves + onglet Enseignants & affectations → chunks PARESSEUX
 *      (next/dynamic ssr:false) absents du HTML → crawl du graphe de chunks.
 *  [2] Logo/acronyme de l'école absents hors ligne (et nom complet affiché)
 *      → fetchs NUS de la page sans headers : cookies invisibles au SW →
 *      identité ANONYMOUS → clé sans __ah_t → ratée du pré-cache →
 *      correctif CookieStore (apiIdentityAsync).
 *  [3] CRUD DELETE hors ligne : file outbox + écriture optimiste _deleted +
 *      réponse 200 X-Sync-Status: pending.
 * Méthode : sw.js exécuté en vm (même harnais que test_sw_v40_interception).
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

function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
const T1 = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const U1 = 'e8873cbe-3035-42fb-837f-f575a02e6373';
const JWT_T1 = `${b64url({ alg: 'none' })}.${b64url({ tenantId: T1, sub: U1 })}.sig`;
const ORIGIN = 'https://app.academiahelm.com';

// ─── Fabriques de mocks (repris du harnais v40) ────────────────────────────
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

function buildSwContext({ idb, cachesApi, fetchImpl, onLine, cookieStore }) {
  const handlers = {};
  const syncTags = [];
  const selfObj = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: ORIGIN, hostname: 'app.academiahelm.com', protocol: 'https:' },
    navigator: { onLine },
    registration: { sync: { register: async (tag) => { syncTags.push(tag); return true; } } },
    clients: { matchAll: async () => [] },
    skipWaiting: async () => {},
    postMessage: () => {},
  };
  if (cookieStore) selfObj.cookieStore = cookieStore;
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
  return { handlers, syncTags, sandbox };
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

  // ─── [1] CRAWL DU GRAPHE DE CHUNKS (v4.3.0) ─────────────────────────────
  console.log('\n[1] Crawl du graphe de chunks — chunks paresseux pré-cachés');
  {
    const CHUNK_A = '/_next/static/immutable/chunks/runtime-seed.js';
    const CHUNK_CSS = '/_next/static/immutable/chunks/style-seed.css';
    const LAZY_1 = '/_next/static/immutable/chunks/lazy-students-page.js';
    const LAZY_2 = '/_next/static/immutable/chunks/lazy-subtab.js';
    const LAZY_3 = '/_next/static/immutable/chunks/lazy-nested.js'; // découvert au niveau 2
    // HTML de /app/students : référence A + CSS (comme le vrai build — les
    // chunks paresseux sont ABSENTS du HTML)
    const html = `<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="${CHUNK_CSS}"/>
      <script src="${CHUNK_A}" defer></script>
    </head><body><div id="root">shell</div></body></html>`;
    // A (runtime) contient les maps → refs vers LAZY_1 et LAZY_2
    const jsA = `__turbopack_map__={"m1":"static/immutable/chunks/lazy-students-page.js","m2":"static/immutable/chunks/lazy-subtab.js"};`;
    // LAZY_1 référence LAZY_3 (chunk partagé chargé après)
    const jsLazy1 = `import("immutable/chunks/lazy-nested.js");`;
    const bodyOf = { [CHUNK_A]: jsA, [CHUNK_CSS]: 'body{}', [LAZY_1]: jsLazy1, [LAZY_2]: 'export default 2;', [LAZY_3]: 'export default 3;' };
    const fetched = [];
    const cachesApi = makeMockCaches();
    const ctx = buildSwContext({
      idb: makeMockIdb({}), cachesApi, onLine: true,
      fetchImpl: async (req) => {
        const u = new URL(req.url);
        fetched.push(u.pathname);
        if (u.pathname === '/app/students') return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
        if (u.pathname.startsWith('/_rsc') || u.search.includes('_rsc')) return new Response('flight', { status: 200, headers: { 'content-type': 'text/x-component' } });
        const body = bodyOf[u.pathname];
        if (body !== undefined) {
          const ct = u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript';
          return new Response(body, { status: 200, headers: { 'content-type': ct } });
        }
        return new Response('404', { status: 404 });
      },
    });
    const acks = [];
    const client = { postMessage: (m) => acks.push(m) };
    let waitP = null;
    await ctx.handlers.message({
      data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app/students` },
      source: client,
      waitUntil: (p) => { waitP = p; },
    });
    await waitP;
    await sleep(20);
    const immutableMap = cachesApi.__map.get('ah-static-immutable') || new Map();
    const cached = [...immutableMap.keys()];
    const hasCached = (p) => cached.some((k) => k.startsWith(ORIGIN) && k.includes(p));
    check('ACK PRECACHE_MODULE_RESULT ok=true (HTML)', acks.some((m) => m.type === 'PRECACHE_MODULE_RESULT' && m.ok === true));
    check('chunks du HTML cachés (runtime + css)', hasCached('runtime-seed.js') && hasCached('style-seed.css'));
    check('LAZY_1 (ssr:false StudentsModulePage) découvert niveau 1', hasCached('lazy-students-page.js'));
    check('LAZY_2 (sous-onglet) découvert niveau 1', hasCached('lazy-subtab.js'));
    check('LAZY_3 (imbriqué) découvert niveau 2', hasCached('lazy-nested.js'));
    check('aucune 404 cachée', ![...immutableMap.values()].some((r) => r.status === 404));
    // Le crawl est idempotent (2e route → pas de re-fetch des chunks déjà vus)
    const fetchedCountBefore = fetched.length;
    await ctx.handlers.message({
      data: { type: 'PRECACHE_MODULE', url: `${ORIGIN}/app/pedagogy/teachers` },
      source: client,
      waitUntil: (p) => { waitP = p; },
    });
    await waitP;
    await sleep(20);
    const refetchedSeeds = fetched.slice(fetchedCountBefore).filter((p) => p === CHUNK_A || p === LAZY_1);
    check('2e route : chunks déjà scannés non re-téléchargés', refetchedSeeds.length === 0);
  }

  // ─── [2] IDENTITÉ COOKIESTORE (v4.2.1 — logo/acronyme + data fetchs nus) ─
  console.log('\n[2] apiIdentityAsync (CookieStore) — fetchs nus de la page');
  {
    // Identité (settings/identity) pré-cachée SOUS la clé T|U (pré-cache)
    // — c'est ce que fait le SW pour un GET axios/pré-cache.
    const idb = makeMockIdb({ response_cache: [] });
    const cachesApi = makeMockCaches();
    const identityPayload = JSON.stringify({
      schoolName: 'Complexe Scolaire Privé Mon Avenir Plus',
      schoolAcronym: 'CSP Mon Avenir',
      logoUrl: 'data:image/jpeg;base64,QUJD',
    });
    // pré-cache simulé : la clé a le suffixe __ah_t de T:tid|U:uid
    const identityKey = `${ORIGIN}/api/settings/identity?__ah_t=b450d2a4`;
    const apiCache = await cachesApi.open('ah-api');
    await apiCache.put(new Request(identityKey), new Response(identityPayload, { status: 200, headers: { 'content-type': 'application/json' } }));
    // CookieStore mocké : les cookies de l'origine
    const cookieStore = { getAll: async () => [
      { name: 'x-tenant-id', value: T1 },
      { name: 'academia_token', value: JWT_T1 },
    ] };
    const ctx = buildSwContext({
      idb, cachesApi, onLine: false, cookieStore,
      fetchImpl: async () => { throw new Error('offline: network unreachable'); },
    });
    // Fetch NU (comme PilotageTopBar/WhatsAppChat : credentials include, AUCUN header)
    const res = await driveFetch(ctx.handlers, new Request(`${ORIGIN}/api/settings/identity`, { credentials: 'include' }));
    check('identité servie depuis le cache (200) au fetch nu', res.handled && res.response.status === 200);
    const body = await res.response.json();
    check('acronym présent (fin du nom-complet-fallback)', body.schoolAcronym === 'CSP Mon Avenir');
    check('logoUrl data-URI présent (affiché hors ligne)', typeof body.logoUrl === 'string' && body.logoUrl.startsWith('data:image/'));
    // Sans CookieStore (navigateur ancien) : statu quo ANONYMOUS (pas de crash)
    const ctx2 = buildSwContext({
      idb: makeMockIdb({}), cachesApi: makeMockCaches(), onLine: false,
      fetchImpl: async () => { throw new Error('offline'); },
    });
    const res2 = await driveFetch(ctx2.handlers, new Request(`${ORIGIN}/api/settings/identity`, { credentials: 'include' }));
    check('sans CookieStore : 503 rapide explicite (pas de crash)', res2.handled && res2.response.status === 503);
    // Mutation nue (chat POST offline) : file outbox AVANT v4.2.1 impossible
    const idbMut = makeMockIdb({ outbox_events: [], chat: [] });
    const ctxMut = buildSwContext({
      idb: idbMut, cachesApi: makeMockCaches(), onLine: false, cookieStore,
      fetchImpl: async () => { throw new Error('offline'); },
    });
    const resMut = await driveFetch(ctxMut.handlers, new Request(`${ORIGIN}/api/chat/conversations/conv-1/messages/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'bonjour offline' }),
    }));
    check('POST nu hors ligne : 200 + X-Sync-Status: pending (mis en file)', resMut.handled && resMut.response.status === 200 && resMut.response.headers.get('X-Sync-Status') === 'pending');
    await sleep(30);
    const outbox = idbMut.stores.outbox_events || [];
    check('POST nu : événement outbox créé (tenant résolu via CookieStore)', outbox.length === 1 && outbox[0].tenantId === T1);
  }

  // ─── [3] DELETE HORS LIGNE (CRUD complet) ───────────────────────────────
  console.log('\n[3] DELETE hors ligne — optimiste + file + replay');
    const DEL_ID = 'dead0000-0000-4000-8000-000000000001';
    const KEEP_ID = '11111111-2222-3333-4444-555555555555';
    const metaOf = (m) => (typeof m === 'string' ? JSON.parse(m || '{}') : (m || {}));
  {
    const idb = makeMockIdb({ outbox_events: [], student: [
      { id: DEL_ID, firstName: 'Ancien', tenantId: T1, status: 'ACTIVE' },
    ], response_cache: [] });
    const cachesApi = makeMockCaches();
    const ctx = buildSwContext({
      idb, cachesApi, onLine: false,
      fetchImpl: async () => { throw new Error('offline'); },
    });
    const res = await driveFetch(ctx.handlers, new Request(`${ORIGIN}/api/students/${DEL_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${JWT_T1}`, 'x-tenant-id': T1 },
    }));
    check('DELETE hors ligne : 200 + X-Sync-Status: pending', res.handled && res.response.status === 200 && res.response.headers.get('X-Sync-Status') === 'pending');
    await sleep(30);
    const student = (idb.stores.student || []).find((s) => s.id === DEL_ID);
    check('entité marquée _deleted=true (optimiste)', Boolean(student && student._deleted && student._isDirty));
    const outbox = (idb.stores.outbox_events || []).find((e) => metaOf(e.metadata).request?.url?.includes(DEL_ID));
    check('événement outbox DELETE (metadata.request conservée)', Boolean(outbox && metaOf(outbox.metadata).request?.method === 'DELETE'));
    // La lecture hors ligne fusionne et RETIRE l'entité supprimée
    const cachesApi2 = makeMockCaches();
    const ctxRead = buildSwContext({
      idb: makeMockIdb({ student: [
        { id: KEEP_ID, firstName: 'Reste', tenantId: T1, status: 'ACTIVE' },
        { id: DEL_ID, firstName: 'Ancien', tenantId: T1, status: 'ACTIVE', _deleted: true, _isDirty: true },
      ], response_cache: [] }),
      cachesApi: cachesApi2, onLine: false,
      fetchImpl: async () => { throw new Error('offline'); },
    });
    const resRead = await driveFetch(ctxRead.handlers, new Request(`${ORIGIN}/api/students?academicYearId=y1`, { headers: { authorization: `Bearer ${JWT_T1}`, 'x-tenant-id': T1 } }));
    check('lecture hors ligne : 200 (cascade IDB)', resRead.handled && resRead.response.status === 200);
    const readBody = await resRead.response.json();
    const items = Array.isArray(readBody) ? readBody : (readBody.data || readBody.items || []);
    check('la liste RETIRE l élève supprimé (fusion _deleted)', items.some((s) => s.id === KEEP_ID) && !items.some((s) => s.id === DEL_ID));
  }

  // ─── [4] Version + patterns ──────────────────────────────────────────────
  console.log('\n[4] Version SW + patterns');
  check('SW_VERSION ≥ v4.3.0', /SW_VERSION = 'v4\.[4-9]\.[0-9]+'/.test(SW_SOURCE) || SW_SOURCE.includes("SW_VERSION = 'v4.3.0'"));
  check('crawl : CHUNK_REF_REGEX + profondeur 3', SW_SOURCE.includes('CHUNK_REF_REGEX') && SW_SOURCE.includes('CHUNK_CRAWL_DEPTH = 3'));
  check('crawl branché dans precacheModule', /precacheModule[\s\S]{0,4000}crawlChunkGraph\(staticCache, chunks\)/.test(SW_SOURCE));
  check('apiIdentityAsync utilisée par GET + mutation', SW_SOURCE.includes('await apiIdentityAsync(request)'));

  console.log('\n' + '═'.repeat(56));
  if (failed > 0) {
    console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
  console.log('v4.3.0 — crawl chunks + CookieStore + CRUD offline : TOUS LES TESTS PASSENT');
}

main().catch((e) => { console.error('ERREUR TEST:', e); process.exit(1); });
