import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'report_cards'
  ORDER BY ordinal_position
`);
console.log(JSON.stringify(r.rows, null, 2));

console.log('\n=== Sample data (CSPEB, current year) ===');
const sample = await client.query(`
  SELECT id, type, status, "quarterId", "studentId", "schoolLevelId", 
         "directorSignedAt", "distributedToTeacherAt", "teacherSignedAt",
         "directorSignature" IS NOT NULL AS has_dir_sig,
         "teacherSignature" IS NOT NULL AS has_tea_sig
  FROM report_cards
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
    AND status = 'TEACHER_DISTRIBUTED'
  LIMIT 5
`);
console.log(JSON.stringify(sample.rows, null, 2));

console.log('\n=== Distinct "type" values for CSPEB report_cards ===');
const types = await client.query(`
  SELECT type, COUNT(*)::int AS n
  FROM report_cards
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  GROUP BY type
`);
console.log(JSON.stringify(types.rows, null, 2));

console.log('\n=== Distinct quarters (periods) for CSPEB ===');
const quarters = await client.query(`
  SELECT q.id, q.name, COUNT(rc.id)::int AS rc_count
  FROM report_cards rc
  LEFT JOIN quarters q ON q.id = rc."quarterId"
  WHERE rc."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND rc."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  GROUP BY q.id, q.name
  ORDER BY q.name
`);
console.log(JSON.stringify(quarters.rows, null, 2));

await client.end();
