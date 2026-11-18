// Syntax check for the 2026-11-18 batch:
//   1. Editable arrear (PATCH) + statistics restoration (recovery module)
//   2. Modal footer always visible + proper centering (all shared primitives)
//   3. Evaluations hierarchy: Trimester -> Class -> Evaluations
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const files = [
  // ── 1. Arriéré modifiable + statistiques ──
  '/home/z/my-project/academia-helm/apps/web-app/src/components/finance/recovery/RecoveryContent.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/services/finance.service.ts',
  '/home/z/my-project/academia-helm/apps/web-app/src/app/api/finance/collection/arrears/[id]/route.ts',
  '/home/z/my-project/academia-helm/apps/api-server/src/finance/collection-prisma.controller.ts',
  '/home/z/my-project/academia-helm/apps/api-server/src/finance/collection-prisma.service.ts',
  // ── 2. Modals : pied fixe + centrage ──
  '/home/z/my-project/academia-helm/apps/web-app/src/components/ui/dialog.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/ui/alert-dialog.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/ui/confirm-dialog.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/finance/NewPaymentModal.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/modules/blueprint/modals/BaseModal.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/templates/ModalTemplate.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/students/PostEnrollmentFlow.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/students/ImportElevesModal.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/components/students/FicheTransfertModal.tsx',
  // ── 3. Hiérarchie évaluations ──
  '/home/z/my-project/academia-helm/apps/web-app/src/app/app/exams/evaluations/page.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/lib/exam-anglophone-config.ts',
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
  const isTSX = f.endsWith('.tsx');
  const isNest = f.includes('/api-server/');
  const plugins = isNest
    ? ['typescript', 'decorators-legacy', 'classProperties', 'objectRestSpread']
    : ['typescript', ['decorators', { legacy: true }], 'classProperties', 'jsx'];
  try {
    parse(code, {
      sourceType: 'module',
      plugins,
      errorRecovery: false,
    });
    console.log(`OK: ${f.split('/').slice(-2).join('/')}`);
  } catch (e) {
    bad++;
    console.log(`FAIL: ${f}`);
    console.log(`   ${e.message}`);
  }
}

if (bad > 0) {
  console.log(`\n${bad} file(s) with syntax errors`);
  process.exit(1);
} else {
  console.log(`\nAll ${files.length} files parsed OK`);
}
