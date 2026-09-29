// Syntax check for the modified federis backend files
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const base = '/home/z/my-project/academia-helm/apps/api-server/src';
const files = [
  `${base}/federis/federis-patronat.service.ts`,
  `${base}/federis/federis-school-exams.service.ts`,
  `${base}/federis/federis-exams.service.ts`,
  `${base}/common/constants/benin-territories.ts`,
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
      plugins: ['typescript', 'decorators-legacy', 'classProperties', 'objectRestSpread'],
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
