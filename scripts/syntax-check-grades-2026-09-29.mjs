// Syntax check for the 2026-09-29 « Notes et Moyennes » module (pattern scripts/syntax-check-*.mjs du repo)
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const files = [
  // Backend
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-grades.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-grades.controller.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-pdf.service.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis-pdf.controller.ts',
  '/home/z/my-project/ah/apps/api-server/src/federis/federis.module.ts',
  // Frontend
  '/home/z/my-project/ah/apps/web-app/src/lib/federis/grade-computations.ts',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisGradesPage.tsx',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisGradeSheetTab.tsx',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisGradeRegistryTab.tsx',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx',
  '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisLayout.tsx',
  '/home/z/my-project/ah/apps/web-app/src/lib/patronat/permissions.ts',
  '/home/z/my-project/ah/apps/web-app/src/app/(patronat)/federis/grades/page.tsx',
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
