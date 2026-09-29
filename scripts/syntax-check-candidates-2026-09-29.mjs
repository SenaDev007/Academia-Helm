// Syntax check for the 2026-09-29 candidates module changes (pattern scripts/syntax-check-*.mjs du repo)
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const files = [
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-school-exams.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-exams.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-exams.controller.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-supervisors.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-users.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-deliberation.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-pdf.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-pdf.controller.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-candidates-export.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis.module.ts',
  '/home/z/my-project/ah/apps/web-app/src/app/app/exams/national-exams/page.tsx',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisCandidatesPage.tsx',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisSettingsPage.tsx',
];

let bad = 0;
for (const f of files) {
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch (e) {
    console.log(`SKIP (missing): ${f}`);
    continue;
  }
  try {
    parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy', 'classProperties', 'objectRestSpread', 'jsx'],
      errorRecovery: false,
    });
    console.log(`OK   ${f.split('/').pop()}`);
  } catch (e) {
    bad++;
    console.log(`SYNTAX ERROR in ${f}:${e.loc?.line || '?'} — ${e.message}`);
  }
}
console.log(bad === 0 ? '\n✓ Tous les fichiers sont syntaxiquement valides' : `\n✗ ${bad} fichier(s) en erreur`);
process.exit(bad ? 1 : 0);
