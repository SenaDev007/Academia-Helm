/**
 * Vérification de transpilation des fichiers TS/TSX modifiés (⭐ 156 — onglet
 * CNSS : tableau de bord, annuaire fiscal, état de paiement, indemnités
 * dynamiques). Même pattern que les sessions précédentes (ts.transpileModule).
 */
const ts = require('typescript'); // résolution : parent sandbox (node_modules)
const fs = require('fs');

const API = '/home/z/my-project/academia-helm/apps/api-server/src/hr';
const WEB = '/home/z/my-project/academia-helm/apps/web-app/src/app/app/hr/_components/taxes';

const files = [
  [`${API}/taxes/services/payroll.service.ts`, false],
  [`${API}/taxes/taxes.controller.ts`, false],
  [`${API}/taxes/taxes.module.ts`, false],
  [`${API}/taxes/services/tax-excel.service.ts`, false],
  [`${API}/hr.module.ts`, false], // contrôle : module racine intact
  [`${WEB}/TaxDashboard.tsx`, true],
  [`${WEB}/StaffFiscalManagement.tsx`, true],
  [`${WEB}/PayrollManagement.tsx`, true],
];

let fail = 0;
for (const [f, jsx] of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.Preserve,
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
    console.error(`FAIL ${f}`);
    for (const d of diags) {
      const pos = d.file ? `${f}:${ts.getLineAndCharacterOfPosition(d.file, d.start ?? 0).line + 1}` : '';
      console.error('   ', pos, ts.flattenDiagnosticMessageText(d.messageText, ' '));
    }
  } else {
    console.log(`OK   ${f}`);
  }
}
process.exit(fail ? 1 : 0);
