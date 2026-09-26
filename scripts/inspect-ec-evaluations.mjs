/**
 * Inspect ALL evaluations for primaire/maternelle — all types, all statuses.
 * Identify what's actually in the DB.
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected\n');

  // 1) Count ALL evaluations for primaire/maternelle classes — all statuses, all types
  console.log('═'.repeat(100));
  console.log('1) ALL evaluations for primaire/maternelle — grouped by class × type × status');
  console.log('═'.repeat(100));

  const allEvals = await client.query(`
    SELECT c.name AS class_name, sl.code AS level_code, et.code AS eval_type,
           e.status, ap.name AS period_name, COUNT(*)::int AS cnt
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
     WHERE e."tenantId" = $1
       AND sl.code IN ('PRIMAIRE', 'MATERNELLE')
     GROUP BY c.name, sl.code, et.code, e.status, ap.name
     ORDER BY sl.code, c.name, ap.name, et.code, e.status
  `, [TENANT_ID]);

  // Display as a table
  console.log(`Total evaluations : ${allEvals.rows.reduce((sum, r) => sum + r.cnt, 0)}`);
  console.log();

  for (const r of allEvals.rows) {
    console.log(`  • [${r.level_code}] ${r.class_name} | ${r.period_name || '—'} | ${r.eval_type || '—'} | status=${r.status} | nb=${r.cnt}`);
  }

  // 2) Special focus on EC evaluations for primaire — how many subjects per class × trimester?
  console.log('\n\n' + '═'.repeat(100));
  console.log('2) EC evaluations — sujet coverage');
  console.log('═'.repeat(100));

  const ecEvals = await client.query(`
    SELECT c.name AS class_name, sl.code AS level_code, ap.name AS period_name,
           s.name AS subject_name, s.code AS subject_code,
           e.id AS eval_id, e.status
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
      JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
      LEFT JOIN subjects s ON s.id = e."subjectId"
     WHERE e."tenantId" = $1
       AND sl.code IN ('PRIMAIRE', 'MATERNELLE')
       AND et.code = 'EC'
     ORDER BY sl.code, c.name, ap.name, s.name
  `, [TENANT_ID]);

  console.log(`Total EC evaluations : ${ecEvals.rows.length}`);
  // Group by class × period
  const ecByClassPeriod = new Map();
  for (const r of ecEvals.rows) {
    const k = `${r.level_code} ${r.class_name} | ${r.period_name || '—'}`;
    if (!ecByClassPeriod.has(k)) ecByClassPeriod.set(k, []);
    ecByClassPeriod.get(k).push(r);
  }
  for (const [k, items] of ecByClassPeriod) {
    console.log(`\n  ── ${k} ──`);
    console.log(`     ${items.length} EC évaluations :`);
    items.forEach(r => console.log(`       • ${r.subject_name || '—'} (${r.subject_code || '—'}) | status=${r.status}`));
  }

  // 3) Compter les grades par classe × type × trimester
  console.log('\n\n' + '═'.repeat(100));
  console.log('3) Grades par classe × type × trimestre');
  console.log('═'.repeat(100));

  const gradeCounts = await client.query(`
    SELECT c.name AS class_name, sl.code AS level_code, et.code AS eval_type,
           ap.name AS period_name, COUNT(g.id)::int AS grade_count
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
      LEFT JOIN grades g ON g."evaluationId" = e.id
     WHERE e."tenantId" = $1
       AND sl.code IN ('PRIMAIRE', 'MATERNELLE')
     GROUP BY c.name, sl.code, et.code, ap.name
     ORDER BY sl.code, c.name, ap.name, et.code
  `, [TENANT_ID]);

  console.log(`Total grades : ${gradeCounts.rows.reduce((sum, r) => sum + r.grade_count, 0)}`);
  for (const r of gradeCounts.rows) {
    console.log(`  • [${r.level_code}] ${r.class_name} | ${r.period_name || '—'} | ${r.eval_type || '—'} | grades=${r.grade_count}`);
  }

  await client.end();
}

main().catch(err => { console.error('❌', err); process.exit(1); });
