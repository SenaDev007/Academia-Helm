// Syntax check for all files touched in this session
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const files = [
  // Backend
  '/home/z/my-project/apps/api-server/src/platform/services/platform.service.ts',
  '/home/z/my-project/apps/api-server/src/platform/controllers/platform.controller.ts',
  '/home/z/my-project/apps/api-server/src/reviews/reviews.controller.ts',
  '/home/z/my-project/apps/api-server/src/reviews/reviews.service.ts',
  // Frontend - new files
  '/home/z/my-project/apps/web-app/src/app/app/platform/reviews/page.tsx',
  '/home/z/my-project/apps/web-app/src/app/app/platform/reviews/loading.tsx',
  '/home/z/my-project/apps/web-app/src/components/platform/reviews/ReviewsModerationWorkspace.tsx',
  // Frontend - modified files
  '/home/z/my-project/apps/web-app/src/components/pilotage/PilotageSidebar.tsx',
  '/home/z/my-project/apps/web-app/src/components/pilotage/PilotageLayout.tsx',
  '/home/z/my-project/apps/web-app/src/app/api/platform/[...path]/route.ts',
  '/home/z/my-project/apps/web-app/src/components/landing/ReviewsSection.tsx',
  '/home/z/my-project/apps/web-app/src/components/reviews/InAppReviewModal.tsx',
  '/home/z/my-project/apps/web-app/src/components/reviews/ReviewRequestModal.tsx',
  '/home/z/my-project/apps/web-app/src/components/reviews/ReviewAutoPopup.tsx',
  '/home/z/my-project/apps/web-app/src/components/reviews/ReviewPromptHost.tsx',
  '/home/z/my-project/apps/web-app/src/hooks/usePlatformData.ts',
  '/home/z/my-project/apps/web-app/src/hooks/useReviewPrompt.ts',
  '/home/z/my-project/apps/web-app/src/app/api/public/reviews/route.ts',
  '/home/z/my-project/apps/web-app/src/app/api/public/reviews-published/route.ts',
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
console.log(`Done. ${files.length} files checked, ${bad} syntax errors.`);
