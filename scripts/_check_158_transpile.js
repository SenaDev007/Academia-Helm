/**
 * Vérification de transpilation des fichiers TS/TSX modifiés (⭐ 158 —
 * self-service paie « Ma Paie » + onboarding étape 4 prestation).
 * Même pattern que les sessions précédentes (ts.transpileModule).
 */
const ts = require('typescript'); // résolution : parent sandbox (node_modules)
const fs = require('fs');

const ROOT = '/home/z/my-project/academia-helm';
const API = `${ROOT}/apps/api-server/src/hr`;
const WEB = `${ROOT}/apps/web-app/src`;

const files = [
  [`${API}/services/payroll-documents.service.ts`, false],
  [`${API}/payroll-documents.controller.ts`, false],
  [`${API}/staff-prisma.service.ts`, false],
  [`${WEB}/app/app/hr/_components/onboarding/OnboardingWizard.tsx`, true],
  [`${WEB}/app/app/hr/_components/onboarding/steps/StepContract.tsx`, true],
  [`${WEB}/app/app/hr/_components/onboarding/types.ts`, false],
  [`${WEB}/components/hr/MyPayslipsWorkspace.tsx`, true],
  [`${WEB}/app/app/my-paie/page.tsx`, true],
  [`${WEB}/app/app/teacher/paie/page.tsx`, true],
  [`${WEB}/lib/auth/admin-portal-map.ts`, false],
  [`${WEB}/app/app/teacher/layout.tsx`, true],
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
