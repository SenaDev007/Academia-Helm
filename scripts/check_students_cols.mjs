import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='students' AND column_name LIKE '%lass%' ORDER BY column_name
`);
console.log('students class-related cols:', r.rows.map(x => x.column_name));

// also class_subjects structure for primary
const r2 = await client.query(`
  SELECT cs."academicClassId", cs."subjectId", cs."classId", s.name,
         c.name AS class_name
  FROM class_subjects cs
  JOIN subjects s ON s.id = cs."subjectId"
  LEFT JOIN classes c ON c.id = cs."classId"
  WHERE cs."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  LIMIT 20
`);
console.log('class_subjects sample:');
for (const r of r2.rows) console.log('  -', r);

// academic_classes structure
try {
  const r3 = await client.query(`SELECT * FROM academic_classes LIMIT 5`);
  console.log('academic_classes sample:');
  for (const r of r3.rows) console.log('  -', r);
} catch (e) {
  console.log('academic_classes error:', e.message);
}
await client.end();
