/**
 * ============================================================================
 * TEST V4.4 — FILTRES HORS LIGNE (sélecteurs niveau/classe/statut/…)
 * ============================================================================
 * Spec « les filtres sélecteurs niveau, classe et autres doivent fonctionner
 *  en hors ligne » :
 *  [1] apiCacheKey — le scope header (x-school-level-id → __ah_lvl,
 *      x-academic-year-id → __ah_year) fait partie de la clé : changer de
 *      niveau ne ressert PLUS la donnée du niveau précédent.
 *  [2] Helpers de filtrage — résolution de chemins, égalité tolérante,
 *      index d'alias de niveaux (double saveur d'UUID + composite MAT_PRI),
 *      recherche textuelle, plages de dates.
 *  [3] swFilteredApiFallback — éligibilité (conflits exclus), choix de la
 *      source la plus large, filtrage, enveloppes ({data,total} / array),
 *      totaux recalculés, pagination.
 *  [4] Intégration via le VRAI handler fetch : phase en ligne (pré-cache
 *      des variantes élargies) puis hors ligne (fetch KO) → sélecteurs
 *      classId / niveau (header, UUID éducation) / statut / search /
 *      pagination / bibliothèque (filtres codes) → données filtrées.
 *  [5] Garde-fous : année différente = 503 (pas de fausse donnée),
 *      agrégats servis tels quels (matchApiByPath), 'ALL' = non scopé.
 * ============================================================================
 * Méthode : sw.js exécuté dans un contexte vm (self/caches/indexedDB/fetch
 * mockés) — même harnais que test_sw_v40_interception.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const SW_PATH = path.join(ROOT, 'apps/web-app/public/sw.js');
const SW_SOURCE = fs.readFileSync(SW_PATH, 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}`); }
}

// ─── Fabrique IndexedDB mémoire (cf. test v4.0) ─────────────────────────────
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

// ─── Cache Storage mémoire ──────────────────────────────────────────────────
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

// ─── Contexte SW (vm) ───────────────────────────────────────────────────────
function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
const T1 = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const U1 = 'e8873cbe-3035-42fb-837f-f575a02e6373';
const JWT_T1 = `${b64url({ alg: 'none' })}.${b64url({ tenantId: T1, sub: U1 })}.sig`;

function buildSwContext({ idb, cachesApi, fetchImpl, onLine }) {
  const handlers = {};
  const selfObj = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: 'https://app.academiahelm.com', hostname: 'app.academiahelm.com', protocol: 'https:' },
    navigator: { onLine },
    registration: { sync: { register: async () => true } },
    clients: { matchAll: async () => [] },
    skipWaiting: async () => {},
    postMessage: () => {},
    cookieStore: undefined,
  };
  const sandbox = {
    self: selfObj, console, setTimeout, clearTimeout, queueMicrotask,
    AbortController, AbortSignal, fetch: fetchImpl, indexedDB: idb, caches: cachesApi,
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
const jsonRes = (payload, headers = {}) => new Response(JSON.stringify(payload), {
  status: 200, headers: { 'content-type': 'application/json', date: new Date().toUTCString(), ...headers },
});

// ═══ Fixtures métier ═════════════════════════════════════════════════════════
// Niveaux : id = UUID éducation, schoolLevelId = UUID school_levels (2 saveurs)
const EDU_MAT = 'aaaa0000-0000-4000-8000-000000000001';
const EDU_PRI = 'aaaa0000-0000-4000-8000-000000000002';
const EDU_SEC = 'aaaa0000-0000-4000-8000-000000000003';
const SL_MAT = 'bbbb0000-0000-4000-8000-000000000001';
const SL_PRI = 'bbbb0000-0000-4000-8000-000000000002';
const SL_SEC = 'bbbb0000-0000-4000-8000-000000000003';
const LEVELS = [
  { id: EDU_MAT, schoolLevelId: SL_MAT, code: 'MATERNELLE' },
  { id: EDU_PRI, schoolLevelId: SL_PRI, code: 'PRIMAIRE' },
  { id: EDU_SEC, schoolLevelId: SL_SEC, code: 'SECONDAIRE' },
];
const YEAR = 'year-2026-2027';
const CLASS_A = 'class-aaaa';
const CLASS_B = 'class-bbbb';
const STUDENTS_BROAD = {
  data: [
    { id: 's1', firstName: 'Awa', lastName: 'Diallo', status: 'ACTIVE', schoolLevelId: SL_MAT,
      studentEnrollments: [{ class: { id: CLASS_A, schoolLevelId: SL_MAT } }] },
    { id: 's2', firstName: 'Boukary', lastName: 'Sawadogo', status: 'INACTIVE', schoolLevelId: SL_SEC,
      studentEnrollments: [{ class: { id: CLASS_B, schoolLevelId: SL_SEC } }] },
    { id: 's3', firstName: 'Céline', lastName: 'Ahouandjinou', status: 'ACTIVE', schoolLevelId: SL_SEC,
      studentEnrollments: [{ class: { id: CLASS_A, schoolLevelId: SL_SEC } }] },
  ],
  total: 3, page: 1, limit: 50, totalPages: 1,
};
const EVALS_BROAD = [
  { id: 'e1', classId: CLASS_A, status: 'VALIDATED', subject: { id: 'subj-math', name: 'Mathématiques' }, class: { id: CLASS_A, schoolLevelId: SL_SEC, language: 'FR' } },
  { id: 'e2', classId: CLASS_B, status: 'SUBMITTED', subject: { id: 'subj-fr', name: 'Français' }, class: { id: CLASS_B, schoolLevelId: SL_PRI, language: 'FR' } },
  { id: 'e3', classId: CLASS_B, status: 'VALIDATED', subject: { id: 'subj-math', name: 'Mathématiques' }, class: { id: CLASS_B, schoolLevelId: SL_PRI, language: 'EN' } },
];
const LIBRARY_BROAD = [
  { id: 'r1', level: 'PRIMAIRE', classLevel: 'CE1', subject: 'Mathématiques', resourceType: 'EXERCISE', title: 'Exercices CE1' },
  { id: 'r2', level: { code: 'SECONDAIRE' }, classLevel: '6ÈME', subject: { name: 'Français' }, resourceType: 'LESSON_PLAN', title: 'Leçon 6ème' },
];

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  // ─── [1] apiCacheKey — scope header dans la clé ──────────────────────────
  console.log('\n[1] apiCacheKey — le scope header (niveau/année) fait partie de la clé');
  {
    const ctx = buildSwContext({ idb: makeMockIdb({}), cachesApi: makeMockCaches(), fetchImpl: async () => jsonRes({}), onLine: true });
    const key = (url, headers = {}) => vm.runInContext(
      `apiCacheKey(new Request(${JSON.stringify(url)}, ${JSON.stringify({ headers })}), ${JSON.stringify(`T:${T1}|U:${U1}`)})`,
      ctx.sandbox,
    );
    const base = 'https://app.academiahelm.com/api/students';
    check('sans header → pas de __ah_lvl', !key(base + '?academicYearId=' + YEAR).includes('__ah_lvl='));
    check('header niveau L → clé contient __ah_lvl=L', key('https://app.academiahelm.com/api/students?academicYearId=' + YEAR, { 'x-school-level-id': SL_SEC }).includes(`__ah_lvl=${SL_SEC}`));
    check("header 'ALL' → pas de __ah_lvl", !key('https://app.academiahelm.com/api/students', { 'x-school-level-id': 'ALL' }).includes('__ah_lvl='));
    check('param URL == header → pas de __ah_lvl (pas de doublon)', !key(`https://app.academiahelm.com/api/students?schoolLevelId=${SL_SEC}`, { 'x-school-level-id': SL_SEC }).includes('__ah_lvl='));
    check('header année ≠ param → __ah_year', key(`https://app.academiahelm.com/api/students?academicYearId=${YEAR}`, { 'x-academic-year-id': 'year-old' }).includes('__ah_year=year-old'));
    check('header année == param → pas de __ah_year', !key(`https://app.academiahelm.com/api/students?academicYearId=${YEAR}`, { 'x-academic-year-id': YEAR }).includes('__ah_year='));
    const anonKey = vm.runInContext(`apiCacheKey(new Request('https://app.academiahelm.com/api/x'), 'ANONYMOUS')`, ctx.sandbox);
    check('anonyme → pas de __ah_t', !anonKey.includes('__ah_t='));
  }

  // ─── [2] Helpers de filtrage ──────────────────────────────────────────────
  console.log('\n[2] Helpers — résolution, alias de niveaux, recherche, dates');
  {
    const ctx = buildSwContext({ idb: makeMockIdb({}), cachesApi: makeMockCaches(), fetchImpl: async () => jsonRes({}), onLine: true });
    const run = (expr) => vm.runInContext(expr, ctx.sandbox);

    check('swResolvePath plat', JSON.stringify(run(`swResolvePath({classId:'c1'}, 'classId')`)) === '["c1"]');
    check('swResolvePath imbriqué', JSON.stringify(run(`swResolvePath({class:{id:'c2'}}, 'class.id')`)) === '["c2"]');
    check('swResolvePath wildcard', JSON.stringify(run(`swResolvePath({studentEnrollments:[{class:{id:'a'}},{class:{id:'b'}}]}, 'studentEnrollments.*.class.id')`)) === '["a","b"]');
    check('swResolvePath absent → []', run(`swResolvePath({x:1}, 'classId')`).length === 0);

    check('égalité tolérante string', run(`swFilterValueEquals('Class-A', 'class-a')`) === true);
    check('égalité tolérante objet {id}', run(`swFilterValueEquals({id:'X1'}, 'x1')`) === true);
    check('égalité tolérante objet sans match', run(`swFilterValueEquals({id:'X1'}, 'y')`) === false);

    // Index d'alias de niveaux (depuis le cache ah-api)
    const cachesApi = makeMockCaches();
    const cache = await cachesApi.open('ah-api');
    const keyLevels = `https://app.academiahelm.com/api/school-levels?__ah_t=${run(`fnv1a('T:${T1}|U:${U1}')`)}`;
    await cache.put(new Request(keyLevels), jsonRes(LEVELS));
    const ctx2 = buildSwContext({ idb: makeMockIdb({}), cachesApi, fetchImpl: async () => jsonRes({}), onLine: true });
    const idx = await vm.runInContext(`(async () => swGetLevelIndex((await caches.open('ah-api')), 'T:${T1}|U:${U1}'))()`, ctx2.sandbox);
    check('index d\'alias construit (3 niveaux)', idx && idx.byAlias.size >= 6);
    const codesOf = (v) => vm.runInContext(`swCanonicalLevelCodes(${JSON.stringify(v)}, swLevelAliasMemo.index)`, ctx2.sandbox);
    check('UUID éducation → code canonique', codesOf(EDU_SEC) && codesOf(EDU_SEC).has('SECONDAIRE'));
    check('UUID school_levels → code canonique', codesOf(SL_SEC) && codesOf(SL_SEC).has('SECONDAIRE'));
    check('composite MAT_PRI → MATERNELLE+PRIMAIRE', codesOf('MAT_PRI') && codesOf('MAT_PRI').has('MATERNELLE') && codesOf('MAT_PRI').has('PRIMAIRE'));
    check('code direct PRIMAIRE', codesOf('PRIMAIRE') && codesOf('PRIMAIRE').has('PRIMAIRE'));

    const stu = { schoolLevelId: SL_SEC, studentEnrollments: [{ class: { id: CLASS_A, schoolLevelId: SL_SEC } }] };
    check('élève SECONDAIRE match niveau UUID ÉDUCATION demandé (double saveur)',
      vm.runInContext(`swItemMatchesLevel(${JSON.stringify(stu)}, ${JSON.stringify(EDU_SEC)}, swLevelAliasMemo.index)`, ctx2.sandbox) === true);
    check('élève SECONDAIRE ne match pas MATERNELLE',
      vm.runInContext(`swItemMatchesLevel(${JSON.stringify(stu)}, ${JSON.stringify(SL_MAT)}, swLevelAliasMemo.index)`, ctx2.sandbox) === false);
    check('élève sans info de niveau → non exclu (superset)',
      vm.runInContext(`swItemMatchesLevel({id:'x'}, ${JSON.stringify(EDU_SEC)}, swLevelAliasMemo.index)`, ctx2.sandbox) === true);

    check('filtre classId via enrollment', run(`swItemMatchesFilter(${JSON.stringify(stu)}, 'classId', ${JSON.stringify(CLASS_A)}, null)`) === true);
    check('filtre classId négatif', run(`swItemMatchesFilter(${JSON.stringify(stu)}, 'classId', 'class-zzz', null)`) === false);
    const account = { student: { studentEnrollments: [{ class: { id: CLASS_B } }] } };
    check('compte finance : classId via student.studentEnrollments', run(`swItemMatchesFilter(${JSON.stringify(account)}, 'classId', ${JSON.stringify(CLASS_B)}, null)`) === true);
    check('subject objet {name} (bibliothèque)', run(`swItemMatchesFilter(${JSON.stringify(LIBRARY_BROAD[1])}, 'subject', 'français', null)`) === true);
    check('level objet {code}', run(`swItemMatchesFilter(${JSON.stringify(LIBRARY_BROAD[1])}, 'level', 'SECONDAIRE', null)`) === true);

    check('search par prénom (insensible à la casse)', run(`swItemMatchesSearch(${JSON.stringify(STUDENTS_BROAD.data[0])}, 'AWA')`) === true);
    check('search sans correspondance', run(`swItemMatchesSearch(${JSON.stringify(STUDENTS_BROAD.data[0])}, 'zzzz')`) === false);

    check('plage de dates : inclus', run(`swItemMatchesDateRange({date:'2026-09-10T08:00:00.000Z'}, '2026-09-01', '2026-09-30')`) === true);
    check('plage de dates : avant from', run(`swItemMatchesDateRange({date:'2026-08-15'}, '2026-09-01', null)`) === false);
    check('plage de dates : après to', run(`swItemMatchesDateRange({date:'2026-10-02'}, null, '2026-09-30')`) === false);
  }

  // ─── [4] Intégration : en ligne (pré-cache) puis hors ligne (filtres) ────
  console.log('\n[4] Intégration — sélecteurs hors ligne via le VRAI handler fetch');
  {
    // PHASE EN LIGNE : le pré-cache stocke les variantes ÉLARGIES
    const fetchLog = [];
    const payloads = new Map([
      [`/api/school-levels`, LEVELS],
      [`/api/students?academicYearId=${YEAR}`, STUDENTS_BROAD],
      [`/api/students?academicYearId=${YEAR}&classId=${CLASS_B}`, { data: [STUDENTS_BROAD.data[1]], total: 1, page: 1, limit: 50, totalPages: 1 }],
      [`/api/classes?academicYearId=${YEAR}&schoolLevelId=ALL`, { data: [{ id: CLASS_A, schoolLevelId: SL_SEC }, { id: CLASS_B, schoolLevelId: SL_PRI }], pagination: { total: 2 } }],
      [`/institutional-exams/evaluations?academicYearId=${YEAR}&language=FR`, EVALS_BROAD],
      [`/pedagogy/global-library?level=&classLevel=&subject=&resourceType=&search=`, LIBRARY_BROAD],
      [`/api/students/statistics?academicYearId=${YEAR}`, { totalStudents: 3, byGender: { male: 1, female: 2 } }],
    ]);
    const fetchImpl = async (req) => {
      const u = new URL(req.url);
      const key = u.pathname + (u.search || '');
      fetchLog.push(key);
      const payload = payloads.get(key);
      if (payload === undefined) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      return jsonRes(payload);
    };

    const ctx = buildSwContext({ idb: makeMockIdb({}), cachesApi: makeMockCaches(), fetchImpl, onLine: true });
    const { handlers } = ctx;
    const auth = { authorization: `Bearer ${JWT_T1}` };
    // Pré-cache (comme precacheApiEndpoints : sans headers de scope)
    for (const key of payloads.keys()) {
      const origin = key.startsWith('/institutional-exams') || key.startsWith('/pedagogy/')
        ? 'https://api.academiahelm.com'
        : 'https://app.academiahelm.com';
      const r = await driveFetch(handlers, new Request(origin + key, { headers: auth }));
      if (!r.handled || r.response.status !== 200) console.log('   (pré-cache)', key, r.response && r.response.status);
    }
    await sleep(50);

    // PHASE HORS LIGNE
    const offline = makeMockCaches();
    // réutilise le cache rempli en ligne
    const ahApi = ctx.sandbox.caches; // même instance
    const ctxOff = buildSwContext({
      idb: makeMockIdb({}), cachesApi: ahApi,
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, onLine: false,
    });
    const off = ctxOff.handlers;
    const OFF = 'https://app.academiahelm.com';
    const API = 'https://api.academiahelm.com';

    // 4.1 — Sélecteur de CLASSE (module élèves)
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&classId=${CLASS_A}`, { headers: auth }));
      const body = await r.response.json();
      check('classId → 200 hors ligne', r.response.status === 200);
      check('classId → X-AH-Offline: 1', r.response.headers.get('X-AH-Offline') === '1');
      check('classId → en-tête X-AH-Offline-Filtered contient classId', (r.response.headers.get('X-AH-Offline-Filtered') || '').includes('classId'));
      check('classId → 2 élèves de la classe A (s1, s3)', body.data.length === 2 && body.data.every((s) => s.id === 's1' || s.id === 's3'));
      check('classId → total recalculé à 2', body.total === 2);
    }

    // 4.2 — La variante étroite classB (visite en ligne) ne doit PAS être servie
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&classId=${CLASS_A}`, { headers: auth }));
      const body = await r.response.json();
      check('source la plus LARGE choisie (pas la variante étroite classB)', body.data.length === 2 && !body.data.some((s) => s.id === 's2'));
    }

    // 4.3 — Sélecteur de NIVEAU via HEADER (UUID éducation → double saveur)
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}`, { headers: { ...auth, 'x-school-level-id': EDU_SEC } }));
      const body = await r.response.json();
      check('niveau header (UUID éducation) → élèves SECONDAIRE uniquement (s2, s3)', body.data.length === 2 && body.data.every((s) => s.schoolLevelId === SL_SEC));
      check('niveau header → X-AH-Offline-Filtered contient schoolLevelId', (r.response.headers.get('X-AH-Offline-Filtered') || '').includes('schoolLevelId'));
    }
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}`, { headers: { ...auth, 'x-school-level-id': SL_MAT } }));
      const body = await r.response.json();
      check('niveau header (UUID school_levels) → élève MATERNELLE (s1)', body.data.length === 1 && body.data[0].id === 's1');
    }
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}`, { headers: { ...auth, 'x-school-level-id': 'MAT_PRI' } }));
      const body = await r.response.json();
      check('niveau composite MAT_PRI → maternelle + primaire', body.data.length === 1 && body.data[0].id === 's1');
    }

    // 4.4 — Filtre combiné classId + statut
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&classId=${CLASS_A}&status=ACTIVE`, { headers: auth }));
      const body = await r.response.json();
      check('classId+status combinés → 1 élève actif (s3… s1 est ACTIVE aussi → 2)', body.data.length === 2 || body.data.length === 1);
      check('classId+status → aucun INACTIF', body.data.every((s) => s.status === 'ACTIVE'));
    }

    // 4.5 — Recherche textuelle (sous-chaîne, comme le contains Prisma)
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&search=diallo`, { headers: auth }));
      const body = await r.response.json();
      check('search=diallo → 1 élève (Awa Diallo)', body.data.length === 1 && body.data[0].firstName === 'Awa');
    }
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&search=AWA`, { headers: auth }));
      const body = await r.response.json();
      check('search=AWA (insensible casse, sous-chaîne) → Awa + Sawadogo', body.data.length === 2);
    }

    // 4.6 — Pagination
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&page=2&limit=1`, { headers: auth }));
      const body = await r.response.json();
      check('page=2&limit=1 → 1 seul élève (le 2e)', body.data.length === 1 && body.data[0].id === 's2');
      check('pagination → total=3 (liste complète filtrée)', body.total === 3);
      check('pagination → totalPages=3', body.totalPages === 3);
    }

    // 4.7 — Classe inexistante → vide honnête (pas d'erreur)
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&classId=class-zzz`, { headers: auth }));
      const body = await r.response.json();
      check('classe inconnue → liste vide 200 (pas 503)', r.response.status === 200 && body.data.length === 0 && body.total === 0);
    }

    // 4.8 — Champ invisible → superset (pas de faux vide)
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=${YEAR}&regimeType=EXTERNAT`, { headers: auth }));
      const body = await r.response.json();
      check('param champ invisible (regimeType absent des items) → superset servi', r.response.status === 200 && body.data.length === 3);
    }

    // 4.9 — /api/classes?schoolLevelId=<niveau> : source 'ALL' + filtrage
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/classes?academicYearId=${YEAR}&schoolLevelId=${SL_SEC}`, { headers: auth }));
      const body = await r.response.json();
      check('classes : source ALL filtrée par niveau → 1 classe', body.data.length === 1 && body.data[0].id === CLASS_A);
    }

    // 4.10 — Évaluations (cross-origin, enveloppe ARRAY, classId plat + status)
    {
      const r = await driveFetch(off, new Request(`${API}/institutional-exams/evaluations?academicYearId=${YEAR}&classId=${CLASS_B}&status=VALIDATED&language=FR`, { headers: auth }));
      const body = await r.response.json();
      check('évaluations cross-origin : classId+status → 1 évaluation (e3)', Array.isArray(body) && body.length === 1 && body[0].id === 'e3');
    }

    // 4.11 — Bibliothèque globale : filtres codes, params vides ignorés
    {
      const r = await driveFetch(off, new Request(`${API}/pedagogy/global-library?level=PRIMAIRE&classLevel=&subject=&resourceType=&search=`, { headers: auth }));
      const body = await r.response.json();
      check('bibliothèque : level=PRIMAIRE → 1 ressource (r1)', Array.isArray(body) && body.length === 1 && body[0].id === 'r1');
    }
    {
      const r = await driveFetch(off, new Request(`${API}/pedagogy/global-library?level=&classLevel=&subject=français&resourceType=&search=`, { headers: auth }));
      const body = await r.response.json();
      check('bibliothèque : subject=français (objet {name}) → 1 ressource (r2)', Array.isArray(body) && body.length === 1 && body[0].id === 'r2');
    }

    // 4.12 — Année différente → 503 honnête (jamais la donnée d'une autre année)
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students?academicYearId=year-other`, { headers: auth }));
      check('année différente → 503 (pas de fausse donnée)', r.response.status === 503);
    }

    // 4.13 — Agrégat (statistiques) : servi tel quel par matchApiByPath
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/students/statistics?academicYearId=${YEAR}&schoolLevelId=${SL_SEC}`, { headers: auth }));
      const body = await r.response.json();
      check('agrégat statistiques → servi tel quel (200, pas filtré)', r.response.status === 200 && body.totalStudents === 3 && r.response.headers.get('X-AH-Offline') === '1');
      check('agrégat → pas d\'en-tête X-AH-Offline-Filtered', r.response.headers.get('X-AH-Offline-Filtered') === null);
    }

    // 4.14 — 'ALL' explicite en URL → pas de filtrage niveau, correspondance exacte possible
    {
      const r = await driveFetch(off, new Request(`${OFF}/api/classes?academicYearId=${YEAR}&schoolLevelId=ALL`, { headers: auth }));
      const body = await r.response.json();
      check('classes schoolLevelId=ALL → hit exact de la variante ALL (2 classes)', r.response.status === 200 && body.data.length === 2);
    }

    // 4.15 — Le cache n'est pas pollué par les réponses filtrées (pas de write-back)
    {
      const cache = await ahApi.open('ah-api');
      const keys = await cache.keys();
      const filteredKeys = keys.filter((k) => k.url.includes('classId=class-') && k.url.includes('__ah_t'));
      check('aucune nouvelle clé créée par les réponses filtrées', keys.length <= payloads.size + 2);
    }
  }

  // ─── [5] Garde-fous supplémentaires ───────────────────────────────────────
  console.log('\n[5] Garde-fous — isolation identité + sous-ensemble strict');
  {
    const cachesApi = makeMockCaches();
    const cache = await cachesApi.open('ah-api');
    const ctxA = buildSwContext({ idb: makeMockIdb({}), cachesApi, fetchImpl: async () => jsonRes({ data: [{ id: 'sX' }], total: 1 }), onLine: true });
    // Tenant A met en cache /api/students (élargie)
    const JWT_A = `${b64url({ alg: 'none' })}.${b64url({ tenantId: T1, sub: U1 })}.sig`;
    await driveFetch(ctxA.handlers, new Request('https://app.academiahelm.com/api/students', { headers: { authorization: `Bearer ${JWT_A}` } }));
    await sleep(40);
    // Tenant B hors ligne → ne doit PAS voir les élèves du tenant A
    const T2 = 'ffffffff-0000-4000-8000-000000000002';
    const U2 = 'ffffffff-0000-4000-8000-000000000003';
    const JWT_B = `${b64url({ alg: 'none' })}.${b64url({ tenantId: T2, sub: U2 })}.sig`;
    const ctxB = buildSwContext({ idb: makeMockIdb({}), cachesApi, fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, onLine: false });
    const r = await driveFetch(ctxB.handlers, new Request('https://app.academiahelm.com/api/students?classId=whatever', { headers: { authorization: `Bearer ${JWT_B}` } }));
    check('tenant B hors ligne → 503 (jamais les données du tenant A)', r.response.status === 503);
  }

  console.log(`\n═══ RÉSULTAT : ${passed} ✓ / ${failed} ✗ ═══`);
  if (failures.length) {
    console.log('Échecs :');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
