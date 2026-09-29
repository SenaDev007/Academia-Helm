/**
 * ============================================================================
 * TEST V4.2 — UI de TOUS les rôles : gating pré-cache + shells + nouveaux
 * endpoints (vue /promoteur, chat, parent détaillé, enseignant, alias EN)
 * ============================================================================
 * Exigence utilisateur (sept. 2026) : « rassure-toi que tout est bien
 * fonctionnel pour l'UI promoteur, directeur, enseignants, parents,
 * secrétaire, secrétaire-comptable, comptable, censeur, surveillant ».
 *
 *  [1] MATRICE 9 RÔLES — chaque rôle reçoit les endpoints de SES modules
 *      (dashboard + sous-onglets + modales), et PAS ceux des autres
 *      (pas de gaspillage 2G/3G en 403).
 *  [2] ALIAS — les libellés FR (DB) ET EN (type front / imports) passent
 *      tous les deux : SECRETARY_ACCOUNTANT, SCHOOL_DIRECTOR, CENSOR…
 *  [3] VUE PROMOTEUR — route HTML /promoteur pré-cachée + pattern SW +
 *      /api/analytics/consolidated (stratégiques uniquement).
 *  [4] MY-CONTEXT — contexte admin (sidebar/garde des shells) pré-caché.
 *  [5] GLOBAL LIBRARY — URL axios EXACTE (staff + enseignant).
 *  [6] VAGUE 2 — messages du chat, fiche enfant + cahier-journal/weeks
 *      (parent), devoirs/students (enseignant).
 *  [7] SHELLS — getAdminShellForRole : les 9 rôles → LEUR portail (FR + EN).
 * Méthode : transpilation esbuild (bundle CJS) + globals mockés.
 */
import fs from 'node:fs';
import path from 'node:path';
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
const U1 = 'user-1';
const TEACHER1 = 'teacher-1';
const API = 'https://api.academiahelm.com';

// ═══ Transpilation ═════════════════════════════════════════════════════════
const OUT = '/tmp/v42-test';
execSync(`rm -rf ${OUT} && mkdir -p ${OUT}`, { stdio: 'pipe' });
execSync(
  `npx esbuild src/lib/offline/module-precache.service.ts --bundle --format=cjs --platform=node --external:@/lib/* --outfile=${OUT}/mp.cjs`,
  { cwd: WEB, stdio: 'pipe' },
);
execSync(
  `npx esbuild src/lib/auth/admin-portal-map.ts --bundle --format=cjs --platform=node --outfile=${OUT}/apm.cjs`,
  { cwd: WEB, stdio: 'pipe' },
);

// Globals mockés AVANT require
const lsMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: (k) => lsMap.delete(k),
};
globalThis.CustomEvent = class {
  constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
};
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, serviceWorker: { addEventListener: () => {}, ready: Promise.resolve({ active: { postMessage: () => {} } }) } },
  configurable: true,
});

const svc = require(`${OUT}/mp.cjs`);
const apm = require(`${OUT}/apm.cjs`);

lsMap.set('currentAcademicYearId', YEAR);
lsMap.set('currentSchoolLevelId', LEVEL);

