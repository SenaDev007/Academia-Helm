import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Find tables that link students to classes
console.log('[A] Tables that might link students to classes:');
const tabs = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND (table_name LIKE '%enrollment%' OR table_name LIKE '%student_class%' OR table_name LIKE '%student%class%' OR table_name LIKE '%class_student%')
  ORDER BY table_name
`);
for (const r of tabs.rows) console.log('  -', r.table_name);

// Check student_enrollments table
console.log('\n[B] student_enrollments columns:');
const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='student_enrollments' ORDER BY ordinal_position
`);
console.log('  Columns:', cols.rows.map(r => r.column_name).join(', '));

// Show enrollments for CP class (find CP class id)
const cpRes = await client.query(`
  SELECT c.id, c.name FROM classes c
  WHERE c."tenantId"='59b8c348-ae5f-4d67-8fbd-af6aefa1f394' AND c.name LIKE 'CP%'
  ORDER BY c.name LIMIT 5
`);
console.log('\n[C] CP-like classes:', cpRes.rows.map(r => `${r.name} (${r.id.substring(0,8)})`).join(', '));

// Show how evaluations link to students (via grades)
console.log('\n[D] How Maternelle 1 evaluations link to students:');
const evals = await client.query(`
  SELECT e.id, e.title, COUNT(g.id)::int AS grade_count
  FROM evaluations e
  JOIN classes c ON c.id = e."classId"
  LEFT JOIN grades g ON g."evaluationId" = e.id
  WHERE c.name = 'Maternelle 1'
  GROUP BY e.id, e.title LIMIT 5
`);
for (const r of evals.rows) console.log(`  • ${r.title.substring(0,40)} — ${r.grade_count} grades`);

// For first eval, show students via grades
if (evals.rows.length > 0) {
  const evalId = evals.rows[0].id;
  console.log(`\n[E] Students linked to eval ${evalId.substring(0,8)} via grades:`);
  const studs = await client.query(`
    SELECT s.id, s."firstName", s."lastName", s.gender, s.matricule
    FROM grades g
    JOIN students s ON s.id = g."studentId"
    WHERE g."evaluationId" = $1
    LIMIT 10
  `, [evalId]);
  for (const s of studs.rows) console.log(`  • ${s.lastName} ${s.firstName} (${s.gender}) matricule=${s.matricule||'—'} id=${s.id.substring(0,8)}`);
}

// Check student_enrollments sample
console.log('\n[F] student_enrollments sample (CP class):');
if (cpRes.rows.length > 0) {
  const enrollments = await client.query(`
    SELECT * FROM student_enrollments WHERE "classId" = $1 LIMIT 10
  `, [cpRes.rows[0].id]);
  for (const r of enrollments.rows) console.log('  -', r);
  console.log(`  Total: ${enrollments.rowCount}`);
}

// Check academic_classes — maybe it was renamed
console.log('\n[G] All tables starting with "academic":');
const ac = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'academic%' ORDER BY table_name
`);
for (const r of ac.rows) console.log('  -', r.table_name);

// Show the academic_class_id from class table
console.log('\n[H] classes with officialClassId (alternative identifier):');
const clsOff = await client.query(`
  SELECT id, name, "officialClassId", "schoolLevelId" FROM classes
  WHERE "tenantId"='59b8c348-ae5f-4d67-8fbd-af6aefa1f394' AND "officialClassId" IS NOT NULL
  ORDER BY name LIMIT 10
`);
for (const r of clsOff.rows) console.log(`  • ${r.name} — officialClassId=${r.officialClassId}`);

await client.end();
