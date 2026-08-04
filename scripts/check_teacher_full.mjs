import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Get full teacherId values
console.log('[A] Full teacherId values in evaluations:');
const td = await client.query(`
  SELECT DISTINCT "teacherId" FROM evaluations WHERE "teacherId" IS NOT NULL
`);
for (const r of td.rows) console.log(`  • ${r.teacherId}`);

console.log('\n[B] Full teacherId values in TCA:');
const tca = await client.query(`
  SELECT DISTINCT "teacherId" FROM teacher_class_assignments
`);
for (const r of tca.rows) console.log(`  • ${r.teacherId}`);

// staff table columns
console.log('\n[C] staff table columns:');
const sc = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='staff' ORDER BY ordinal_position
`);
console.log('  ' + sc.rows.map(r => r.column_name).join(', '));

// Look up these IDs in staff table
console.log('\n[D] Looking up teacherIds in staff:');
for (const tid of td.rows) {
  const s = await client.query(`SELECT id, "firstName", "lastName" FROM staff WHERE id = $1`, [tid.teacherId]);
  console.log(`  • ${tid.teacherId} → staff: ${s.rowCount > 0 ? `${s.rows[0].lastName} ${s.rows[0].firstName}` : 'NOT FOUND'}`);
}

// Show the 18 PLANNED evaluations and what teacherId they should get
console.log('\n[E] 18 PLANNED evaluations with NULL teacherId + their class → TCA mapping:');
const planned = await client.query(`
  SELECT e.id, e.title, e."classId", c.name AS class_name,
         et.code AS type_code, ap.name AS period,
         s.name AS subject_name, s.code AS subject_code
  FROM evaluations e
  LEFT JOIN classes c ON c.id = e."classId"
  LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
  LEFT JOIN academic_periods ap ON ap.id = e."periodId"
  LEFT JOIN subjects s ON s.id = e."subjectId"
  WHERE e."teacherId" IS NULL
`);
console.log(`Total: ${planned.rowCount}`);
for (const r of planned.rows) {
  // Try to find TCA for this class
  const tcaForClass = await client.query(`
    SELECT DISTINCT "teacherId" FROM teacher_class_assignments WHERE "classId" = $1
  `, [r.classId]);
  const teachers = tcaForClass.rows.map(t => t.teacherId?.substring(0,8)).join(', ');
  console.log(`  • [${r.class_name}] ${r.type_code}/${r.period} — subj=${r.subject_name} → suggested teacher: ${teachers || 'NO TCA'}`);
}

await client.end();
