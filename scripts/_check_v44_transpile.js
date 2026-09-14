/**
 * Vérification de transpilation des fichiers TS modifiés (v4.4.0 filtres offline).
 * Même pattern que les sessions précédentes (ts.transpileModule).
 */
const ts = require('/home/z/my-project/node_modules/typescript');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/work/academia-helm';
const files = [
  `${ROOT}/apps/web-app/src/lib/offline/module-precache.service.ts`,
  `${ROOT}/apps/api-server/src/pedagogy/global-library-prisma.service.ts`,
  `${ROOT}/apps/api-server/src/pedagogy/global-library-prisma.controller.ts`,
];

let fail = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
    fileName: f,
  });
  const diags = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diags.length) {
    fail++;
    console.log('ECHEC', path.basename(f));
    diags.forEach((d) => console.log('   →', ts.flattenDiagnosticMessageText(d.messageText, '\n'), '(ligne', d.line + 1, ')'));
  } else {
    console.log('OK  ', path.basename(f));
  }
}
console.log(fail ? `\n${fail} fichier(s) en échec` : `\n${files.length}/${files.length} fichiers transpilés sans erreur`);
process.exit(fail ? 1 : 0);
