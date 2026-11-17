/**
 * Vérification de transpilation des fichiers TS modifiés (finance — soldes
 * anciens élèves « scolarité 0 F »). Pattern des sessions précédentes
 * (ts.transpileModule — contournement bun 1.3.14).
 */
const ts = require('/home/z/my-project/node_modules/typescript');
const fs = require('fs');
const path = require('path');

const FIN = __dirname + '/../apps/api-server/src/finance';

const files = [
  `${FIN}/student-account.service.ts`,
  `${FIN}/finance-transaction.service.ts`,
  `${FIN}/finance.module.ts`,
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
