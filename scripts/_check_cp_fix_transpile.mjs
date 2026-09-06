/**
 * Vérification transpilation des fichiers modifiés (fix élèves CP)
 * - Backend : students-lifecycle.service.ts (auto-affectation classe physique)
 * - Frontend : StudentClassListsContent.tsx (section « Non affectés »)
 */
import { Transpiler } from 'bun';
import { readFileSync } from 'fs';

const files = [
  '/home/z/my-project/academia-helm/apps/api-server/src/students/services/students-lifecycle.service.ts',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/students/StudentClassListsContent.tsx',
];

let ok = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf-8');
  try {
    const transpiler = new Transpiler({ loader: f.endsWith('.tsx') ? 'tsx' : 'ts' });
    transpiler.transformSync(src);
    console.log(`✓ ${f.split('/').pop()} — transpile OK`);
    ok++;
  } catch (e) {
    console.error(`✗ ${f.split('/').pop()} — ERREUR: ${e.message}`);
    process.exit(1);
  }
}

// Vérifications structurelles sur la source
const backend = readFileSync(files[0], 'utf-8');
const checks = [
  ['backend: resolvedClassId déclaré', backend.includes('let resolvedClassId = data.classId ?? null;')],
  ['backend: requête findMany sections physiques', backend.includes('officialClassId: resolvedAcademicClassId')],
  ['backend: classId: resolvedClassId dans create', backend.includes('classId: resolvedClassId,')],
  ['backend: audit avec resolvedClassId', backend.includes('classId: resolvedClassId,') && backend.includes("'PRE_REGISTER'")],
];
const frontend = readFileSync(files[1], 'utf-8');
const frontChecks = [
  ['front: academicClass dans interface', frontend.includes('academicClass?: { id: string; name: string } | null;')],
  ['front: unassignedStudents useMemo', frontend.includes('const unassignedStudents = useMemo(() => {')],
  ['front: filteredUnassigned', frontend.includes('const filteredUnassigned = useMemo(() => {')],
  ['front: rendu section Non affectés', frontend.includes('Non affectés à une classe physique')],
  ['front: isUnassignedExpanded state', frontend.includes('const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(true);')],
  ['front: exclusion WITHDRAWN/TRANSFERRED', frontend.includes("e.status !== 'WITHDRAWN' && e.status !== 'TRANSFERRED'")],
];

let allOk = true;
for (const [label, pass] of [...checks, ...frontChecks]) {
  console.log(`${pass ? '✓' : '✗'} ${label}`);
  if (!pass) allOk = false;
}
console.log(allOk ? '\n=== TOUTES VÉRIFICATIONS OK ===' : '\n=== ÉCHEC ===');
process.exit(allOk ? 0 : 1);
