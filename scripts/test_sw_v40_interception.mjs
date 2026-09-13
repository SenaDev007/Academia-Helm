/**
 * ============================================================================
 * TEST V4.0 — Interception réseau par le Service Worker (sw.js)
 * ============================================================================
 * Spec « Correction d'architecture — Interception réseau (Service Worker) » :
 *  [1] §3 — mapping centralisé route → table (ROUTE_TABLES)
 *  [2] §2.3 — write-through IndexedDB après GET réseau réussi
 *      (response_cache + stores d'entités)
 *  [3] §2.4 — GET hors ligne : cascade Cache API → response_cache → stores
 *      d'entités (filtres tenant/année, _deleted retiré, champs _ masqués)
 *  [4] §4.1/§4.2 — mutation EN LIGNE : réponse réelle passée telle quelle
 *      (4xx NON mise en file) + purge famille après 2xx
 *  [5] §4.3 — mutation HORS LIGNE : file outbox_events (metadata.sw +
 *      metadata.request) + écriture optimiste + réponse fabriquée 200 avec
 *      X-Sync-Status: pending
 *  [6] §4.3 — fusion : la création hors ligne est VISIBLE dans la lecture
 *      (GET → liste + entité _isDirty fusionnée)
 *  [7] replay Background Sync : 2xx → SYNCED + dirty cleared + famille purgée ;
 *      4xx → FAILED (message serveur) ; réseau KO → reste PENDING
 *  [8] §6 — passerelles de paiement (feexpay/fedapay) JAMAIS interceptées
 *  [9] anti double-replay : le push générique legacy saute les événements
 *      portant metadata.request (propriété SW ou applicative)
 * ============================================================================
 * Méthode : sw.js est exécuté dans un contexte vm avec self/caches/
 * indexedDB/fetch mockés ; on pilote le VRAI handler 'fetch' enregistré.
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

// ─── Fabrique de requêtes IDB mockées (événements onsuccess/onerror) ───────
function idbReq(result) {
  // Miroir de l'API IDB réelle : `request.result` est peuplé au fire
  return {
    onsuccess: null,
    onerror: null,
    result: undefined,
    __result: result,
    __fire() { this.result = this.__result; this.onsuccess && this.onsuccess({ target: this }); },
  };
}
function fire(req) { if (req && typeof req.__fire === 'function') req.__fire(); return req; }

// ─── IndexedDB mémoire ──────────────────────────────────────────────────────
function makeMockIdb(stores) {
  const storeNames = new Set(Object.keys(stores));
  // Store lié à son NOM par closure (pas d'héritage — évite le piège __name)
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
    transaction(_names, _mode) {
      return { objectStore: (name) => makeStore(name) };
    },
  };
  return {
    stores,
    open(_name) {
      const r = idbReq(db);
      queueMicrotask(() => fire(r));
      return r;
    },
  };
}

// ─── Cache Storage mémoire (clé → Response) ────────────────────────────────
function makeMockCaches() {
  const cachesMap = new Map();
  const api = {
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
  return api;
}

// ─── Contexte SW (vm) ───────────────────────────────────────────────────────
function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
const T1 = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const U1 = 'e8873cbe-3035-42fb-837f-f575a02e6373';
const JWT_T1 = `${b64url({ alg: 'none' })}.${b64url({ tenantId: T1, sub: U1 })}.sig`;

function buildSwContext({ idb, cachesApi, fetchImpl, onLine }) {
  const handlers = {};
  const syncTags = [];
  const messages = [];
  const selfObj = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: 'https://app.academiahelm.com', hostname: 'app.academiahelm.com', protocol: 'https:' },
    navigator: { onLine },
    registration: { sync: { register: async (tag) => { syncTags.push(tag); return true; } } },
    clients: { matchAll: async () => [] },
    skipWaiting: async () => {},
    postMessage: () => {},
  };
  const sandbox = {
    self: selfObj,
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    AbortController,
    AbortSignal,
    fetch: fetchImpl,
    indexedDB: idb,
    caches: cachesApi,
    URL,
    URLSearchParams,
    Request,
    Response,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    TextEncoder,
    TextDecoder,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox, { filename: 'sw.js' });
  return { handlers, syncTags, messages, sandbox };
}

// Pilote le handler fetch du SW : retourne la Response (respondWith résolue)
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
  const YEAR_ACTIVE = 'year-active-2026';
  const YEAR_OLD = 'year-old-2025';

  // ─── [1] Mapping centralisé (§3) ─────────────────────────────────────────
  console.log('\n[1] §3 — Mapping centralisé route → table');
  {
    const ctx = buildSwContext({ idb: makeMockIdb({}), cachesApi: makeMockCaches(), fetchImpl: async () => new Response('{}'), onLine: true });
    const rt = (p) => vm.runInContext(`routeTable('${p}')`, ctx.sandbox);
    check('/api/students → student', rt('/api/students') === 'student');
    check('/api/students/{uuid} → student (pathname, jamais de query)', rt('/api/students/11111111-2222-3333-4444-555555555555') === 'student');
    check('/api/finance/payments → payment', rt('/api/finance/payments') === 'payment');
    check('/api/finance/transactions → financetransaction', rt('/api/finance/transactions') === 'financetransaction');
    check('/api/hr/staff → staff', rt('/api/hr/staff') === 'staff');
    check('/api/academic-years → academicyear', rt('/api/academic-years') === 'academicyear');
    check('/api/school-levels → schoollevel', rt('/api/school-levels') === 'schoollevel');
    check('/api/settings/features → tenantfeature', rt('/api/settings/features') === 'tenantfeature');
    check('/api/modules-complementaires/shop/products → shopproduct', rt('/api/modules-complementaires/shop/products') === 'shopproduct');
    check('/api/educast/contents → educastcontent', rt('/api/educast/contents') === 'educastcontent');
    check('/api/dashboard/overview → orion_cache (agrégat)', rt('/api/dashboard/overview') === 'orion_cache');
    check('/api/students/statistics → api_cache (exclu des entités)', rt('/api/students/statistics') === 'api_cache');
    check('/api/qqchose → api_cache (fallback générique)', rt('/api/qqchose') === 'api_cache');
    check('/page/qqchose → null (pas une route API)', rt('/page/qqchose') === null);
    const et = (p) => vm.runInContext(`inferEntityType('${p}')`, ctx.sandbox);
    check('entité /api/students → STUDENT', et('/api/students') === 'STUDENT');
    check('entité /api/finance/payments → PAYMENT', et('/api/finance/payments') === 'PAYMENT');
    check('entité /api/grades → GRADE', et('/api/grades') === 'GRADE');
  }

  // ─── [2] Write-through IDB après GET réussi (§2.3) ───────────────────────
  console.log('\n[2] §2.3 — Write-through IndexedDB (GET réseau réussi)');
  {
    const idb = makeMockIdb({ response_cache: [], student: [] });
    const cachesApi = makeMockCaches();
    const payload = { data: [{ id: 's1', firstName: 'Awa', tenantId: T1 }, { id: 's2', firstName: 'Bou', tenantId: T1 }], total: 2 };
    let fetchCalls = 0;
    const ctx = buildSwContext({ idb, cachesApi, onLine: true, fetchImpl: async () => { fetchCalls++; return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
    const { handlers } = ctx;
    const res = await driveFetch(handlers, new Request(`https://app.academiahelm.com/api/students?academicYearId=${YEAR_ACTIVE}`, { headers: { authorization: `Bearer ${JWT_T1}` } }));
    check('réponse réseau passée (200)', res.handled && res.response.status === 200);
    await sleep(30); // write-through asynchrone
    const rc = idb.stores.response_cache || [];
    check('response_cache : 1 entrée écrite', rc.length === 1);
    check('response_cache : clé T:tenant|GET|chemin', rc[0].cacheKey === `T:${T1}|GET|/api/students?academicYearId=${YEAR_ACTIVE}`);
    check('response_cache : data = tableau paginé', Array.isArray(rc[0].data?.data) && rc[0].data.total === 2);
    const st = idb.stores.student || [];
    check('store student : 2 entités écrites (write-through)', st.length === 2 && st[0].id === 's1');
    check('store student : pas de _isDirty (données fraîches)', st.every((e) => e._isDirty !== true));
    check('store student : _cachedAt posé', st.every((e) => typeof e._cachedAt === 'string'));
  }

  // ─── [3] GET hors ligne : cascade IDB (§2.4) ─────────────────────────────
  console.log('\n[3] §2.4 — GET hors ligne : cascade Cache API → response_cache → entités');
  {
    const idb = makeMockIdb({
      local_academic_year: [{ id: YEAR_ACTIVE }],
      student: [
        { id: 's1', firstName: 'Awa', tenantId: T1, academicYearId: YEAR_ACTIVE },
        { id: 's2', firstName: 'Old', tenantId: T1, academicYearId: YEAR_OLD },         // année antérieure → exclu
        { id: 's3', firstName: 'Other', tenantId: 'tenant-autre', academicYearId: YEAR_ACTIVE }, // autre tenant → exclu
        { id: 's4', firstName: 'Deleted', tenantId: T1, academicYearId: YEAR_ACTIVE, _deleted: true }, // supprimé → exclu
      ],
      response_cache: [],
    });
    const cachesApi = makeMockCaches(); // Cache API vide → cascade IDB
    const ctx = buildSwContext({ idb, cachesApi, onLine: false, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    const { handlers } = ctx;
    const res = await driveFetch(handlers, new Request('https://app.academiahelm.com/api/students?academicYearId=' + YEAR_ACTIVE, { headers: { authorization: `Bearer ${JWT_T1}` } }));
    check('réponse fabriquée 200 (store entités)', res.handled && res.response.status === 200);
    const body = await res.response.json();
    check('liste = tableau JSON', Array.isArray(body));
    check('seul l\'élève du tenant/année active est servi', body.length === 1 && body[0].id === 's1');
    check('champs internes _ masqués', body[0]._isDirty === undefined && body[0]._cachedAt === undefined);
    check('en-tête X-AH-Offline posé', res.response.headers.get('X-AH-Offline') === '1');
  }

  // ─── [4] Mutation EN LIGNE : réponse réelle, jamais de file (§4.1/§4.2) ──
  console.log('\n[4] §4.1/§4.2 — Mutation en ligne : transparence totale');
  {
    const idb = makeMockIdb({ outbox_events: [], student: [] });
    const cachesApi = makeMockCaches();
    // Pré-remplir le cache API avec une entrée de la famille /api/students
    const apiCache = await cachesApi.open('ah-api');
    await apiCache.put(new Request(`https://app.academiahelm.com/api/students?academicYearId=${YEAR_ACTIVE}&__ah_t=1`), new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
    let fetchCalls = 0;
    const ctx = buildSwContext({ idb, cachesApi, onLine: true, fetchImpl: async (req) => { fetchCalls++; return new Response(JSON.stringify({ message: 'refusé' }), { status: 403 }); } });
    const { handlers } = ctx;
    const res = await driveFetch(handlers, new Request('https://app.academiahelm.com/api/students', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` }, body: JSON.stringify({ firstName: 'Zoé' }) }));
    check('réponse 403 réelle passée telle quelle (PAS fabriquée)', res.handled && res.response.status === 403);
    check('réseau appelé 1 fois (pas de retry interne)', fetchCalls === 1);
    check('AUCUN événement outbox (erreur HTTP ≠ échec réseau)', (idb.stores.outbox_events || []).length === 0);
    check('en-tête X-Sync-Status ABSENT (pas de file)', res.response.headers.get('X-Sync-Status') === null);

    // 2xx → purge de la famille
    const ctx2 = buildSwContext({ idb, cachesApi, onLine: true, fetchImpl: async () => new Response(JSON.stringify({ id: 'new-1' }), { status: 201 }) });
    const res2 = await driveFetch(ctx2.handlers, new Request('https://app.academiahelm.com/api/students', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` }, body: JSON.stringify({ firstName: 'Zoé' }) }));
    check('2xx réel passé tel quel (201)', res2.handled && res2.response.status === 201);
    await sleep(30);
    const remaining = await (await cachesApi.open('ah-api')).keys();
    check('famille /api/students purgée du cache après 2xx', remaining.length === 0);
  }

  // ─── [5] Mutation HORS LIGNE : file + réponse fabriquée (§4.3) ───────────
  console.log('\n[5] §4.3 — Mutation hors ligne : file + X-Sync-Status: pending');
  {
    const idb = makeMockIdb({ outbox_events: [], student: [{ id: '11111111-2222-3333-4444-555555555555', firstName: 'Marc', tenantId: T1, status: 'ACTIVE', academicYearId: YEAR_ACTIVE }] });
    const cachesApi = makeMockCaches();
    let fetchCalls = 0;
    const ctx = buildSwContext({ idb, cachesApi, onLine: false, fetchImpl: async () => { fetchCalls++; throw new TypeError('Failed to fetch'); } });
    const { handlers, syncTags } = ctx;

    // POST création
    const res = await driveFetch(handlers, new Request('https://app.academiahelm.com/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` },
      body: JSON.stringify({ firstName: 'Nouvel', lastName: 'Élève', schoolLevelId: 'lvl-1' }),
    }));
    check('réponse fabriquée 200 (offline)', res.handled && res.response.status === 200);
    check('en-tête X-Sync-Status: pending', res.response.headers.get('X-Sync-Status') === 'pending');
    const fabBody = await res.response.json();
    check('corps fabriqué : entité publique avec id', typeof fabBody.id === 'string' && fabBody._isDirty === undefined);

    const events = idb.stores.outbox_events || [];
    check('outbox : 1 événement PENDING', events.length === 1 && events[0].status === 'PENDING');
    const meta = JSON.parse(events[0].metadata);
    check('outbox : metadata.sw = v4 (propriété replay SW)', meta.sw === 'v4');
    check('outbox : metadata.request = {url, method, body, auth}', meta.request.method === 'POST' && meta.request.url.includes('/api/students') && meta.request.body.firstName === 'Nouvel' && meta.request.auth.includes('Bearer'));
    check('outbox : tenantId du JWT', events[0].tenantId === T1);
    check('Background Sync enregistré (ah-sync-pending)', syncTags.includes('ah-sync-pending'));

    const students = idb.stores.student || [];
    check('écriture optimiste : élève ajouté au store avec _isDirty', students.some((s) => s.firstName === 'Nouvel' && s._isDirty === true));
    check('réseau jamais appelé (offline déclaré)', fetchCalls === 0);

    // PUT modification
    await driveFetch(handlers, new Request(`https://app.academiahelm.com/api/students/${events[0].entityId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` },
      body: JSON.stringify({ id: events[0].entityId, firstName: 'Nouvel', lastName: 'Modifié' }),
    }));
    check('PUT offline : entité mise à jour (upsert)', (idb.stores.student || []).find((s) => s.id === events[0].entityId)?.lastName === 'Modifié');

    // URL d'action archive
    await driveFetch(handlers, new Request(`https://app.academiahelm.com/api/students/11111111-2222-3333-4444-555555555555/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` },
      body: JSON.stringify({}),
    }));
    check('URL d\'action archive → UPDATE locale + status ARCHIVED', (idb.stores.student || []).find((s) => s.id === '11111111-2222-3333-4444-555555555555')?.status === 'ARCHIVED');

    // DELETE
    await driveFetch(handlers, new Request(`https://app.academiahelm.com/api/students/11111111-2222-3333-4444-555555555555`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${JWT_T1}` },
    }));
    check('DELETE offline → _deleted (soft delete)', (idb.stores.student || []).find((s) => s.id === '11111111-2222-3333-4444-555555555555')?._deleted === true);
    check('outbox : 4 événements au total (POST, PUT, action, DELETE)', (idb.stores.outbox_events || []).length === 4);

    // ─── [6] Fusion : la création hors ligne est VISIBLE en lecture ────────
    console.log('\n[6] fusion — création hors ligne visible dans la lecture');
    idb.stores.local_academic_year = [{ id: YEAR_ACTIVE }];
    (idb.stores.student || []).forEach((s) => { if (!s.academicYearId) s.academicYearId = YEAR_ACTIVE; });
    const resGet = await driveFetch(handlers, new Request(`https://app.academiahelm.com/api/students?academicYearId=${YEAR_ACTIVE}`, { headers: { authorization: `Bearer ${JWT_T1}` } }));
    check('GET offline : 200', resGet.handled && resGet.response.status === 200);
    const list = await resGet.response.json();
    check('la liste contient l\'élève créé hors ligne', Array.isArray(list) && list.some((s) => s.firstName === 'Nouvel'));
    check('l\'entité archivée+supprimée localement est retirée', !list.some((s) => s.id === '11111111-2222-3333-4444-555555555555'));
    check('champs internes masqués dans la liste fusionnée', list.every((s) => s._isDirty === undefined));

    // ─── [7] Replay Background Sync ────────────────────────────────────────
    console.log('\n[7] replay — Background Sync (2xx / 4xx / réseau KO)');
    // (a) 2xx — la réponse serveur reprend l'ID de l'événement (echo réaliste)
    const replayedUrls = [];
    const ctxReplayOk = buildSwContext({ idb, cachesApi: makeMockCaches(), onLine: true, fetchImpl: async (input, init) => { replayedUrls.push(String(input)); return new Response(JSON.stringify({ id: events[0].entityId, firstName: 'Nouvel', serverField: true }), { status: 200 }); } });
    const out1 = await vm.runInContext('swReplayPendingMutations()', ctxReplayOk.sandbox);
    await sleep(30);
    check('replay 2xx : événement rejoué vers l\'URL d\'origine', replayedUrls.some((u) => u.includes('/api/students')));
    check('replay 2xx : compteur {replayed>0}', out1.replayed > 0);
    const evAfter = (idb.stores.outbox_events || []).filter((e) => e.id === events[0].id);
    check('replay 2xx : événement SYNCED', evAfter[0]?.status === 'SYNCED');
    const syncedEntity = (idb.stores.student || []).find((s) => s.id === events[0].entityId);
    check('replay 2xx : réponse serveur écrite + _isDirty cleared', syncedEntity?.serverField === true && syncedEntity?._isDirty === false);

    // (b) 4xx → FAILED
    const idb4 = makeMockIdb({ outbox_events: [{ id: 'ev-4xx', tenantId: T1, entityType: 'STUDENT', entityId: 's-4xx', operation: 'CREATE', payload: '{}', metadata: JSON.stringify({ sw: 'v4', request: { url: 'https://app.academiahelm.com/api/students', method: 'POST', body: { x: 1 } } }), status: 'PENDING', createdAt: new Date().toISOString() }], student: [] });
    const ctx4 = buildSwContext({ idb: idb4, cachesApi: makeMockCaches(), onLine: true, fetchImpl: async () => new Response(JSON.stringify({ message: 'validation refusée' }), { status: 422 }) });
    const out4 = await vm.runInContext('swReplayPendingMutations()', ctx4.sandbox);
    await sleep(20);
    check('replay 4xx : FAILED avec message serveur', idb4.stores.outbox_events[0].status === 'FAILED' && /validation refusée/.test(idb4.stores.outbox_events[0].errorMessage || ''));

    // (c) réseau KO → reste PENDING
    const idb5 = makeMockIdb({ outbox_events: [{ id: 'ev-net', tenantId: T1, entityType: 'STUDENT', entityId: 's-net', operation: 'CREATE', payload: '{}', metadata: JSON.stringify({ sw: 'v4', request: { url: 'https://app.academiahelm.com/api/students', method: 'POST', body: { x: 1 } } }), status: 'PENDING', createdAt: new Date().toISOString() }], student: [] });
    const ctx5 = buildSwContext({ idb: idb5, cachesApi: makeMockCaches(), onLine: true, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    const out5 = await vm.runInContext('swReplayPendingMutations()', ctx5.sandbox);
    await sleep(20);
    check('replay réseau KO : reste PENDING (retenté plus tard)', idb5.stores.outbox_events[0].status === 'PENDING');

    // (d) les événements NON-sw ne sont PAS rejoués par le SW
    const idb6 = makeMockIdb({ outbox_events: [{ id: 'ev-app', tenantId: T1, entityType: 'STUDENT', entityId: 's-app', operation: 'CREATE', payload: '{}', metadata: JSON.stringify({ request: { url: 'https://app.academiahelm.com/api/students', method: 'POST', body: { x: 1 } } }), status: 'PENDING', createdAt: new Date().toISOString() }], student: [] });
    let appFetches = 0;
    const ctx6 = buildSwContext({ idb: idb6, cachesApi: makeMockCaches(), onLine: true, fetchImpl: async () => { appFetches++; return new Response('{}', { status: 200 }); } });
    await vm.runInContext('swReplayPendingMutations()', ctx6.sandbox);
    check('événement applicatif (sans metadata.sw) : PAS rejoué par le SW', appFetches === 0 && idb6.stores.outbox_events[0].status === 'PENDING');
  }

  // ─── [8] Passerelles de paiement jamais interceptées (§6) ───────────────
  console.log('\n[8] §6 — Passerelles de paiement (feexpay/fedapay) hors interception');
  {
    const idb = makeMockIdb({ outbox_events: [], payment: [] });
    const ctx = buildSwContext({ idb, cachesApi: makeMockCaches(), onLine: false, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    const res = await driveFetch(ctx.handlers, new Request('https://app.academiahelm.com/api/finance/payments/feexpay/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` },
      body: JSON.stringify({ amount: 5000 }),
    }));
    check('POST feexpay NON intercepté (pas de respondWith → erreur réseau honnête)', res.handled === false);
    check('aucune mise en file pour la passerelle', (idb.stores.outbox_events || []).length === 0);
    const res2 = await driveFetch(ctx.handlers, new Request('https://app.academiahelm.com/api/billing/feexpay/school-config', { headers: { authorization: `Bearer ${JWT_T1}` } }));
    check('GET feexpay NON intercepté', res2.handled === false);
  }

  // ─── [9] Push générique legacy : saute metadata.request (anti-doublon) ──
  console.log('\n[9] anti double-replay — push legacy saute metadata.request');
  {
    const idb = makeMockIdb({
      outbox_events: [
        { id: 'leg-1', tenantId: T1, entityType: 'STUDENT', entityId: 'x', operation: 'CREATE', payload: '{}', metadata: undefined, status: 'PENDING', createdAt: new Date().toISOString() },
        { id: 'req-1', tenantId: T1, entityType: 'STUDENT', entityId: 'y', operation: 'CREATE', payload: '{}', metadata: JSON.stringify({ sw: 'v4', request: { url: 'u', method: 'POST', body: {} } }), status: 'PENDING', createdAt: new Date().toISOString() },
        { id: 'req-2', tenantId: T1, entityType: 'STUDENT', entityId: 'z', operation: 'CREATE', payload: '{}', metadata: JSON.stringify({ request: { url: 'u2', method: 'POST', body: {} } }), status: 'PENDING', createdAt: new Date().toISOString() },
      ],
    });
    // swReadPendingEvents est interne — on teste via swPushOutboxFromIDB :
    // le push générique appelle /api/sync/push avec les opérations LEGACY seules.
    let pushBody = null;
    // Token miroir JWT (swGetAuthToken lit le cache 'ah-auth-token' — clé
    // '/__sw_auth_token__' ; put par clé STRING : Node n'accepte pas d'URL
    // relative dans new Request, et le SW matche par cette même clé).
    const caches9 = makeMockCaches();
    const authCache = await caches9.open('ah-auth-token');
    await authCache.put('/__sw_auth_token__', new Response(JWT_T1, { status: 200 }));
    const ctx = buildSwContext({ idb, cachesApi: caches9, onLine: true, fetchImpl: async (input, init) => { pushBody = init?.body ? JSON.parse(init.body) : null; return new Response(JSON.stringify({ results: [{ operation_id: 'leg-1', status: 'SUCCESS' }] }), { status: 200 }); } });
    await vm.runInContext('swPushOutboxFromIDB()', ctx.sandbox);
    await sleep(30);
    check('batch générique envoyé avec 1 SEULE opération (legacy)', pushBody && pushBody.operations?.length === 1 && pushBody.operations[0].id === 'leg-1');
    check('événement legacy → ACKNOWLEDGED', idb.stores.outbox_events.find((e) => e.id === 'leg-1')?.status === 'ACKNOWLEDGED');
    check('événements metadata.request : NON poussés génériquement (pas de doublon)', ['req-1', 'req-2'].every((k) => idb.stores.outbox_events.find((e) => e.id === k)?.status === 'PENDING'));
  }

  // ─── [10] Anti-doublon : TIMEOUT ≠ erreur réseau (504, pas de file) ─────
  console.log('\n[10] timeout → 504 honnête (anti-doublon), jamais mis en file');
  {
    const idb = makeMockIdb({ outbox_events: [], student: [] });
    // Simule le rejet exact de fetchWithTimeout au bout du délai
    const ctx = buildSwContext({ idb, cachesApi: makeMockCaches(), onLine: true, fetchImpl: async () => { throw new Error('Timeout'); } });
    const res = await driveFetch(ctx.handlers, new Request('https://app.academiahelm.com/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` },
      body: JSON.stringify({ firstName: 'Lent' }),
    }));
    check('timeout → 504 (pas de faux succès)', res.handled && res.response.status === 504);
    check('timeout → AUCUNE mise en file (anti-doublon)', (idb.stores.outbox_events || []).length === 0);
    check('timeout → message explicite', /n'a PAS été mise en file/.test((await res.response.json()).message));
  }

  // ─── [11] File inaccessible → 503 honnête (pas de mensonge silencieux) ──
  console.log('\n[11] file IDB inaccessible → 503 honnête');
  {
    // Base SANS le store outbox_events (cas IDB indisponible/corrompue)
    const idb = makeMockIdb({ student: [] });
    const ctx = buildSwContext({ idb, cachesApi: makeMockCaches(), onLine: false, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    const res = await driveFetch(ctx.handlers, new Request('https://app.academiahelm.com/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${JWT_T1}` },
      body: JSON.stringify({ firstName: 'X' }),
    }));
    check('file perdue → 503 (pas de succès fabriqué)', res.handled && res.response.status === 503);
    check('file perdue → X-Sync-Status ABSENT', res.response.headers.get('X-Sync-Status') === null);
  }

  // ─── Résumé ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
  if (failed > 0) {
    console.log('ÉCHECS :');
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('SW v4.0.0 — interception réseau : TOUS LES TESTS PASSENT');
}

main().catch((e) => { console.error('ERREUR FATALE:', e); process.exit(1); });
