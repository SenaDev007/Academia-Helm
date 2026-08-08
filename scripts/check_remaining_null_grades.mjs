import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[A] Grades with NULL periodId — breakdown by evaluation period:');
const r = await client.query(`
  SELECT e."periodId", ap.name AS period_name, ap."academicYearId",
         COUNT(g.id)::int AS grade_count
  FROM grades g
  JOIN evaluations e ON e.id = g."evaluationId"
  LEFT JOIN academic_periods ap ON ap.id = e."periodId"
  WHERE g."periodId" IS NULL AND g."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  GROUP BY e."periodId", ap.name, ap."academicYearId"
  ORDER BY grade_count DESC
`);
for (const row of r.rows) {
  console.log(`  • period=${row.period_name||'NULL'} (id=${row.periodId?.substring(0,8)||'NULL'}, year=${row.academicYearId?.substring(0,8)||'NULL'}) → ${row.grade_count} grades`);
}

console.log('\n[B] Quarters available for tenant 59b8c348:');
const q = await client.query(`
  SELECT q.id, q.name, q.number, q."academicYearId", ay.name AS year_name
  FROM quarters q
  LEFT JOIN academic_years ay ON ay.id = q."academicYearId"
  WHERE q."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY q."academicYearId", q.number
`);
for (const row of q.rows) {
  console.log(`  • Q#${row.number} ${row.name} (year=${row.year_name}) id=${row.id.substring(0,8)}`);
}

console.log('\n[C] Academic periods for tenant 59b8c348:');
const ap = await client.query(`
  SELECT ap.id, ap.name, ap.type, ap."academicYearId", ay.name AS year_name
  FROM academic_periods ap
  LEFT JOIN academic_years ay ON ay.id = ap."academicYearId"
  WHERE ap."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY ap."academicYearId", ap."startDate"
`);
for (const row of ap.rows) {
  console.log(`  • ${row.name} (${row.type}) year=${row.year_name} id=${row.id.substring(0,8)}`);
}

await client.end();
