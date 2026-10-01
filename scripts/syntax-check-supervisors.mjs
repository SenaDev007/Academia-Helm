// Syntax check for the « Gestion des surveillants » feature (2026-09-29 #4)
// Sidebar Federis (Épreuves et documents → EXAMENS, Centres, salles &
// Surveillants), catalogue déplacé vers la Banque d'épreuves, workflow
// surveillants patronat ↔ écoles (backend + frontend).
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const base = new URL('..', import.meta.url).pathname;
const files = [
  // Backend (NestJS)
  `${base}apps/api-server/src/federis/federis-supervisors.service.ts`,
  `${base}apps/api-server/src/federis/federis-supervisors.controller.ts`,
  `${base}apps/api-server/src/federis/federis-school-supervisors.controller.ts`,
  `${base}apps/api-server/src/federis/federis.module.ts`,
  // Frontend Federis (patronat)
  `${base}apps/web-app/src/components/federis/FederisLayout.tsx`,
  `${base}apps/web-app/src/components/federis/FederisEpreuvesPage.tsx`,
  `${base}apps/web-app/src/components/federis/FederisQuestionBankPage.tsx`,
  `${base}apps/web-app/src/components/federis/FederisCentersPage.tsx`,
  `${base}apps/web-app/src/components/federis/FederisSupervisorsTab.tsx`,
  // Frontend Helm (école)
  `${base}apps/web-app/src/components/federis/SchoolPatronatsPage.tsx`,
  `${base}apps/web-app/src/components/federis/SchoolSupervisorsTab.tsx`,
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
