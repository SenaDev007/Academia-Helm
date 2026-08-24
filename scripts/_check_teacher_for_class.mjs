import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Find teacher for class "Maternelle 1" (2f2b0dd1)
console.log('=== Teacher for Maternelle 1 ===');
const r = await client.query(`
  SELECT DISTINCT t.id, t."firstName", t."lastName", t.email,
         u.email AS user_email,
         s."firstName" AS staff_first, s."lastName" AS staff_last
  FROM teacher_class_assignments tca
  JOIN teachers t ON t.id = tca."teacherId"
  LEFT JOIN users u ON u.email = t.email
  LEFT JOIN staff s ON s.email = t.email
  WHERE tca."classId" = '2f2b0dd1-e41e-4876-aea5-5750f7e076ef'
  LIMIT 5
`);
console.log(JSON.stringify(r.rows, null, 2));

// Find class info with classTeacherName
console.log('\n=== Classes with classTeacherName column? ===');
const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'classes' AND column_name LIKE '%eacher%' OR column_name LIKE '%itulaire%'
`);
console.log(JSON.stringify(cols.rows, null, 2));

await client.end();
