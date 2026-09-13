/**
 * ============================================================================
 * TEST V4.1 — Offline exhaustif (sous-onglets + modales) + readiness visible
 * ============================================================================
 * Exigences testées (sept. 2026) :
 *  [1] COUVERTURE — buildApiPrecacheUrls contient les endpoints des modales
 *      et de leurs sélecteurs (audit exhaustif) : caisses ouvertes, absences,
 *      cahiers de textes, séries, taux CNSS/fiscal, modèles de contrats,
 *      sceaux/signatures/cartes élèves, bibliothèque/transport/infirmerie/QHSE.
 *  [2] PRIORITÉ — §0 « référentiels critiques des modales » en TÊTE du
 *      tableau (l'utilisateur qui coupe à ~1 min peut déjà créer).
 *  [3] GATING — enseignant/parent ne téléchargent pas les endpoints staff.
 *  [4] VAGUE 2 — comptes élèves par élève (modale paiement), chaînes CDD,
 *      validateurs/EDT/séries par niveau.
 *  [5] READINESS STORE — marks → phases → progression 0..1 → readyAt.
 *  [6] SW — PRECACHE_API émet PRECACHE_API_PROGRESS par batch de 6 (l'indicateur
 *      utilisateur avance en direct).
 * Méthode : service transpilé (esbuild bundle CJS) + globals mockés ; sw.js
 * exécuté en vm (même harnais que test_sw_v40_interception.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ROOT = process.cwd();
const WEB = path.join(ROOT, 'apps/web-app');

let passed = 0;
let failed = 0;
const failures = [];
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}`); }
}

const YEAR = 'year-2026';
const LEVEL = 'level-3eme';
const T1 = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const U1 = 'e8873cbe-3035-42fb-837f-f575a02e6373';

// ═══ 1. Transpilation du service (bundle CJS, offline-readiness inclus) ════
const OUT = '/tmp/v41-test';
execSync(`npx esbuild src/lib/offline/module-precache.service.ts --bundle --format=cjs --platform=node --external:@/lib/* --outfile=${OUT}/mp.cjs`, { cwd: WEB, stdio: 'pipe' });

// Globals mockés AVANT require
const lsMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: (k) => lsMap.delete(k),
};
const domEvents = [];
globalThis.CustomEvent = class {
  constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
};
globalThis.window = {
  dispatchEvent: (e) => domEvents.push(e),
  addEventListener: () => {},
  removeEventListener: () => {},
};
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, serviceWorker: { addEventListener: () => {}, ready: Promise.resolve({ active: { postMessage: () => {} } }) } },
  configurable: true,
});

const svc = require(`${OUT}/mp.cjs`);

// ═══ Contextes de session ══════════════════════════════════════════════════
lsMap.set('currentAcademicYearId', YEAR);
lsMap.set('currentSchoolLevelId', LEVEL);
lsMap.set('session', JSON.stringify({ tenantId: T1, user: { id: U1, role: 'SUPER_DIRECTOR', tenantId: T1 }, portalType: 'SCHOOL' }));

const ctxStaff = { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SUPER_DIRECTOR' };
const ctxTeacher = { tenantId: T1, userId: U1, teacherId: 'teacher-1', portalType: 'TEACHER', role: 'TEACHER' };
const ctxParent = { tenantId: T1, userId: U1, portalType: 'PARENT', role: 'PARENT' };
const API = 'https://api.academiahelm.com';

// ═══ [1] Couverture vague 1 ════════════════════════════════════════════════
console.log('\n[1] Couverture — endpoints des modales + sélecteurs (STAFF + finance + RH)');
let urls;
{
  urls = svc.buildApiPrecacheUrls(API, ctxStaff);
  const has = (u) => urls.includes(u);
  check('caisse ouverte (NewPaymentModal)', has('/api/finance/cash-registers?isActive=true&isOpen=true'));
  check('caisse active (EditPaymentModal)', has('/api/finance/cash-registers?isActive=true'));
  check('personnel ADMIN (responsable caisse)', has('/api/hr/staff?category=ADMIN'));
  check('personnel SUPPORT (responsable caisse)', has('/api/hr/staff?category=SUPPORT'));
  check('absences (modale justification)', has(`/api/absences?academicYearId=${YEAR}`) && has('/api/absences'));
  check('cahiers de textes (formulaire)', has(`/api/class-diaries?academicYearId=${YEAR}`));
  check('séries d\'éducation (changement de série)', has('/api/education-series'));
  check('observations direction (contrôle pédagogie)', has(`/api/pedagogy/monthly-plans/director-observations?academicYearId=${YEAR}`));
  check('aperçu clôture du jour (trésorerie)', has(`/api/finance/treasury/daily-closures/preview?academicYearId=${YEAR}&date=${new Date().toISOString().slice(0, 10)}`));
  check('modèles de contrats (éditeur RH)', has('/api/hr/contracts/templates/list'));
  check('taux CNSS actifs', has('/api/hr/cnss/rates/active'));
  check('taux fiscaux (wizard embauche)', has('/api/hr/payroll/fiscal-rates?countryCode=BJ'));
  check('sceaux administratifs (paramètres)', has('/api/settings/administrative-seals'));
  check('signatures électroniques', has('/api/settings/electronic-signatures'));
  check('réglages cartes élèves', has('/api/settings/identity/card-settings'));
  check('tenants disponibles', has('/api/auth/available-tenants'));
  check('classes académiques sans année (inscription)', has('/api/academic-classes?isActive=true'));
  check('affectations admin actives (bulletins)', has('/api/staff-admin-assignments?isActive=true'));
  check('comptes élèves exportAll (POS boutique)', has(`/api/finance/student-accounts?academicYearId=${YEAR}&exportAll=true`));
  // Modules complémentaires — les 4 modules manquants + ressources oubliées
  check('bibliothèque : livres + emprunts + réservations', has(`${API}/modules-complementaires/library/books?academicYearId=${YEAR}`) && has(`${API}/modules-complementaires/library/loans?academicYearId=${YEAR}`) && has(`${API}/modules-complementaires/library/reservations?academicYearId=${YEAR}`));
  check('bibliothèque : ressources numériques + recommandations', has(`${API}/modules-complementaires/library/digital-resources?academicYearId=${YEAR}`) && has(`${API}/modules-complementaires/library/recommendations?academicYearId=${YEAR}`));
  check('transport : routes/véhicules/conducteurs/affectations', [`${API}/modules-complementaires/transport/routes`, `${API}/modules-complementaires/transport/vehicles`, `${API}/modules-complementaires/transport/drivers`, `${API}/modules-complementaires/transport/assignments`].every((u) => has(`${u}?academicYearId=${YEAR}`)));
  check('transport : incidents + paiements', [`${API}/modules-complementaires/transport/incidents`, `${API}/modules-complementaires/transport/payments`].every((u) => has(`${u}?academicYearId=${YEAR}`)));
  check('infirmerie : visites/checkups/urgences/autorisations/stock/vigilance', ['visits', 'checkups', 'emergencies', 'authorizations', 'stock', 'vigilance'].every((r) => has(`${API}/modules-complementaires/infirmary/${r}?academicYearId=${YEAR}`)));
  check('QHSE : 10 ressources (documents→health)', ['documents', 'action-plans', 'audits', 'risks', 'alerts', 'incidents', 'hygiene', 'compliance', 'security', 'health'].every((r) => has(`${API}/modules-complementaires/qhse/${r}?academicYearId=${YEAR}`)));
  check('cantine : élèves (source des modales)', has(`${API}/modules-complementaires/canteen/students?academicYearId=${YEAR}`));
  check('shop : retraits (pickups)', has(`${API}/modules-complementaires/shop/pickups?academicYearId=${YEAR}`));
  check('variantes à filtre (maintenance véhicules, audits périodiques)', has(`${API}/modules-complementaires/transport/vehicles?academicYearId=${YEAR}&maintenance=true`) && has(`${API}/modules-complementaires/qhse/audits?academicYearId=${YEAR}&type=periodic`));
  check('sélecteur matière évaluation (axios backend direct)', has(`${API}/subjects?academicYearId=${YEAR}&schoolLevelId=${LEVEL}&language=FR`));
  check('directeurs RH (concepteur de tampon)', has(`${API}/hr/school-directors`));
  check('pas de doublon (Set)', new Set(urls).size === urls.length);
  check('volume raisonnable (>= 250, <= 400)', urls.length >= 250 && urls.length <= 400);
}

// ═══ [2] Priorité §0 en tête ═══════════════════════════════════════════════
console.log('\n[2] Priorité — référentiels critiques des modales EN TÊTE (coupure à ~1 min)');
{
  const first20 = urls.slice(0, 20);
  check('all-classes = 1re URL', first20[0] === '/api/all-classes');
  check('school-levels dans les 5 premières', first20.indexOf('/api/school-levels') > 0 && first20.indexOf('/api/school-levels') < 5);
  check('périodes de l\'année dans les 6 premières', first20.includes(`/api/settings/academic-years/${YEAR}/periods`));
  check('caisses ouvertes dans les 20 premières', first20.includes('/api/finance/cash-registers?isActive=true&isOpen=true'));
  check('comptes élèves exportAll dans les 20 premières', first20.includes(`/api/finance/student-accounts?academicYearId=${YEAR}&exportAll=true`));
  check('élèves par année dans les 20 premières', first20.includes(`/api/students?academicYearId=${YEAR}`));
  check('personnel ADMIN dans les 20 premières', first20.includes('/api/hr/staff?category=ADMIN'));
  const idxCritique = urls.indexOf('/api/finance/cash-registers?isActive=true&isOpen=true');
  const idxTardif = urls.indexOf(`/api/tenant-website/news`);
  check('les critiques précèdent le CMS (§14)', idxCritique > 0 && idxTardif > idxCritique);
}

// ═══ [3] Gating par rôle ═══════════════════════════════════════════════════
console.log('\n[3] Gating — enseignant / parent');
{
  const teacherUrls = svc.buildApiPrecacheUrls(API, ctxTeacher);
  check('enseignant : PAS de caisses finance', !teacherUrls.some((u) => u.includes('cash-registers')));
  check('enseignant : PAS de comptes élèves', !teacherUrls.some((u) => u.includes('student-accounts')));
  check('enseignant : PAS de personnel', !teacherUrls.some((u) => u.startsWith('/api/hr/staff')));
  check('enseignant : les référentiels transverses restent (périodes)', teacherUrls.includes(`/api/settings/academic-years/${YEAR}/periods`));
  check('enseignant : mes classes', teacherUrls.some((u) => u.includes('/api/pedagogy-space/my-classes')));
  const parentUrls = svc.buildApiPrecacheUrls(API, ctxParent);
  check('parent : enfants', parentUrls.includes(`/api/parent/children?academicYearId=${YEAR}`));
  check('parent : PAS de §0 staff', !parentUrls.includes('/api/hr/staff?category=ADMIN'));
}

// ═══ [4] Vague 2 dynamique ═════════════════════════════════════════════════
console.log('\n[4] Vague 2 — comptes élèves par élève, CDD, par niveau');
{
  const fetchRouter = async (url) => {
    const u = String(url);
    if (u.includes('/api/finance/student-accounts')) {
      return { data: [{ studentId: 'stu-1' }, { studentId: 'stu-2' }, { studentId: 'stu-3' }] };
    }
    if (u.includes('/api/hr/staff')) {
      return { data: [{ id: 'rh-1' }, { id: 'rh-2' }] };
    }
    if (u.includes('/api/school-levels')) {
      return { data: [{ id: 'lv-1', code: '3EME' }, { id: 'lv-2', code: '6EME' }] };
    }
    if (u.includes('/api/timetables')) return { data: [] };
    if (u.includes('/api/academic-years')) return { data: [{ id: YEAR, isActive: true }] };
    return { data: [] };
  };
  globalThis.fetch = async (url) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => fetchRouter(url) });
  const dyn = await svc.buildDynamicPrecacheUrls(API, ctxStaff, { Authorization: 'Bearer x' });
  const has = (frag) => dyn.some((u) => u.includes(frag));
  check('compte élève stu-1 pré-caché (modale paiement)', has(`/api/finance/student-accounts/student/stu-1?academicYearId=${YEAR}`));
  check('compte élève stu-3 pré-caché', has(`/api/finance/student-accounts/student/stu-3?academicYearId=${YEAR}`));
  check('chaîne CDD rh-1 (renouvellement contrat)', has('/api/hr/contracts/staff/rh-1/cdd-chain'));
  check('validateur par niveau (fiche pédagogique)', has('/api/hr/school-directors/by-level?schoolLevelId=lv-1&language=FR'));
  check('enseignants EDT par niveau', has('/api/timetable-engine/teachers?schoolLevelId=lv-2'));
  check('séries par niveau', has('/api/education-series?levelId=lv-1'));
  // Enseignant : PAS les familles finance/RH
  const dynT = await svc.buildDynamicPrecacheUrls(API, ctxTeacher, {});
  check('enseignant : vague 2 sans comptes élèves', !dynT.some((u) => u.includes('student-accounts/student/')));
  check('enseignant : vague 2 sans CDD', !dynT.some((u) => u.includes('cdd-chain')));
}

// ═══ [5] Store readiness (offline-readiness.ts, transpilé à part) ══════════
console.log('\n[5] Store readiness — phases + progression');
{
  lsMap.delete('academia_helm_offline_ready_at');
  const rdy = svc; // ré-exporté par module-precache.service → même instance
  let s = rdy.getOfflineReadiness();
  check('état initial : idle', s.phase === 'idle');
  rdy.markRoutesProgress(30, 120);
  s = rdy.getOfflineReadiness();
  check('routes 30/120 → preparing + 6,25 %', s.phase === 'preparing' && Math.abs(s.progress - 0.0625) < 0.001);
  rdy.markWaveProgress(1, 0, 300);
  rdy.markWaveProgress(1, 150, 300);
  s = rdy.getOfflineReadiness();
  check('vague 1 150/300 → +25 %', Math.abs(s.progress - (0.0625 + 0.25)) < 0.001);
  rdy.markWaveProgress(2, 30, 60);
  s = rdy.getOfflineReadiness();
  check('vague 2 30/60 → +12,5 %', Math.abs(s.progress - (0.0625 + 0.25 + 0.125)) < 0.001);
  rdy.markRunFinished(true, true);
  s = rdy.getOfflineReadiness();
  check('fin des 2 segments → ready + readyAt + 100 %', s.phase === 'ready' && s.readyAt > 0 && s.progress === 1);
  check('readyAt persisté (localStorage)', lsMap.get('academia_helm_offline_ready_at') === String(s.readyAt));
  rdy.markRunFinished(false, false);
  s = rdy.getOfflineReadiness();
  check('échec → incomplete (retry au retour réseau)', s.phase === 'incomplete');
  rdy.resetOfflineReadiness();
  s = rdy.getOfflineReadiness();
  check('reset → idle (SW_ACTIVATED)', s.phase === 'idle' && s.progress === 0);
  rdy.markInitialReady();
  s = rdy.getOfflineReadiness();
  check('initial ready (flags < 24 h) — silencieux', s.phase === 'ready');
  check('évaluation initiale (service) : flags frais → ready', (() => {
    lsMap.set('academia_helm_modules_precached_at', String(Date.now()));
    lsMap.set('academia_helm_api_precached_at', String(Date.now()));
    rdy.resetOfflineReadiness();
    svc.evaluateOfflineReadinessInitial();
    return rdy.getOfflineReadiness().phase === 'ready';
  })());
  // Les événements DOM de progression sont throttlés (400 ms) → flush
  await new Promise((r) => setTimeout(r, 600));
  const evts = domEvents.filter((e) => e.type === 'offline-readiness-change');
  check('événements DOM diffusés (phases + progression)', evts.length >= 4);
}

// ═══ [6] SW — PRECACHE_API_PROGRESS par batch ══════════════════════════════
console.log('\n[6] SW — progression du pré-cache API par batch de 6');
{
  const SW_SOURCE = fs.readFileSync(path.join(WEB, 'public/sw.js'), 'utf8');
  const cachesMap = new Map();
  const cachesApi = {
    open: async () => ({
      match: async () => undefined,
      put: async () => {},
      keys: async () => [],
    }),
    keys: async () => [...cachesMap.keys()],
    delete: async () => true,
  };
  const handlers = {};
  const selfObj = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: 'https://app.academiahelm.com', hostname: 'app.academiahelm.com', protocol: 'https:' },
    navigator: { onLine: true },
    registration: { sync: { register: async () => true } },
    clients: { matchAll: async () => [] },
    skipWaiting: async () => {},
  };
  const sandbox = {
    self: selfObj, console, setTimeout, clearTimeout, queueMicrotask,
    AbortController, AbortSignal,
    fetch: async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    indexedDB: { open: () => ({ onsuccess: null, onerror: null }) },
    caches: cachesApi, URL, URLSearchParams, Request, Response, Headers,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    TextEncoder, TextDecoder,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox, { filename: 'sw.js' });

  const posted = [];
  const client = { postMessage: (m) => posted.push(m) };
  const urls = Array.from({ length: 13 }, (_, i) => `/api/fixture/${i}`);
  const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const JWT = `${b64url({ alg: 'none' })}.${b64url({ tenantId: T1, sub: U1 })}.sig`;
  let waitP = null;
  await handlers.message({
    data: { type: 'PRECACHE_API', urls, headers: { authorization: `Bearer ${JWT}`, 'x-tenant-id': T1 } },
    source: client,
    waitUntil: (p) => { waitP = p; },
  });
  await waitP;
  const progress = posted.filter((m) => m.type === 'PRECACHE_API_PROGRESS');
  const result = posted.filter((m) => m.type === 'PRECACHE_API_RESULT');
  check('3 messages de progression (13 URLs / batch 6)', progress.length === 3);
  check('progression : 6 → 12 → 13', progress.map((m) => m.done).join(',') === '6,12,13');
  check('total transmis dans chaque message', progress.every((m) => m.total === 13));
  check('ACK final PRECACHE_API_RESULT présent', result.length === 1 && result[0].total === 13);
  check('ACK final : 13 cachés (okCount)', result[0].okCount === 13);
}

// ═══ BILAN ═════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(56));
if (failed > 0) {
  console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log(`RÉSULTAT : ${passed} ✓ / ${failed} ✗`);
console.log('v4.1.0 — offline exhaustif + readiness visible : TOUS LES TESTS PASSENT');
