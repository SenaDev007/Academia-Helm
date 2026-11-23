// Tâche 170 — Vérification de transpilation des fichiers modifiés
const ts = require('/home/z/my-project/node_modules/typescript');
const fs = require('fs');

const files = [
  ['apps/api-server/src/communication/services/whatsapp-template.registry.ts', false],
  ['apps/api-server/src/communication/services/whatsapp.service.ts', false],
  ['apps/api-server/src/modules/exams/bulletins.controller.ts', false],
  ['apps/api-server/src/pedagogy/teacher-academic-profile-prisma.service.ts', false],
  ['apps/web-app/src/app/app/exams/bulletins/page.tsx', true],
  ['apps/web-app/src/components/pedagogy/assignments/AssignmentsWorkspace.tsx', true],
];

let fail = 0;
for (const [f, jsx] of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Preserve,
      jsx: jsx ? ts.JsxEmit.Preserve : ts.JsxEmit.None,
    },
    reportDiagnostics: true,
    fileName: f,
  });
  const diags = (out.diagnostics || []).filter(d => d.category === 0);
  if (diags.length === 0) {
    console.log('OK   ', f);
  } else {
    fail++;
    console.log('FAIL ', f);
    for (const d of diags) {
      console.log('   →', ts.flattenDiagnosticMessageText(d.messageText, ' '));
    }
  }
}
process.exit(fail ? 1 : 0);
