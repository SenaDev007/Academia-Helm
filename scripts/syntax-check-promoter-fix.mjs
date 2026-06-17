#!/usr/bin/env node
/**
 * Vérification syntaxique des fichiers modifiés via Babel.
 */
import { parse } from '@babel/parser';
import fs from 'fs';
import path from 'path';

const FILES = [
  // Frontend (web-app)
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/lib/auth/role-portal-map.ts',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/pilotage/PilotageSidebar.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/DashboardPage.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/DashboardHeader.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/PromoterDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/DirectorDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/ParentDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/PlatformOwnerDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/TeacherDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/AccountantDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/dashboard/roles/StudentDashboard.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/admin/DevicesManagement.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/components/reviews/InAppReviewModal.tsx',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/lib/reviews-api-url.ts',
  '/home/z/my-project/repo/Academia-Helm/apps/web-app/src/app/api/public/reviews/check-tenant/[tenantId]/route.ts',
  // Backend (api-server)
  '/home/z/my-project/repo/Academia-Helm/apps/api-server/src/reviews/reviews.service.ts',
  '/home/z/my-project/repo/Academia-Helm/apps/api-server/src/reviews/reviews.controller.ts',
];

let ok = true;
for (const file of FILES) {
  try {
    const code = fs.readFileSync(file, 'utf8');
    parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'objectRestSpread'],
    });
    console.log('OK:', path.basename(file));
  } catch (e) {
    ok = false;
    console.error('FAIL:', file);
    console.error(e.message);
  }
}

process.exit(ok ? 0 : 1);
