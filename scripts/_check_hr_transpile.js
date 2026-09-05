/**
 * Vérification de transpilation des fichiers TS modifiés (RH Bénin — statut contractuel).
 * Même pattern que les sessions précédentes (ts.transpileModule — contournement bun 1.3.14).
 */
const ts = require('../apps/api-server/node_modules/typescript');
const fs = require('fs');
const path = require('path');

const BASE = __dirname + '/../apps/api-server/src/hr';
const MAIN = __dirname + '/../apps/api-server/src';

const files = [
  `${BASE}/services/employment-contract-templates.ts`,
  `${BASE}/services/payroll-engine.service.ts`,
  `${BASE}/services/contract-pdf.service.ts`,
  `${BASE}/contracts-prisma.service.ts`,
  `${BASE}/staff-prisma.service.ts`,
  `${BASE}/staff-prisma.controller.ts`,
  `${BASE}/recruitment.service.ts`,
  `${BASE}/cnss-prisma.service.ts`,
  `${BASE}/cnss-prisma.controller.ts`,
  `${BASE}/payroll-prisma.service.ts`,
  `${BASE}/payroll-prisma.controller.ts`,
  `${BASE}/hr.module.ts`,
  `${BASE}/dto/index.ts`,
  `${MAIN}/main.ts`,
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
