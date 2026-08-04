import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Distinct teacherId in evaluations
console.log('[A] Distinct teacherId in evaluations:');
const td = await client.query(`
  SELECT "teacherId", COUNT(*)::int AS cnt
  FROM evaluations WHERE "teacherId" IS NOT NULL
  GROUP BY "teacherId" ORDER BY cnt DESC
`);
for (const r of td.rows) console.log(`  • teacherId=${r.teacherId?.substring(0,12)} → ${r.cnt} evals`);

// Check if these teacherIds exist in staff table
console.log('\n[B] Check if teacherIds exist in staff table:');
const staffCols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='staff' AND column_name IN ('id','userId','matricule','employeeId','staffId')
`);
console.log('  staff cols:', staffCols.rows.map(r => r.column_name).join(', '));

// Check distinct teacherId in TCA
console.log('\n[C] Distinct teacherId in teacher_class_assignments:');
const tcaTd = await client.query(`
  SELECT "teacherId", COUNT(*)::int AS cnt
  FROM teacher_class_assignments
  GROUP BY "teacherId" ORDER BY cnt DESC
`);
for (const r of tcaTd.rows) console.log(`  • teacherId=${r.teacherId?.substring(0,12)} → ${r.cnt} assignments`);

// Try to find these IDs anywhere
const teacherIds = ['11518938', '9ed8201c-3eb9-4efb-a328-2b0ef52f5cf6', '77324610-6f88-4c4b-9e2c-3a4c1b3f9a6e'];
console.log('\n[D] Looking for teacherId 11518938 in users table:');
const u1 = await client.query(`SELECT id, email, role FROM users WHERE id = $1 OR id LIKE $2`, ['11518938', '11518938%']);
console.log(`  Found: ${u1.rowCount}`);
for (const r of u1.rows) console.log('  -', r);

console.log('\n[E] Looking for teacherId 9ed8201c in users table:');
const u2 = await client.query(`SELECT id, email, role FROM users WHERE id LIKE $1`, ['9ed8201c%']);
console.log(`  Found: ${u2.rowCount}`);
for (const r of u2.rows) console.log('  -', r);

console.log('\n[F] Looking for 9ed8201c in staff table:');
const s1 = await client.query(`SELECT * FROM staff WHERE id LIKE $1 OR "userId" LIKE $1`, ['9ed8201c%']);
console.log(`  Found: ${s1.rowCount}`);
for (const r of s1.rows) console.log('  -', r);

// Look at the 18 PLANNED evaluations with NULL teacherId
console.log('\n[G] 18 PLANNED evaluations with NULL teacherId:');
const planned = await client.query(`
  SELECT e.id, e.title, e.status, c.name AS class_name, s.name AS subject_name
  FROM evaluations e
  LEFT JOIN classes c ON c.id = e."classId"
  LEFT JOIN subjects s ON s.id = e."subjectId"
  WHERE e."teacherId" IS NULL
`);
for (const r of planned.rows) {
  console.log(`  • ${r.title?.substring(0,40)} — class=${r.class_name} subj=${r.subject_name} id=${r.id.substring(0,8)}`);
}

await client.end();
