// Syntax check for the evaluations reorganization (task 130) + grades unique fix
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';

const files = [
  // Frontend (web-app)
  '/home/z/my-project/academia-helm/apps/web-app/src/app/app/exams/evaluations/page.tsx',
  '/home/z/my-project/academia-helm/apps/web-app/src/lib/exam-anglophone-config.ts',
  '/home/z/my-project/academia-helm/apps/web-app/src/services/institutional-exams.service.ts',
  // Backend (api-server)
  '/home/z/my-project/academia-helm/apps/api-server/src/modules/exams/services/evaluations.service.ts',
  '/home/z/my-project/academia-helm/apps/api-server/src/classes/classes.repository.ts',
  // Migration SQL (basic sanity)
  '/home/z/my-project/academia-helm/apps/api-server/prisma/migrations/20261117180000_grades_unique_tenant_evaluation_student/migration.sql',
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
  if (f.endsWith('.sql')) {
    const must = [
      'DROP INDEX IF EXISTS "grades_tenant_evaluation_student_component_key"',
      'CREATE UNIQUE INDEX IF NOT EXISTS "tenantId_evaluationId_studentId"',
    ];
    const missing = must.filter((m) => !code.includes(m));
    if (missing.length) {
      bad++;
      console.log(`SQL CONTENT ISSUE in ${f}: missing ${JSON.stringify(missing)}`);
    } else {
      console.log(`OK (sql): ${f.split('/').slice(-2).join('/')}`);
    }
    continue;
  }
  const isTSX = f.endsWith('.tsx');
  try {
    parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'objectRestSpread'],
      errorRecovery: false,
    });
    console.log(`OK: ${f.split('/').slice(-2).join('/')}`);
  } catch (e) {
    bad++;
    console.log(`SYNTAX ERROR in ${f}:${e.loc?.line || '?'} — ${e.message}`);
  }
}

if (bad > 0) {
  console.error(`\n${bad} file(s) with problems`);
  process.exit(1);
} else {
  console.log('\nAll files OK');
}
