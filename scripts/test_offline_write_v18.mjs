/**
 * ============================================================================
 * TEST V18/V19 — Écritures hors ligne + chargement années scolaires au login
 * ============================================================================
 * 1. mergePendingEntities : création/modif hors ligne VISIBLE en lecture
 *    (tableau + réponse paginée), _deleted retiré, anti-fuite cross-tenant ;
 * 2. offlineMutationFallback : create → store+outbox+metadata.request ;
 *    PUT → upsert ; URL d'action /{uuid}/archive → UPDATE + status ARCHIVED ;
 *    response_cache famille invalidée ;
 * 3. pushOutbox replay HTTP : 2xx → synced + dirty cleared ; 4xx → FAILED ;
 *    réseau KO → reste PENDING ;
 * 4. fetchAcademicYearsSnapshot : erreurs propagées (≠ [] figé) + snapshot
 *    localStorage pour affichage instantané au login.
 * ============================================================================
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const require_ = createRequire(import.meta.url);
const ROOT = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-v18-test-'));
// esbuild réside dans le node_modules de apps/web-app
const { build } = require_(path.join(ROOT, 'apps/web-app/node_modules/esbuild'));

// ─── État global partagé avec les modules mockés ──────────────────────────
globalThis.__MOCK_IDB__ = { stores: {} };
globalThis.__MOCK_OUTBOX__ = { events: [] };
globalThis.__MOCK_ONLINE__ = true;
globalThis.__MOCK_LOG__ = [];

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
globalThis.localStorage = localStorageMock;

// fetch mock contrôlé
const realFetch = globalThis.fetch;
globalThis.__MOCK_FETCH__ = async () => new Response('{}', { status: 200 });
globalThis.fetch = (...args) => globalThis.__MOCK_FETCH__(...args);

const localDb = {
  async query(store) { return [...(globalThis.__MOCK_IDB__.stores[store] || [])]; },
  async execute(store, op, value) {
    const state = globalThis.__MOCK_IDB__;
    state.stores[store] = state.stores[store] || [];
    const items = state.stores[store];
    if (op === 'put') {
      const key = value.cacheKey || value.id;
      const idx = items.findIndex((e) => (e.cacheKey || e.id) === key);
      if (idx >= 0) items[idx] = value; else items.push(value);
    } else if (op === 'delete') {
      // value EST la clé (string) pour delete
      state.stores[store] = items.filter((e) => (e.cacheKey || e.id) !== value);
    }
    return value;
  },
  async executeBulk(store, op, items) { for (const it of items) await localDb.execute(store, op, it); },
  async getByKey(store, key) {
    return (globalThis.__MOCK_IDB__.stores[store] || []).find((e) => (e.cacheKey || e.id) === key) || null;
  },
};

// ─── Mocks sur disque (esbuild alias) ──────────────────────────────────────
function writeMockFile(name, source) {
  const p = path.join(TMP, `mock_${name}.mjs`);
  fs.writeFileSync(p, source);
  return p;
}

const MOCKS = {
  localdb: writeMockFile('localdb', `
    const localDb = globalThis.__MOCK_LOCALDB__;
    export { localDb };
  `),
  network: writeMockFile('network', `
    export const networkDetectionService = {
      isConnected: () => globalThis.__MOCK_ONLINE__,
      onNetworkStatusChange: () => {},
    };
  `),
  outbox: writeMockFile('outbox', `
    const state = globalThis.__MOCK_OUTBOX__;
    export const outboxService = {
      async createEvent(tenantId, operation, entityType, entityId, payload, metadata) {
        const ev = {
          id: 'ev-' + (state.events.length + 1),
          tenantId, operation, entityType, entityId,
          payload: JSON.parse(JSON.stringify(payload ?? {})),
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
          status: 'PENDING', attemptCount: 0,
          createdAt: new Date().toISOString(),
        };
        state.events.push(ev);
        return ev.id;
      },
      async getPendingEvents(tenantId, limit) {
        return state.events.filter((e) => e.tenantId === tenantId && e.status === 'PENDING').slice(0, limit);
      },
      async markAsSynced(id) { const ev = state.events.find((e) => e.id === id); if (ev) ev.status = 'ACKNOWLEDGED'; },
      async markAsFailed(id, error) { const ev = state.events.find((e) => e.id === id); if (ev) { ev.status = 'FAILED'; ev.errorMessage = error; } },
      async markAsConflict(id) { const ev = state.events.find((e) => e.id === id); if (ev) ev.status = 'CONFLICT'; },
      async markAsSyncing(id) { const ev = state.events.find((e) => e.id === id); if (ev) ev.status = 'SENT'; },
      async getPendingCount() { return state.events.filter((e) => e.status === 'PENDING').length; },
    };
  `),
  offlinesync: writeMockFile('offlinesync', `
    export const offlineSyncService = { sync: async () => ({ ok: true }), bootstrap: async () => true };
  `),
  restrictions: writeMockFile('restrictions', `
    export const offlineRestrictionsService = { isOperationAllowedOffline: () => ({ allowed: true }) };
  `),
  accesstoken: writeMockFile('accesstoken', `
    export const getClientAuthorizationHeader = () => ({});
    export const tryRefreshAccessToken = async () => false;
    export const clearClientSessionSync = () => {};
  `),
  window: writeMockFile('window', `
    export {};
  `),
};
globalThis.__MOCK_LOCALDB__ = localDb;

const ALIAS = {};

// Mock par CHEMIN SOURCE RÉSOLU (les imports relatifs './local-db.service'
// bypassent l'alias) — plugin esbuild qui redirige vers les fichiers mock.
const MOCK_TARGETS = {
  'apps/web-app/src/lib/offline/local-db.service.ts': MOCKS.localdb,
  'apps/web-app/src/lib/offline/network-detection.service.ts': MOCKS.network,
  'apps/web-app/src/lib/offline/outbox.service.ts': MOCKS.outbox,
  'apps/web-app/src/lib/offline/offline-sync.service.ts': MOCKS.offlinesync,
  'apps/web-app/src/lib/offline/offline-restrictions.service.ts': MOCKS.restrictions,
  'apps/web-app/src/lib/auth/client-access-token.ts': MOCKS.accesstoken,
};

function mockPlugin() {
  return {
    name: 'path-mocks',
    setup(b) {
      b.onResolve({ filter: /^\.\/?/ }, (args) => {
        const resolved = path.resolve(args.resolveDir, args.path);
        const rel = path.relative(ROOT, resolved);
        if (MOCK_TARGETS[rel] || MOCK_TARGETS[rel + '.ts']) {
          return { path: MOCK_TARGETS[rel] || MOCK_TARGETS[rel + '.ts'], namespace: 'file' };
        }
        if (rel.startsWith('apps/web-app/src/') && !resolved.endsWith('.ts')) {
          return { path: resolved + '.ts', namespace: 'file' };
        }
        return undefined;
      });
    },
  };
}

async function transpile(relPath) {
  const inPath = path.join(ROOT, relPath);
  const outPath = path.join(TMP, relPath.replace(/[^a-z0-9]/gi, '_') + '.mjs');
  await build({
    entryPoints: [inPath],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: outPath,
    alias: ALIAS,
    plugins: [mockPlugin()],
    define: { 'process.env.NODE_ENV': '"test"' },
    loader: { '.ts': 'ts' },
    banner: {
      js: `
      // mocks runtime fournis par le harnais de test
      if (typeof window === 'undefined' || !window.__MOCKED__) {
        globalThis.window = {
          __MOCKED__: true,
          dispatchEvent: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          setInterval: () => 0,
          clearInterval: () => {},
          setTimeout: (fn, ms) => setTimeout(fn, ms),
          clearTimeout: (id) => clearTimeout(id),
          location: { origin: 'http://localhost', host: 'localhost:3000', pathname: '/app' },
          navigator: globalThis.navigator,
        };
      }
      if (typeof document === 'undefined' || !document.__MOCKED__) {
        globalThis.document = { __MOCKED__: true, cookie: 'x-tenant-id=t1' };
      }
      globalThis.fetch = (...a) => globalThis.__MOCK_FETCH__(...a);
      `,
    },
  });
  return outPath;
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const idb = () => globalThis.__MOCK_IDB__.stores;
const outboxEvents = () => globalThis.__MOCK_OUTBOX__.events;

// ─── 1. Merge entités en attente (lecture offline) ────────────────────────
async function testMergePending() {
  console.log('\n[1] mergePendingEntities — lecture offline avec écritures en attente');
  globalThis.__MOCK_ONLINE__ = false;
  globalThis.__MOCK_FETCH__ = async () => { throw new TypeError('Failed to fetch'); };

  idb()['response_cache'] = [];
  idb()['student'] = [];
  await localDb.execute('response_cache', 'put', {
    cacheKey: 'T:t1|GET|/api/students?academicYearId=ay1',
    tenantId: 't1',
    url: '/api/students?academicYearId=ay1',
    data: { data: [{ id: 's1', firstName: 'Ancien', lastName: 'A', status: 'ACTIVE', tenantId: 't1' }], total: 1, page: 1 },
    cachedAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });
  await localDb.execute('student', 'put', { id: 's-new', firstName: 'Nouveau', lastName: 'HorsLigne', status: 'ACTIVE', tenantId: 't1', _isDirty: true, _deleted: false, _version: 1 });
  await localDb.execute('student', 'put', { id: 's1', firstName: 'Modifié', lastName: 'A', status: 'ACTIVE', tenantId: 't1', _isDirty: true, _deleted: false, _version: 2 });
  await localDb.execute('student', 'put', { id: 's-del', firstName: 'Supprimé', lastName: 'X', status: 'ACTIVE', tenantId: 't1', _isDirty: true, _deleted: true, _version: 2 });
  await localDb.execute('student', 'put', { id: 's-other', firstName: 'Autre', lastName: 'Ecole', status: 'ACTIVE', tenantId: 't2', _isDirty: true, _deleted: false, _version: 1 });

  const mod = await import(await transpile('apps/web-app/src/lib/offline/offline-fetch.ts'));
  const result = await mod.offlineFetch('/api/students?academicYearId=ay1', 'student', { tenantId: 't1' });
  const list = result?.data ?? result;
  check('réponse paginée servie depuis response_cache', Array.isArray(list));
  check('création hors ligne visible dans la liste (badge PENDING)', list.some((s) => s.id === 's-new' && s.lastName === 'HorsLigne'));
  check('modification locale prioritaire sur la copie serveur', list.some((s) => s.id === 's1' && s.firstName === 'Modifié'));
  check('champs internes _ absents de l\'affichage', list.every((s) => !Object.keys(s).some((k) => k.startsWith('_'))));
  check('anti-fuite cross-tenant (dirty t2 exclu)', !list.some((s) => s.id === 's-other'));
  check('total recalé (+1 création)', result?.total === 2);

  // Suppression locale retirée d'une copie serveur (tableau brut)
  await localDb.execute('response_cache', 'put', {
    cacheKey: 'T:t1|GET|/api/students?academicYearId=ay1&status=ALL',
    tenantId: 't1',
    url: '/api/students?academicYearId=ay1&status=ALL',
    data: [
      { id: 's-del', firstName: 'Supprimé', tenantId: 't1' },
      { id: 's1', firstName: 'X', tenantId: 't1' },
    ],
    cachedAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });
  const arr = await mod.offlineFetch('/api/students?academicYearId=ay1&status=ALL', 'student', { tenantId: 't1' });
  check('_deleted retiré de la liste servie (tableau brut)', Array.isArray(arr) && !arr.some((s) => s.id === 's-del'));
  check('tableau brut fusionné avec la modif dirty', Array.isArray(arr) && arr.some((s) => s.id === 's1' && s.firstName === 'Modifié'));

  // cacheResponse V18 : réponse paginée alimente le store entités
  globalThis.__MOCK_ONLINE__ = true;
  globalThis.__MOCK_FETCH__ = async () => new Response(JSON.stringify({
    data: [{ id: 'srv1', firstName: 'Serveur', tenantId: 't1' }, { noId: true }], total: 1,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  idb()['student'] = [];
  await mod.offlineFetch('/api/students?academicYearId=ay9', 'student', { tenantId: 't1' });
  await new Promise((r) => setTimeout(r, 50)); // cacheResponse est .catch-async
  check('cacheResponse V18 : réponse paginée alimente le store entités (ids)', (idb()['student'] || []).some((s) => s.id === 'srv1'));
  check('cacheResponse V18 : items sans id sautés sans erreur', !(idb()['student'] || []).some((s) => s.noId));
  return mod;
}

// ─── 2. Fallback mutation : create / update / action / invalidation ───────
async function testMutationFallback() {
  console.log('\n[2] offlineMutationFallback — écriture locale + outbox + metadata.request');
  globalThis.__MOCK_ONLINE__ = false;
  globalThis.__MOCK_FETCH__ = async () => { throw new TypeError('Failed to fetch'); };

  const mod = await import(await transpile('apps/web-app/src/lib/offline/offline-fetch.ts'));

  // (a) Création
  outboxEvents().length = 0;
  idb()['student'] = [];
  const created = await mod.offlineMutation('/api/students', 'POST', {
    firstName: 'Test', lastName: 'Offline', academicYearId: 'ay1', schoolLevelId: 'sl1',
  }, { tenantId: 't1' });
  check('création offline : offline=true (en attente de synchronisation)', created.offline === true);
  check('création offline : entité écrite dans le store student (_isDirty)', (idb()['student'] || []).some((s) => s.firstName === 'Test' && s._isDirty === true));
  check('création offline : événement outbox PENDING', outboxEvents().filter((e) => e.status === 'PENDING' && e.entityType === 'STUDENT').length === 1);
  check('création offline : metadata.request pour replay', outboxEvents()[0]?.metadata?.request?.url === '/api/students' && outboxEvents()[0]?.metadata?.request?.method === 'POST');

  // (b) PUT d'une entité ABSENTE du store → upsert V18
  const updated = await mod.offlineMutation('/api/students/22222222-2222-4222-8222-222222222222', 'PUT', {
    id: '22222222-2222-4222-8222-222222222222', firstName: 'Editée', lastName: 'SansCache', status: 'ACTIVE',
  }, { tenantId: 't1' });
  check('update offline : offline=true', updated.offline === true);
  check('update offline : UPSERT de l\'entité absente (V18)', (idb()['student'] || []).some((s) => s.id === '22222222-2222-4222-8222-222222222222' && s.firstName === 'Editée' && s._isDirty === true));

  // (c) URL d'action archive → UPDATE + ARCHIVED, pas de corruption
  await localDb.execute('student', 'put', { id: '11111111-1111-4111-8111-111111111111', firstName: 'Modifié', lastName: 'A', status: 'ACTIVE', tenantId: 't1' });
  const archived = await mod.offlineMutation('/api/students/11111111-1111-4111-8111-111111111111/archive', 'POST', { reason: 'Test' }, { tenantId: 't1' });
  check('archive offline : offline=true', archived.offline === true);
  const s1 = (idb()['student'] || []).find((s) => s.id === '11111111-1111-4111-8111-111111111111');
  check('archive offline : status ARCHIVED appliqué localement', s1?.status === 'ARCHIVED');
  check('archive offline : champs préservés (pas de corruption par fausse création)', s1?.firstName === 'Modifié' && s1?.lastName === 'A');
  const archiveEvent = outboxEvents().find((e) => e.entityId === '11111111-1111-4111-8111-111111111111' && String(e.metadata?.request?.url || '').includes('/archive'));
  check('archive offline : outbox porte l\'URL d\'action pour replay', Boolean(archiveEvent));

  // (d) response_cache famille invalidée après écriture offline
  check('response_cache famille /api/students invalidé après écriture', !(idb()['response_cache'] || []).some((e) => String(e.url || '').startsWith('/api/students')));
}

// ─── 3. Replay HTTP à la reconnexion (pushOutbox) ─────────────────────────
async function testReplay() {
  console.log('\n[3] pushOutbox — replay HTTP des requêtes d\'origine');
  globalThis.__MOCK_ONLINE__ = true;

  outboxEvents().length = 0;
  idb()['student'] = [];
  await localDb.execute('student', 'put', { id: 's-new', firstName: 'Nouveau', lastName: 'HorsLigne', tenantId: 't1', _isDirty: true, _version: 1 });
  outboxEvents().push({
    id: 'ev-replay-1', tenantId: 't1', entityType: 'STUDENT', entityId: 's-new',
    operation: 'CREATE',
    payload: { id: 's-new', firstName: 'Nouveau', tenantId: 't1' },
    metadata: { request: { url: '/api/students', method: 'POST', body: { firstName: 'Nouveau' } } },
    status: 'PENDING', attemptCount: 0, createdAt: new Date().toISOString(),
  });

  const syncMod = await import(await transpile('apps/web-app/src/lib/offline/sync-engine.service.ts'));

  // (a) 2xx → synced + dirty cleared + réponse serveur écrite
  let sawInternalHeader = false;
  globalThis.__MOCK_FETCH__ = async (url, init) => {
    const h = init?.headers || {};
    const has = (h['X-Offline-Internal'] === 'true') || (h instanceof Headers && h.get('X-Offline-Internal') === 'true');
    if (String(url).includes('/api/students')) sawInternalHeader = has;
    return new Response(JSON.stringify({ id: 's-new', firstName: 'Nouveau', lastName: 'HorsLigne', matricule: 'MAT-001' }), { status: 200 });
  };
  const res1 = await syncMod.pushOutbox('t1');
  check('replay : header X-Offline-Internal posé (bypass intercepteur)', sawInternalHeader);
  check('replay 2xx : compté comme pushed', res1.pushed >= 1);
  check('replay 2xx : événement ACKNOWLEDGED', outboxEvents()[0].status === 'ACKNOWLEDGED');
  const sNew = (idb()['student'] || []).find((s) => s.id === 's-new');
  check('replay 2xx : _isDirty nettoyé + réponse serveur (matricule) écrite', sNew?._isDirty === false && sNew?.matricule === 'MAT-001');

  // (b) 4xx → FAILED avec message serveur
  outboxEvents().length = 0;
  outboxEvents().push({
    id: 'ev-replay-2', tenantId: 't1', entityType: 'STUDENT', entityId: 's-x',
    operation: 'CREATE', payload: { id: 's-x' },
    metadata: { request: { url: '/api/students', method: 'POST', body: { bad: true } } },
    status: 'PENDING', attemptCount: 0, createdAt: new Date().toISOString(),
  });
  globalThis.__MOCK_FETCH__ = async () => new Response(JSON.stringify({ message: 'Validation refusée : champ requis' }), { status: 400 });
  await syncMod.pushOutbox('t1');
  check('replay 4xx : événement FAILED avec message serveur', outboxEvents()[0].status === 'FAILED' && String(outboxEvents()[0].errorMessage || '').includes('Validation refusée'));

  // (c) Réseau KO → reste PENDING
  outboxEvents().length = 0;
  outboxEvents().push({
    id: 'ev-replay-3', tenantId: 't1', entityType: 'STUDENT', entityId: 's-y',
    operation: 'UPDATE', payload: { id: 's-y' },
    metadata: { request: { url: '/api/students/s-y', method: 'PUT', body: { firstName: 'Y' } } },
    status: 'PENDING', attemptCount: 0, createdAt: new Date().toISOString(),
  });
  globalThis.__MOCK_FETCH__ = async () => { throw new TypeError('Failed to fetch'); };
  const res3 = await syncMod.pushOutbox('t1');
  check('replay réseau KO : événement RESTE PENDING', outboxEvents()[0].status === 'PENDING');
  check('replay réseau KO : pas compté comme erreur', res3.errors === 0 && res3.pushed === 0);

  // (d) Événements SANS metadata.request → toujours le batch générique
  outboxEvents().length = 0;
  outboxEvents().push({
    id: 'ev-legacy', tenantId: 't1', entityType: 'TEACHER', entityId: 't-1',
    operation: 'UPDATE', payload: { id: 't-1' }, status: 'PENDING', attemptCount: 0,
    createdAt: new Date().toISOString(),
  });
  let sawGenericPush = false;
  globalThis.__MOCK_FETCH__ = async (url) => {
    if (String(url).includes('/api/sync/push')) {
      sawGenericPush = true;
      return new Response(JSON.stringify({
        successful_operations: 1, conflicted_operations: 0, failed_operations: 0, results: [],
      }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
  await syncMod.pushOutbox('t1');
  check('événement legacy sans request → batch générique /api/sync/push', sawGenericPush);
}

// ─── 4. Années scolaires : erreurs propagées + snapshot login instantané ──
async function testYearsSnapshot() {
  console.log('\n[4] fetchAcademicYearsSnapshot — robustesse login');
  localStorageMock.clear();
  globalThis.__MOCK_FETCH__ = async (url) => {
    const u = String(url);
    if (u.includes('/api/settings/academic-years?')) {
      return new Response(JSON.stringify([{ id: 'ay1', name: '2026-2027', isCurrent: true }]), { status: 200 });
    }
    if (u.includes('/api/settings/academic-years/active')) {
      return new Response(JSON.stringify({ id: 'ay1', name: '2026-2027', isCurrent: true }), { status: 200 });
    }
    throw new TypeError('Failed to fetch');
  };

  const mod = await import(await transpile('apps/web-app/src/lib/query/academic-years-fetch.ts'));
  const years = await mod.fetchAcademicYearsSnapshot('t1');
  check('succès : liste + active fusionnées', years.length >= 1 && years[0].id === 'ay1' && years[0].isCurrent === true);
  const snap = mod.readAcademicYearsSnapshot('t1');
  check('snapshot localStorage persisté (affichage instantané au login)', Array.isArray(snap) && snap.length >= 1);

  globalThis.__MOCK_FETCH__ = async () => { throw new TypeError('Failed to fetch'); };
  let threw = false;
  try { await mod.fetchAcademicYearsSnapshot('t1'); } catch { threw = true; }
  check('échec réseau : erreur PROPAGÉE (≠ [] figé « Aucune année scolaire »)', threw);
  check('snapshot toujours lisible après échec réseau', (mod.readAcademicYearsSnapshot('t1') || []).length >= 1);

  globalThis.__MOCK_FETCH__ = async () => new Response('{}', { status: 401 });
  threw = false;
  try { await mod.fetchAcademicYearsSnapshot(undefined); } catch { threw = true; }
  check('no-tenant + 401 : erreur propagée (retry React Query)', threw);

  // Niveaux scolaires : snapshot + propagation
  localStorageMock.clear();
  globalThis.__MOCK_FETCH__ = async () => new Response(JSON.stringify([
    { id: 'l1', code: 'PRIMARY', label: 'Primaire', isActive: true },
    { id: 'l2', code: 'SECONDAIRE', label: 'Secondaire', isActive: true },
  ]), { status: 200 });
  const levelsMod = await import(await transpile('apps/web-app/src/lib/query/use-school-levels.ts'));
  // utiliser la fonction interne via import du module transpilé
  const levels = await levelsMod.fetchSchoolLevels?.();
  check('niveaux : fetch ok', Array.isArray(levels) && levels.length === 2);
  const levelsSnap = levelsMod.readSchoolLevelsSnapshot?.();
  check('niveaux : snapshot localStorage persisté', Array.isArray(levelsSnap) && levelsSnap.length === 2);
  globalThis.__MOCK_FETCH__ = async () => new Response('{}', { status: 500 });
  let threwLevels = false;
  try { await levelsMod.fetchSchoolLevels?.(); } catch { threwLevels = true; }
  check('niveaux : erreur 500 propagée (≠ [] silencieux)', threwLevels);
}

// ─── RUN ───────────────────────────────────────────────────────────────────

// ─── 5. Input Request (axios fetch-adapter « request-mode ») ─────────────
async function testRequestInstanceInput() {
  console.log('\n[5] intercepteur — input Request (axios fetch-adapter)');
  globalThis.__MOCK_ONLINE__ = false;
  globalThis.__MOCK_FETCH__ = async () => { throw new TypeError('Failed to fetch'); };

  // Transpiler l'intercepteur avec les modules mockés
  const mod = await import(await transpile('apps/web-app/src/lib/offline/global-fetch-interceptor.ts'));

  // Patch window.fetch comme le fait layout-client
  const original = globalThis.fetch;
  const fakeWindow = globalThis.window;
  // ⭐ L'intercepteur patche window.fetch — dans un navigateur window EST
  //    l'espace global : on l'alias pour que le patch s'applique réellement.
  globalThis.window = globalThis;
  try {
    mod.installGlobalFetchInterceptor();
    check('intercepteur installé (window.fetch patché)', typeof globalThis.fetch === 'function' && globalThis.fetch !== original);

    // (a) GET via Request-instance → lu depuis le cache offline
    idb()['response_cache'] = [];
    idb()['shopproduct'] = [];
    await localDb.execute('response_cache', 'put', {
      cacheKey: 'T:t1|GET|/api/shop/products',
      tenantId: 't1', url: '/api/shop/products',
      data: [{ id: 'p1', name: 'Cahier', price: 500, tenantId: 't1' }],
      cachedAt: Date.now(), expiresAt: Date.now() + 60000,
    });
    const getRequest = new Request('http://localhost/api/shop/products', { method: 'GET' });
    const getResponse = await globalThis.fetch(getRequest, {});
    const getData = await getResponse.json();
    check('GET via Request : données servies du cache offline', Array.isArray(getData) && getData[0]?.name === 'Cahier');

    // (b) POST via Request-instance (axios request-mode) → outbox + store
    outboxEvents().length = 0;
    const postRequest = new Request('http://localhost/api/shop/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stylo', price: 250 }),
    });
    const postResponse = await globalThis.fetch(postRequest, {});
    check('POST via Request : 200 synthétique (offline queued)', postResponse.ok === true);
    const prodEvent = outboxEvents().find((e) => e.entityType === 'SHOP_PRODUCT' && e.status === 'PENDING');
    check('POST via Request : événement outbox SHOP_PRODUCT avec metadata.request', Boolean(prodEvent?.metadata?.request?.url?.includes('/api/shop/products')));
    const localProduct = (idb()['shopproduct'] || []).find((p) => p.name === 'Stylo');
    check('POST via Request : produit écrit localement (_isDirty)', Boolean(localProduct?._isDirty));
  } finally {
    globalThis.fetch = original;
    globalThis.window = fakeWindow;
  }
}

async function main() {
  try {
    await testMergePending();
    await testMutationFallback();
    await testReplay();
    await testYearsSnapshot();
    await testRequestInstanceInput();
  } finally {
    globalThis.fetch = realFetch;
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  }
  console.log(`\n═══ RÉSULTAT : ${pass} ✓ / ${fail} ✗ ═══`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Test crash:', e);
  process.exit(1);
});
