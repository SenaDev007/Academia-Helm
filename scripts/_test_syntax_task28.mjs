/**
 * Vérification syntaxe TS (Bun.Transpiler) des fichiers modifiés — Task 28.
 */
import { readFileSync } from 'fs';

const ROOT = '/home/z/my-project/academia-helm/';
const FILES = [
  'apps/api-server/src/common/context/resolve-school-level.ts',
  'apps/api-server/src/common/guards/access-scope.guard.ts',
  'apps/api-server/src/students/students-prisma.service.ts',
];

let fail = 0;
for (const f of FILES) {
  const code = readFileSync(ROOT + f, 'utf8');
  try {
    new Bun.Transpiler({ loader: 'ts' }).transformSync(code);
    console.log(`  ✓ ${f}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${f}: ${e.message}`);
  }
}

// Vérifs structurelles spécifiques
const svc = readFileSync(ROOT + FILES[2], 'utf8');
const checks = [
  ['findAllStudents : résolution présente', /findAllStudents[\s\S]*?resolveSchoolLevelFilter[\s\S]*?scopeTrack/.test(svc)],
  ['findAllStudents : filtre status présent', /if \(filters\?\.status\) \{\s*where\.status = filters\.status;/.test(svc)],
  ['statistics : résolution + piste', /getStudentStatistics[\s\S]*?resolveSchoolLevelFilter[\s\S]*?scopeTrack/.test(svc)],
  ['abandons : résolution + piste', /getAbandonedStudents[\s\S]*?resolveSchoolLevelFilter[\s\S]*?scopeTrack/.test(svc)],
  ['import du helper présent', svc.includes("import { resolveSchoolLevelFilter } from '../common/context/resolve-school-level'")],
];
const guard = readFileSync(ROOT + FILES[1], 'utf8');
checks.push(
  ['guard : résolution avant rejet', guard.includes('isSchoolLevelFilterWithinScope')],
  ['guard : PrismaService injecté', /constructor\(\s*private reflector: Reflector,\s*private readonly prisma: PrismaService,/.test(guard)],
);
for (const [label, ok] of checks) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}`);
  if (!ok) fail++;
}

process.exit(fail > 0 ? 1 : 0);
