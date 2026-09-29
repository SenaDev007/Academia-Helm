// Syntax check for modified web-app TSX files (federis schools + exams + national exams)
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const base = '/home/z/my-project/academia-helm/apps/web-app/src';
const files = [
  `${base}/components/federis/FederisSchoolsPage.tsx`,
  `${base}/components/federis/FederisExamsPage.tsx`,
  `${base}/app/app/exams/national-exams/page.tsx`,
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
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'objectRestSpread'],
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
