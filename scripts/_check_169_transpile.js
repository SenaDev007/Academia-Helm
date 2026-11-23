/**
 * ⭐ 169 — Vérification de transpilation des fichiers TS/TSX modifiés
 * (même pattern que les sessions précédentes : ts.transpileModule).
 */
const ts = require('typescript');
const fs = require('fs');

const ROOT = '/home/z/my-project/academia-helm';

const files = [
  [`${ROOT}/apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts`, false],
  [`${ROOT}/apps/api-server/src/hr/staff-prisma.service.ts`, false],
  [`${ROOT}/apps/api-server/src/hr/cleanup/cleanup.controller.ts`, false],
  [`${ROOT}/apps/api-server/src/hr/services/contract-pdf.service.ts`, false],
  [`${ROOT}/apps/web-app/src/components/pedagogy/teachers/TeachersAcademicWorkspace.tsx`, true],
  [`${ROOT}/apps/web-app/src/components/pedagogy/teachers/MultigradeTab.tsx`, true],
  [`${ROOT}/apps/web-app/src/components/pedagogy/assignments/AssignmentsWorkspace.tsx`, true],
];

let fail = 0;
for (const [f, jsx] of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      ...(jsx ? { jsx: ts.JsxEmit.Preserve } : {}),
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  const diags = (out.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (diags.length > 0) {
    fail++;
    console.error('✗', f);
    for (const d of diags) {
      console.error('   ', ts.flattenDiagnosticMessageText(d.messageText, ' '), '(pos', d.start, ')');
    }
  } else {
    console.log('✓', f.split('/').slice(-2).join('/'));
  }
}

// Vérifications statiques ciblées
const read = p => fs.readFileSync(p, 'utf8');
const checks = [
  [read(`${ROOT}/apps/web-app/src/components/pedagogy/teachers/TeachersAcademicWorkspace.tsx`),
    /teacherCategory/, 'TeachersAcademicWorkspace : helper teacherCategory'],
  [read(`${ROOT}/apps/web-app/src/components/pedagogy/teachers/TeachersAcademicWorkspace.tsx`),
    /handleCreateAllProfiles/, 'TeachersAcademicWorkspace : initialisation en masse'],
  [read(`${ROOT}/apps/web-app/src/components/pedagogy/teachers/TeachersAcademicWorkspace.tsx`),
    /Enseignants Maternelle & Primaire/, 'TeachersAcademicWorkspace : groupes catégorisés'],
  [read(`${ROOT}/apps/web-app/src/components/pedagogy/teachers/MultigradeTab.tsx`),
    /matPriTeachers/, 'MultigradeTab : filtre maternel-primaire'],
  [read(`${ROOT}/apps/web-app/src/components/pedagogy/assignments/AssignmentsWorkspace.tsx`),
    /levelEligibleTeachers/, 'AssignmentsWorkspace : filtre par niveau de classe'],
  [read(`${ROOT}/apps/web-app/src/components/pedagogy/assignments/AssignmentsWorkspace.tsx`),
    /getTeacherCategory\(t\.teacherId\) === 'SECONDAIRE'/, 'AssignmentsWorkspace : prof principal secondaire seul'],
  [read(`${ROOT}/apps/api-server/src/hr/staff-prisma.service.ts`),
    /purgePedagogyTeacherMirror/, 'staff-prisma : purge miroir pédagogique'],
  [read(`${ROOT}/apps/api-server/src/hr/services/contract-pdf.service.ts`),
    /purgePedagogyTeacherMirror/, 'contract-pdf : purge miroir pédagogique'],
];
for (const [src, re, label] of checks) {
  const ok = re.test(src);
  console.log(ok ? '✓' : '✗', label);
  if (!ok) fail++;
}

process.exit(fail > 0 ? 1 : 0);
