// Syntax check for backend platform files + contract service
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const files = [
  '/home/z/my-project/apps/api-server/src/platform/controllers/platform.controller.ts',
  '/home/z/my-project/apps/api-server/src/platform/services/platform.service.ts',
  '/home/z/my-project/apps/api-server/src/platform/platform.module.ts',
  '/home/z/my-project/apps/api-server/src/hr/services/contract-pdf.service.ts',
  '/home/z/my-project/apps/api-server/src/hr/contracts-prisma.controller.ts',
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
  } catch (e) {
    bad++;
    console.log(`SYNTAX ERROR in ${f}:${e.loc?.line || '?'} — ${e.message}`);
  }
}
console.log(`Done. ${files.length} files checked, ${bad} syntax errors.`);
