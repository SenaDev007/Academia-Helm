import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('Evaluations per PRIMAIRE class:');
const r = await client.query(`
  SELECT c.name,
    COUNT(DISTINCT e.id)::int AS eval_count,
    COUNT(DISTINCT CASE WHEN e.status = 'VALIDATED' THEN e.id END)::int AS validated,
    COUNT(DISTINCT CASE WHEN e."teacherId" IS NULL THEN e.id END)::int AS null_teacher
  FROM classes c
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  LEFT JOIN evaluations e ON e."classId" = c.id
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  GROUP BY c.name ORDER BY c.name
`);
for (const row of r.rows) {
  console.log(`  • ${row.name}: ${row.eval_count} evals (validated=${row.validated}, null_teacher=${row.null_teacher})`);
}

console.log('\nGrades per class:');
const g = await client.query(`
  SELECT c.name, COUNT(g.id)::int AS grade_count
  FROM classes c
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  LEFT JOIN evaluations e ON e."classId" = c.id
  LEFT JOIN grades g ON g."evaluationId" = e.id
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  GROUP BY c.name ORDER BY c.name
`);
for (const row of g.rows) {
  console.log(`  • ${row.name}: ${row.grade_count} grades`);
}

console.log('\nTotal evaluations:');
const total = await client.query(`SELECT COUNT(*)::int AS cnt FROM evaluations WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'`);
console.log(`  ${total.rows[0].cnt}`);

console.log('\nTotal grades:');
const tg = await client.query(`SELECT COUNT(*)::int AS cnt, COUNT(*) FILTER (WHERE "periodId" IS NULL)::int AS null_period FROM grades WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'`);
console.log(`  ${tg.rows[0].cnt} (null periodId: ${tg.rows[0].null_period})`);

await client.end();
