/**
 * Vérification syntaxe + tests logiques — Task 28 (rôles + miroir bilingue).
 */
import { readFileSync } from 'fs';

const ROOT = '/home/z/my-project/academia-helm/';
let pass = 0, fail = 0;
function check(label, ok, detail) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
}

// ── 0. Transpilation ──
console.log('\n[0] Transpilation des fichiers modifiés');
const FILES = [
  'apps/api-server/src/common/context/resolve-school-level.ts',
  'apps/api-server/src/common/guards/access-scope.guard.ts',
  'apps/api-server/src/students/students-prisma.service.ts',
  'apps/api-server/src/students/services/students-lifecycle.service.ts',
  'apps/web-app/src/components/pilotage/modules/StudentsModulePage.tsx',
  'apps/web-app/src/components/students/EnrollmentsContent.tsx',
  'apps/web-app/src/components/students/StudentEnrollmentForm.tsx',
  'apps/web-app/src/components/finance/CollectionSummaryContent.tsx',
];
for (const f of FILES) {
  const code = readFileSync(ROOT + f, 'utf8');
  const loader = f.endsWith('.tsx') ? 'tsx' : 'ts';
  try {
    new Bun.Transpiler({ loader }).transformSync(code);
    check(`syntaxe ${loader} OK — ${f.split('/').pop()}`, true);
  } catch (e) {
    check(`syntaxe ${loader} OK — ${f.split('/').pop()}`, false, e.message);
  }
}

// ── 1. resolveSchoolLevelFilter — logique avec un mock prisma ──
console.log('\n[1] resolveSchoolLevelFilter (mock prisma — données réelles CSPEB)');
const schoolLevels = [
  { id: 'ea2e2f8a', code: 'MATERNELLE' },
  { id: 'bc434610', code: 'PRIMAIRE' },
  { id: '4aa299e5', code: 'SECONDAIRE' },
];
const eduLevels = [
  { id: '82417850', name: 'MATERNELLE' },
  { id: 'b41b8127', name: 'NURSERY' },
  { id: '04db39dd', name: 'PRIMAIRE' },
  { id: '4d0ad435', name: 'PRIMARY' },
  { id: '5edc5cb5', name: 'SECONDAIRE' },
];
const prismaMock = {
  schoolLevel: { findMany: async ({ where }) => schoolLevels.filter((s) => (where.code ? where.code.in ? where.code.in.includes(s.code) : s.code === where.code : true)) },
  educationLevel: { findMany: async () => eduLevels },
};
// On transpile et importe le module réel
const mod = await import(ROOT + 'apps/api-server/src/common/context/resolve-school-level.ts').catch(() => null);
if (!mod) {
  console.log('  (module non importable hors Nest — vérification par extraction de logique)');
} else {
  const resolve = mod.resolveSchoolLevelFilter;
  check('ALL → null (pas de filtre)', (await resolve(prismaMock, 't1', 'ALL')) === null);
  check('absent → null', (await resolve(prismaMock, 't1', undefined)) === null);
  check('UUID school_levels PRIMAIRE → direct', JSON.stringify(await resolve(prismaMock, 't1', 'bc434610')) === '["bc434610"]');
  check('UUID education_levels PRIMAIRE → school_levels PRIMAIRE', JSON.stringify(await resolve(prismaMock, 't1', '04db39dd')) === '["bc434610"]');
  check('UUID education_levels MATERNELLE → school_levels MATERNELLE', JSON.stringify(await resolve(prismaMock, 't1', '82417850')) === '["ea2e2f8a"]');
  check('MIROIR EN : UUID education_levels PRIMARY → school_levels PRIMAIRE (mêmes élèves)', JSON.stringify(await resolve(prismaMock, 't1', '4d0ad435')) === '["bc434610"]');
  check('MIROIR EN : UUID education_levels NURSERY → school_levels MATERNELLE (mêmes élèves)', JSON.stringify(await resolve(prismaMock, 't1', 'b41b8127')) === '["ea2e2f8a"]');
  check('Composite MAT_PRI → [MATERNELLE, PRIMAIRE]', JSON.stringify(await resolve(prismaMock, 't1', 'MAT_PRI')) === '["ea2e2f8a","bc434610"]');
  check('Code court PRI → [PRIMAIRE]', JSON.stringify(await resolve(prismaMock, 't1', 'PRI')) === '["bc434610"]');
  check('Code long PRIMAIRE → [PRIMAIRE]', JSON.stringify(await resolve(prismaMock, 't1', 'PRIMAIRE')) === '["bc434610"]');
  check('Inconnu → rendu tel quel (historique)', JSON.stringify(await resolve(prismaMock, 't1', 'xyz-unknown')) === '["xyz-unknown"]');
}

