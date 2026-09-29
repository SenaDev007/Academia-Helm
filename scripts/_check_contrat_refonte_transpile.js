/**
 * Transpile check — Refonte CDC « étape Contrat » (backend api-server)
 * Vérifie que chaque fichier TS modifié/créé parse et transpile sans erreur.
 */
const { transpileModule } = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'apps/api-server/src/hr/services/contract-rules.ts',
  'apps/api-server/src/hr/services/internship-convention-template.ts',
  'apps/api-server/src/hr/services/employment-contract-templates.ts',
  'apps/api-server/src/hr/services/contract-settings.service.ts',
  'apps/api-server/src/hr/services/contract-pdf.service.ts',
  'apps/api-server/src/hr/contracts-prisma.service.ts',
  'apps/api-server/src/hr/contracts-prisma.controller.ts',
  'apps/api-server/src/hr/internships.service.ts',
  'apps/api-server/src/hr/internships.controller.ts',
  'apps/api-server/src/hr/recruitment.service.ts',
  'apps/api-server/src/hr/dto/index.ts',
  'apps/api-server/src/hr/hr.module.ts',
  'apps/api-server/src/main.ts',
];

let failed = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    console.error(`✗ MISSING: ${rel}`);
    failed++;
    continue;
  }
  const src = fs.readFileSync(p, 'utf8');
  const out = transpileModule(src, {
    compilerOptions: {
      module: 1, // CommonJS
      target: 4, // ES2020
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    reportDiagnostics: true,
    fileName: p,
  });
  const diags = (out.diagnostics || []).filter(d =>
    d.category === 1 /* Error */ &&
    // Les imports non résolus sont exclus (transpile seul ne résout pas les modules)
    !(d.code === 2307 || d.code === 2304 || d.code === 2688),
  );
  if (diags.length > 0) {
    failed++;
    console.error(`✗ ${rel}`);
    for (const d of diags.slice(0, 8)) {
      const line = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : '?';
      console.error(`   L${line}: TS${d.code} ${d.messageText}`);
    }
  } else {
    console.log(`✓ ${rel}`);
  }
}
process.exit(failed ? 1 : 0);
