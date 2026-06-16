// Quick syntax check for all platform workspaces and touched files
// Uses @babel/parser to verify there are no syntax errors (broken apostrophes,
// missing brackets, etc.). Type errors are NOT checked — only syntax.

import { readFileSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from '@babel/parser';

const ROOT = '/home/z/my-project/apps/web-app/src';

function listTsx(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) listTsx(p, acc);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const files = [
  ...listTsx(join(ROOT, 'components/platform')),
  ...listTsx(join(ROOT, 'app/app/platform')),
  join(ROOT, 'middleware.ts'),
  join(ROOT, 'hooks/useAdminSubdomain.ts'),
  join(ROOT, 'components/pilotage/PilotageSidebar.tsx'),
  join(ROOT, 'components/auth/LoginPage.tsx'),
  join(ROOT, 'app/app/hr/_components/modals/ContractSignModal.tsx'),
  join(ROOT, 'app/(app)/hr/_components/modals/ContractSignModal.tsx'),
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
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'objectRestSpread'],
      errorRecovery: false,
    });
  } catch (e) {
    bad++;
    console.log(`SYNTAX ERROR in ${f}:${e.loc?.line || '?'} — ${e.message}`);
  }
}
console.log(`\nDone. ${files.length} files checked, ${bad} syntax errors.`);
