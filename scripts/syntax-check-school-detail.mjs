// Syntax check for the « Fiche détail école rattachée » feature (2026-09-29 #3)
// Vérifie les fichiers backend (NestJS) et frontend (Next.js) modifiés.
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const base = new URL('..', import.meta.url).pathname;
const files = [
  `${base}apps/api-server/src/federis/federis-patronat.service.ts`,
  `${base}apps/api-server/src/federis/federis-patronat.controller.ts`,
  `${base}apps/api-server/src/federis/federis-school-exams.service.ts`,
  `${base}apps/web-app/src/components/federis/FederisSchoolsPage.tsx`,
  `${base}apps/web-app/src/components/federis/FederisSchoolDetail.tsx`,
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
      plugins: [
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'jsx',
      ],
      errorRecovery: false,
    });
    console.log(`OK: ${f.split('/').pop()}`);
  } catch (e) {
    bad++;
    console.log(`SYNTAX ERROR in ${f}:${e.loc?.line || '?'} — ${e.message}`);
  }
}
console.log(`Done. ${files.length} files checked, ${bad} syntax errors.`);
process.exit(bad > 0 ? 1 : 0);
