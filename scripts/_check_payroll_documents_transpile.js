/**
 * Vérification de transpilation des fichiers TS modifiés (RH Bénin — documents
 * de paie FP/EP). Même pattern que les sessions précédentes (ts.transpileModule
 * — contournement bun 1.3.14).
 */
const ts = require('typescript'); // résolution : clone > parent sandbox (node_modules)
const fs = require('fs');

const BASE = __dirname + '/../apps/api-server/src/hr';

const files = [
  `${BASE}/services/payroll-document-templates.ts`,
  `${BASE}/services/payroll-documents.service.ts`,
  `${BASE}/services/payroll-engine.service.ts`,
  `${BASE}/payroll-documents.controller.ts`,
  `${BASE}/payroll-prisma.service.ts`,
  `${BASE}/payroll-prisma.controller.ts`,
  `${BASE}/hr.module.ts`,
  __dirname + '/../apps/api-server/src/main.ts',
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
  });
  const diags = (out.diagnostics || []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  );
  if (diags.length) {
    fail++;
    console.error(`✗ ${path(f)}`);
    for (const d of diags) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      const line = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : '?';
      console.error(`    L${line}: ${msg}`);
    }
  } else {
    console.log(`✓ ${path(f)}`);
  }
}

function path(f) {
  return f.replace(__dirname + '/..', '');
}

if (fail) {
  console.error(`\n${fail} fichier(s) en échec de transpilation`);
  process.exit(1);
}
console.log(`\nTranspilation OK — ${files.length}/${files.length} fichiers`);
