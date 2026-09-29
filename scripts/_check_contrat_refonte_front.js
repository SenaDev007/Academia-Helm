/**
 * Parse check JSX/TSX — fichiers front modifiés (refonte CDC « étape Contrat »)
 * Vérifie que chaque fichier parse SANS erreur (syntaxe) via le parseur TypeScript.
 */
const fs = require('fs');
const path = require('path');
const ts = require('/home/z/my-project/node_modules/typescript');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'apps/web-app/src/app/app/hr/_components/onboarding/types.ts',
  'apps/web-app/src/app/app/hr/_components/onboarding/OnboardingWizard.tsx',
  'apps/web-app/src/app/app/hr/_components/onboarding/steps/StepContract.tsx',
  'apps/web-app/src/app/app/hr/_components/onboarding/steps/StepEmployment.tsx',
  'apps/web-app/src/app/app/hr/_components/workspaces/ContractsWorkspace.tsx',
  'apps/web-app/src/app/app/hr/_components/workspaces/InternshipsWorkspace.tsx',
  'apps/web-app/src/app/app/hr/_components/workspaces/SettingsWorkspace.tsx',
  'apps/web-app/src/app/app/hr/_components/workspaces/StaffWorkspace.tsx',
  'apps/web-app/src/app/app/hr/_components/workspaces/RecruitmentWorkspace.tsx',
  'apps/web-app/src/app/app/hr/internships/page.tsx',
  'apps/web-app/src/app/app/hr/hr-tabs.ts',
  'apps/web-app/src/app/app/hr/staff/[id]/page.tsx',
  'apps/web-app/src/app/app/hr/payroll/[id]/page.tsx',
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
  const sf = ts.createSourceFile(p, src, ts.ScriptTarget.ES2020, true, rel.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  const diags = sf.parseDiagnostics || [];
  if (diags.length > 0) {
    failed++;
    console.error(`✗ ${rel} — ${diags.length} erreur(s) de parse`);
    for (const d of diags.slice(0, 5)) {
      const pos = sf.getLineAndCharacterOfPosition(d.start || 0);
      console.error(`   L${pos.line + 1}:C${pos.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
  } else {
    console.log(`✓ ${rel}`);
  }
}
process.exit(failed ? 1 : 0);