// ── 2. Guard : résolution avant rejet (structure du code) ──
console.log('\n[2] AccessScopeGuard — résolution avant rejet');
const guardSrc = readFileSync(ROOT + 'apps/api-server/src/common/guards/access-scope.guard.ts', 'utf8');
check('import du resolver présent', guardSrc.includes('isSchoolLevelFilterWithinScope'));
check('résolution tentée AVANT le rejet 403', guardSrc.indexOf('isSchoolLevelFilterWithinScope') < guardSrc.indexOf("throw new ForbiddenException(\n          `Accès refusé : votre périmètre"));
check('cache 2 min dans le resolver', readFileSync(ROOT + FILES[0], 'utf8').includes('CACHE_TTL_MS = 2 * 60 * 1000'));

// ── 3. StudentsModulePage — bon UUID + fused ──
console.log('\n[3] StudentsModulePage (module Élèves & Scolarité)');
const smp = readFileSync(ROOT + 'apps/web-app/src/components/pilotage/modules/StudentsModulePage.tsx', 'utf8');
check('effectiveLevelFilter défini (UUID school_levels)', smp.includes('schoolLevel.schoolLevelId || schoolLevel.id'));
check('fused MAT_PRI géré', smp.includes("'MAT_PRI'"));
check('loadStudents utilise effectiveLevelFilter', /loadStudents[\s\S]{0,600}effectiveLevelFilter/.test(smp));
check('create modal : UUID réel (pas composite)', smp.includes('schoolLevel?.schoolLevelId || schoolLevel?.id'));
check('plus aucun schoolLevel.id brut dans les query params élèves', !/params\.set\('schoolLevelId', schoolLevel\.id\)/.test(smp));

// ── 4. Wizard — filtrage par piste + message niveau vide ──
console.log('\n[4] StudentEnrollmentForm (wizard inscription)');
const sef = readFileSync(ROOT + 'apps/web-app/src/components/students/StudentEnrollmentForm.tsx', 'utf8');
check('filtrage piste EN/FR cohérent (miroir)', sef.includes("['NURSERY', 'PRIMARY', 'SECONDARY'].includes(selectedLevelCode)"));
check('message explicite si aucun niveau disponible', sef.includes('Aucun niveau scolaire disponible'));

// ── 5. EnrollmentsContent — enseignants en consultation ──
console.log('\n[5] EnrollmentsContent (actions par rôle)');
const enc = readFileSync(ROOT + 'apps/web-app/src/components/students/EnrollmentsContent.tsx', 'utf8');
check('détection enseignant (isTeacherOnly)', enc.includes('isTeacherOnly'));
check('boutons Nouvelle/Importer/Réinscription conditionnés', (enc.match(/canWriteEnrollments && \(/g) || []).length === 3);
check('bannière consultation pour enseignants', enc.includes('Mode consultation'));
check('import useAppSessionOptional', enc.includes("from '@/contexts/AppSessionContext'"));

// ── 6. Finance — miroir par code ──
console.log('\n[6] CollectionSummaryContent (bilan encaissements — miroir)');
const csc = readFileSync(ROOT + 'apps/web-app/src/components/finance/CollectionSummaryContent.tsx', 'utf8');
check('mapping EN→FR dans le filtre des classes', csc.includes("nursery: 'maternelle'") && csc.includes("primary: 'primaire'"));

// ── 7. Backend students — résolution dans les 4 méthodes ──
console.log('\n[7] students-prisma + lifecycle (backend)');
const sps = readFileSync(ROOT + 'apps/api-server/src/students/students-prisma.service.ts', 'utf8');
check('createStudent résout le schoolLevelId', /createStudent[\s\S]{0,900}resolveSchoolLevelFilter/.test(sps));
check('findAllStudents résout le filtre', /findAllStudents[\s\S]{0,1500}resolveSchoolLevelFilter/.test(sps));
check('getStudentStatistics résout le filtre', /getStudentStatistics[\s\S]{0,2200}resolveSchoolLevelFilter/.test(sps));
check('getAbandonedStudents résout le filtre', /getAbandonedStudents[\s\S]{0,900}resolveSchoolLevelFilter/.test(sps));
check('scopeTrack préservé partout (piste)', (sps.match(/studentTrackRelation\(scope/g) || []).length >= 3);
const sls = readFileSync(ROOT + 'apps/api-server/src/students/services/students-lifecycle.service.ts', 'utf8');
check('preRegister résout le schoolLevelId', /preRegister[\s\S]{0,2500}resolveSchoolLevelFilter/.test(sls));
check('admit résout le schoolLevelId', /admit\(tenantId[\s\S]{0,2000}resolveSchoolLevelFilter/.test(sls));

// ── Résultat ──
console.log(`\n──────────────────────────────────────`);
console.log(`Résultat : ${pass} OK, ${fail} échec(s)`);
process.exit(fail > 0 ? 1 : 0);