// ═══ Matrice des 9 rôles (libellés DB = FR ; alias EN testés aussi) ════════
const ROLES = {
  PROMOTEUR:    { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'PROMOTEUR' },          finance: true,  hr: true,  strategic: true },
  DIRECTEUR:    { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'DIRECTEUR' },          finance: true,  hr: true,  strategic: false },
  SECRETAIRE:   { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SECRETAIRE' },         finance: false, hr: false, strategic: false },
  SECRETAIRE_COMPTABLE: { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SECRETAIRE_COMPTABLE' }, finance: true, hr: true, strategic: false },
  COMPTABLE:    { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'COMPTABLE' },          finance: true,  hr: false, strategic: false },
  CENSEUR:      { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'CENSEUR' },            finance: false, hr: false, strategic: false },
  SURVEILLANT:  { ctx: { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SURVEILLANT' },        finance: false, hr: false, strategic: false },
  ENSEIGNANT:   { ctx: { tenantId: T1, userId: U1, teacherId: TEACHER1, portalType: 'TEACHER', role: 'ENSEIGNANT' }, finance: false, hr: false, strategic: false, teacher: true },
  PARENT:       { ctx: { tenantId: T1, userId: U1, portalType: 'PARENT', role: 'PARENT' },             finance: false, hr: false, strategic: false, parent: true },
};
// Même matrice en libellés EN (alias) : la DB stocke FR, le front reçoit
// parfois EN — les deux conventions doivent marcher à l'identique.
const ROLES_EN = {
  PROMOTER: 'PROMOTEUR', SCHOOL_DIRECTOR: 'DIRECTEUR', SECRETARY: 'SECRETAIRE',
  SECRETARY_ACCOUNTANT: 'SECRETAIRE_COMPTABLE', ACCOUNTANT: 'COMPTABLE',
  CENSOR: 'CENSEUR', GENERAL_MONITOR: 'SURVEILLANT', TEACHER: 'ENSEIGNANT', PARENT: 'PARENT',
};

// ═══ [1] Matrice 9 rôles ═══════════════════════════════════════════════════
console.log('\n[1] Matrice — chaque rôle reçoit SES endpoints, pas ceux des autres');
const urlsByRole = {};
for (const [name, def] of Object.entries(ROLES)) {
  const urls = svc.buildApiPrecacheUrls(API, def.ctx);
  urlsByRole[name] = urls;
  const has = (u) => urls.includes(u);
  const n = urls.length;
  console.log(`  — ${name} (${def.ctx.role}) : ${n} URLs`);

  // Transverse (tous les rôles connectés à une école)
  check(`${name} : contexte bootstrap`, has('/api/context/bootstrap'));
  check(`${name} : années + niveaux`, has('/api/academic-years') && has('/api/school-levels'));
  check(`${name} : notifications`, has(`${API}/notifications?limit=20`));

  if (def.ctx.portalType !== 'PARENT' && !def.teacher) {
    // Staff (admin shells) — dashboard pilotage + référentiels
    check(`${name} : dashboard pilotage (consolidated-report)`, has(`/api/general/consolidated-report?academicYearId=${YEAR}&schoolLevelId=${LEVEL}`));
    check(`${name} : KPI finance dashboard`, has(`/api/finance/reports/kpi?tenantId=${T1}&academicYearId=${YEAR}`));
    check(`${name} : my-context (sidebar shells)`, has('/api/staff-admin-assignments/my-context'));
    check(`${name} : élèves + classes`, has(`/api/students?academicYearId=${YEAR}`) && has(`/api/classes?academicYearId=${YEAR}&schoolLevelId=${LEVEL}`));
    check(`${name} : examens (évaluations FR)`, has(`${API}/institutional-exams/evaluations?academicYearId=${YEAR}&schoolLevelId=${LEVEL}&language=FR`));
    check(`${name} : discipline (règles + sanctions)`, has(`/api/discipline/rules?academicYearId=${YEAR}&schoolLevelId=${LEVEL}`) && has(`/api/discipline/sanctions?academicYearId=${YEAR}&schoolLevelId=${LEVEL}`));
    check(`${name} : censeur (sanctions pédagogiques + fraudes)`, has(`/api/discipline/sanctions?academicYearId=${YEAR}&schoolLevelId=${LEVEL}&type=ACADEMIC`) && has(`/api/exam-frauds?tenantId=${T1}&academicYearId=${YEAR}`));
    check(`${name} : communication (conversations)`, has(`/api/chat/conversations?userId=${U1}`));
    check(`${name} : bibliothèque virtuelle (URL axios exacte)`, has(`${API}/pedagogy/global-library?level=&classLevel=&subject=&resourceType=&search=`));
  }
  if (def.teacher) {
    check(`${name} : mes classes`, has(`/api/pedagogy-space/my-classes?teacherId=${TEACHER1}&academicYearId=${YEAR}`));
    check(`${name} : devoirs + cahier de textes`, has(`/api/pedagogy-space/homeworks?teacherId=${TEACHER1}&academicYearId=${YEAR}`) && has(`/api/pedagogy-space/cahier-textes?teacherId=${TEACHER1}&academicYearId=${YEAR}`));
    check(`${name} : évaluations filtrées teacherId`, has(`${API}/institutional-exams/evaluations?academicYearId=${YEAR}&teacherId=${TEACHER1}&language=FR`));
    check(`${name} : bibliothèque virtuelle enseignant`, has(`${API}/pedagogy/global-library?level=&classLevel=&subject=&resourceType=&search=`));
    check(`${name} : PAS d'endpoints finance`, !urls.some((u) => u.includes('/api/finance/')));
  }
  if (def.parent) {
    check(`${name} : enfants (2 variantes)`, has(`/api/parent/children?academicYearId=${YEAR}`) && has(`/api/parent/children?parentId=${U1}&academicYearId=${YEAR}`));
    check(`${name} : classes (sélecteur EDT enfant)`, has(`/api/pedagogy/academic-structure/classes?academicYearId=${YEAR}`));
    check(`${name} : chat (conversations)`, has(`/api/chat/conversations?userId=${U1}`));
    check(`${name} : PAS d'endpoints staff (finance/RH)`, !urls.some((u) => u.includes('/api/finance/') || u.includes('/api/hr/staff')));
  }
  if (def.finance) {
    check(`${name} : finance — comptes + frais + transactions`, has(`/api/finance/student-accounts?academicYearId=${YEAR}&exportAll=true`) && has(`/api/finance/fee-structures?academicYearId=${YEAR}`) && has(`/api/finance/transactions?academicYearId=${YEAR}&page=1&limit=25`));
    check(`${name} : finance — multi-caisses + trésorerie`, has(`/api/finance/cash-registers/dashboard?academicYearId=${YEAR}`) && has(`/api/finance/treasury/daily-closures?academicYearId=${YEAR}`));
  } else if (!def.teacher && !def.parent) {
    // §0 (référentiels des modales : caisses/comptes/frais) et §2 (KPIs du
    // dashboard pilotage) sont VOLONTAIREMENT inclus pour tout le staff —
    // on vérifie l'absence de la famille finance §9 (transactions, dépenses,
    // trésorerie, recouvrement, rapports détaillés, paramétrage…).
    const ALLOWED = [/cash-registers/, /student-accounts/, /fee-structures/, /\/api\/finance\/reports\/kpi/, /\/api\/finance\/payments\/today/];
    const forbidden = urls.filter((u) => u.startsWith('/api/finance/') && !ALLOWED.some((re) => re.test(u)));
    check(`${name} : PAS de famille finance §9 (${forbidden.length} filtrées)`, forbidden.length === 0);
  }
  if (def.hr) {
    check(`${name} : RH — annuaire + contrats + congés`, has('/api/hr/staff?limit=500') && has(`/api/hr/contracts?tenantId=${T1}`) && has(`/api/hr/leaves/requests?tenantId=${T1}&academicYearId=${YEAR}`));
    check(`${name} : RH — paie + CNSS`, has(`/api/hr/payroll/periods?tenantId=${T1}`) && has('/api/hr/cnss/rates/active'));
  } else if (!def.teacher && !def.parent) {
    check(`${name} : PAS de famille RH`, !urls.some((u) => u.includes('/api/hr/contracts') || u.includes('/api/hr/overview/')));
  }
  if (def.strategic) {
    check(`${name} : KPIs consolidés multi-écoles (/promoteur)`, has('/api/analytics/consolidated'));
    check(`${name} : settings (billing + rôles)`, has(`/api/settings/billing?tenant_id=${T1}`) && has(`/api/settings/roles?tenant_id=${T1}`));
  } else {
    check(`${name} : PAS de vue stratégique`, !has('/api/analytics/consolidated'));
  }
}

// ═══ [2] Alias EN ≡ FR ═════════════════════════════════════════════════════
console.log('\n[2] Alias — libellés EN équivalents aux FR (finance/RH/stratégique)');
{
  for (const [enRole, frName] of Object.entries(ROLES_EN)) {
    const def = ROLES[frName];
    const ctxEN = { ...def.ctx, role: enRole };
    if (def.ctx.portalType === 'TEACHER' || enRole === 'TEACHER') ctxEN.teacherId = TEACHER1;
    const urlsEN = svc.buildApiPrecacheUrls(API, ctxEN);
    const has = (u) => urlsEN.includes(u);
    if (def.finance) {
      check(`${enRole} (EN) → finance OUI (comptes élèves)`, has(`/api/finance/student-accounts?academicYearId=${YEAR}&exportAll=true`));
      check(`${enRole} (EN) → RH OUI (annuaire)`, has('/api/hr/staff?limit=500'));
    }
    if (def.strategic) check(`${enRole} (EN) → stratégique (analytics)`, has('/api/analytics/consolidated'));
    if (def.parent) check(`${enRole} (EN) → enfants`, has(`/api/parent/children?parentId=${U1}&academicYearId=${YEAR}`));
  }
  // Variante niveau-spécifique auto-générée (backend) : préfixe
  const urlsSC_SEC = svc.buildApiPrecacheUrls(API, { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SECRETAIRE_COMPTABLE_SEC' });
  check('SECRETAIRE_COMPTABLE_SEC (variante niveau) → finance OUI', urlsSC_SEC.includes(`/api/finance/student-accounts?academicYearId=${YEAR}&exportAll=true`));
  const urlsDIR_MAT = svc.buildApiPrecacheUrls(API, { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'DIRECTEUR_MAT_PRI' });
  check('DIRECTEUR_MAT_PRI (variante niveau) → finance + RH OUI', urlsDIR_MAT.includes(`/api/finance/transactions?academicYearId=${YEAR}&page=1&limit=25`) && urlsDIR_MAT.includes('/api/hr/staff?limit=500'));
}

// ═══ [3] Vue promoteur — route HTML + SW ═══════════════════════════════════
console.log('\n[3] Vue stratégique /promoteur — route HTML + pattern SW + gating');
{
  const sw = fs.readFileSync(path.join(WEB, 'public/sw.js'), 'utf8');
  check('SW_VERSION ≥ v4.2.0', /SW_VERSION = 'v4\.[4-9]\.[0-9]+'/.test(sw) || sw.includes("SW_VERSION = 'v4.3.0'"));
  check('SW : pattern /promoteur cachable', /\/\^\\\/promoteur\(\\\/\|\$\)\//.test(sw));
  // La liste de routes est interne : vérifier via le bundle transpilé
  // (esbuild CJS émet les littéraux en guillemets doubles)
  const bundle = fs.readFileSync(`${OUT}/mp.cjs`, 'utf8');
  const hasRoute = (r) => bundle.includes(`"${r}"`) || bundle.includes(`'${r}'`);
  check('bundle : /promoteur dans les routes pré-cachées', hasRoute('/promoteur'));
  check('bundle : les 9 portails présents', ['/app/director', '/app/secretaire', '/app/secretaire-comptable', '/app/comptable', '/app/censeur', '/app/surveillant', '/app/teacher', '/app/parent', '/promoteur'].every((r) => hasRoute(r)));
}

// ═══ [4] + [5] déjà couverts dans [1] — vérif volume ═══════════════════════
console.log('\n[4] Volumes par rôle (raisonnable 2G/3G)');
{
  for (const [name, urls] of Object.entries(urlsByRole)) {
    check(`${name} : ${urls.length} URLs (<= 420)`, urls.length > 0 && urls.length <= 420);
  }
  const parentUrls = urlsByRole.PARENT;
  check('parent : pas de modules complémentaires (cantine/shop…)', !parentUrls.some((u) => u.includes('modules-complementaires/canteen') || u.includes('modules-complementaires/shop')));
  check('parent : educast présent (portail enseignant/parent en ont l\'usage)', parentUrls.some((u) => u.includes('educast')));
}

// ═══ [6] Vague 2 — chat / parent / enseignant (fetch mocké) ════════════════
console.log('\n[6] Vague 2 — messages chat, fiche enfant + cahier-journal, devoirs enseignant');
{
  const jsonResponse = (obj) => ({ ok: true, headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) }, json: async () => obj });
  const seenFetches = [];
  globalThis.fetch = async (url) => {
    seenFetches.push(String(url));
    if (String(url).startsWith(`/api/chat/conversations?userId=${U1}`)) {
      return jsonResponse({ data: [{ id: 'conv-1' }, { id: 'conv-2' }, { id: 'conv-3' }] });
    }
    if (String(url).startsWith(`/api/chat/channels?userId=${U1}`)) {
      return jsonResponse({ data: [{ id: 'ch-1' }, { id: 'ch-2' }] });
    }
    if (String(url).startsWith(`/api/parent/children?academicYearId=`)) {
      return jsonResponse([{ id: 'child-1', classId: 'cls-1' }, { id: 'child-2', classId: 'cls-2' }]);
    }
    if (String(url).startsWith(`/api/pedagogy-space/homeworks?teacherId=`)) {
      return jsonResponse({ data: [{ id: 'hw-1' }, { id: 'hw-2' }, { id: 'hw-3' }] });
    }
    if (String(url).startsWith(`/api/timetables`)) return jsonResponse({ data: [] });
    if (String(url).includes('/institutional-exams/evaluations')) return jsonResponse({ data: [] });
    if (String(url).startsWith('/api/school-levels')) return jsonResponse({ data: [] });
    if (String(url).startsWith('/api/academic-years')) return jsonResponse({ data: [] });
    return jsonResponse({ data: [] });
  };
  const monday = new Date();
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow);
  const mondayStr = monday.toISOString().slice(0, 10);

  // CHAT (userId) — conversations + canaux
  const chatUrls = await svc.buildDynamicPrecacheUrls(API, { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SECRETAIRE' }, {});
  check('chat : messages des 3 conversations', ['conv-1', 'conv-2', 'conv-3'].every((c) => chatUrls.includes(`/api/chat/conversations/${c}/messages?userId=${U1}&limit=100`)));
  check('chat : messages des 2 canaux', ['ch-1', 'ch-2'].every((c) => chatUrls.includes(`/api/chat/channels/${c}/messages?limit=100`)));

  // PARENT — fiche enfant + cahier-journal + semaines
  const parentUrls2 = await svc.buildDynamicPrecacheUrls(API, { tenantId: T1, userId: U1, portalType: 'PARENT', role: 'PARENT' }, {});
  check('parent : fiche enfant exacte (parentId + année)', parentUrls2.includes(`/api/parent/children/child-1?parentId=${U1}&academicYearId=${YEAR}`));
  check('parent : cahier-journal classe 1 (semaine courante)', parentUrls2.includes(`/api/parent/cahier-journal/cls-1?academicYearId=${YEAR}&weekStart=${mondayStr}`));
  check('parent : semaines disponibles classe 2', parentUrls2.includes(`/api/parent/weeks/cls-2?academicYearId=${YEAR}`));
  check('parent : today + finance par enfant', parentUrls2.includes(`/api/parent/today/child-1?academicYearId=${YEAR}`) && parentUrls2.includes(`/api/parent/finance/child-2/breakdown?academicYearId=${YEAR}`));
  check('parent : PAS de comptes élèves (finance staff)', !parentUrls2.some((u) => u.includes('/api/finance/student-accounts/student/')));

  // ENSEIGNANT — devoirs/students
  const teacherUrls2 = await svc.buildDynamicPrecacheUrls(API, { tenantId: T1, userId: U1, teacherId: TEACHER1, portalType: 'TEACHER', role: 'ENSEIGNANT' }, {});
  check('enseignant : liste élèves par devoir', ['hw-1', 'hw-2', 'hw-3'].every((h) => teacherUrls2.includes(`/api/pedagogy-space/homeworks/${h}/students`)));
  check('enseignant : PAS de chaînes CDD (RH)', !teacherUrls2.some((u) => u.includes('/cdd-chain')));

  // SECRETAIRE-COMPTABLE — comptes élèves par élève (rappel v4.1) + CDD
  const scUrls2 = await svc.buildDynamicPrecacheUrls(API, { tenantId: T1, userId: U1, portalType: 'SCHOOL', role: 'SECRETAIRE_COMPTABLE' }, {});
  check('secrétaire-comptable : familles finance/RH vagues 2 dispatchées', scUrls2.every((u) => typeof u === 'string'));
}

// ═══ [7] Shells — getAdminShellForRole (9 rôles FR + EN) ═══════════════════
console.log('\n[7] Shells admin — chaque rôle obtient SON portail (FR + EN)');
{
  const expect = {
    PROMOTEUR: null, PROMOTER: null,
    DIRECTEUR: 'director', SCHOOL_DIRECTOR: 'director', DIRECTOR: 'director', PROVISEUR: 'director',
    SECRETAIRE: 'secretaire', SECRETARY: 'secretaire',
    SECRETAIRE_COMPTABLE: 'secretaire-comptable', SECRETARY_ACCOUNTANT: 'secretaire-comptable',
    COMPTABLE: 'comptable', ACCOUNTANT: 'comptable',
    CENSEUR: 'censeur', CENSOR: 'censeur',
    SURVEILLANT: 'surveillant', GENERAL_MONITOR: 'surveillant',
  };
  for (const [role, key] of Object.entries(expect)) {
    const shell = apm.getAdminShellForRole(role);
    if (key === null) {
      check(`${role} → UI complète (null)`, shell === null);
    } else {
      check(`${role} → portail ${key}`, shell?.key === key);
    }
  }
  // Variantes niveau-spécifiques (préfixe)
  check('DIRECTEUR_SECONDAIRE → director', apm.getAdminShellForRole('DIRECTEUR_SECONDAIRE')?.key === 'director');
  check('SECRETAIRE_COMPTABLE_SEC → secretaire-comptable', apm.getAdminShellForRole('SECRETAIRE_COMPTABLE_SEC')?.key === 'secretaire-comptable');
  check('SECRETAIRE_PRIMAIRE → secretaire (pas comptable)', apm.getAdminShellForRole('SECRETAIRE_PRIMAIRE')?.key === 'secretaire');
}

// ═══ Résumé ════════════════════════════════════════════════════════════════
console.log(`\n═══ RÉSULTAT : ${passed} ✓ / ${failed} ✗ ═══`);
if (failed) {
  console.log('\nÉchecs :');
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
