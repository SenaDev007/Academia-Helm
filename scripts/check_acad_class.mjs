import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Check if academicClassId from class_subjects exists in classes
console.log('[A] class_subjects distinct academicClassId values:');
const acs = await client.query(`
  SELECT DISTINCT "academicClassId", COUNT(*)::int AS subject_count
  FROM class_subjects
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  GROUP BY "academicClassId" ORDER BY subject_count DESC
`);
for (const r of acs.rows) {
  // Check if this academicClassId is in classes table
  const inClasses = await client.query(`SELECT id, name, "academicYearId", "schoolLevelId" FROM classes WHERE id = $1`, [r.academicClassId]);
  const cls = inClasses.rows[0];
  console.log(`  • academicClassId=${r.academicClassId?.substring(0,8)} subjects=${r.subject_count} → in classes: ${cls ? `YES (${cls.name}, year=${cls.academicYearId?.substring(0,8)}, level=${cls.schoolLevelId?.substring(0,8)})` : 'NO'}`);
}

// Show students table columns
console.log('\n[B] students columns related to class:');
const scols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='students' ORDER BY ordinal_position
`);
console.log('  All columns:', scols.rows.map(r => r.column_name).join(', '));

// Show class_subjects unique classId values that are non-null
console.log('\n[C] class_subjects with non-null classId:');
const nonNull = await client.query(`
  SELECT "classId", COUNT(*)::int AS cnt FROM class_subjects
  WHERE "classId" IS NOT NULL GROUP BY "classId"
`);
console.log(`  Non-null classId count: ${nonNull.rowCount}`);

// Show the proper way to link class_subjects to classes (via academicClassId probably)
console.log('\n[D] Link class_subjects → classes via academicClassId:');
const link = await client.query(`
  SELECT cs."academicClassId", c.name AS class_name, c."schoolLevelId",
         sl.code AS level_code, sl.name AS level_name,
         COUNT(cs.id)::int AS subject_count
  FROM class_subjects cs
  JOIN classes c ON c.id = cs."academicClassId"
  LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
  WHERE cs."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  GROUP BY cs."academicClassId", c.name, c."schoolLevelId", sl.code, sl.name
  ORDER BY sl.code, c.name
`);
for (const r of link.rows) {
  console.log(`  • [${r.level_code||'—'}] ${r.class_name} — ${r.subject_count} subjects (academicClassId=${r.academicClassId?.substring(0,8)})`);
}

// Show the student → class link
console.log('\n[E] students count per class (via classId column):');
const studentCount = await client.query(`
  SELECT c.name AS class_name, sl.code AS level_code, COUNT(s.id)::int AS student_count
  FROM students s
  JOIN classes c ON c.id = s."classId"
  LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  GROUP BY c.name, sl.code ORDER BY sl.code, c.name
`);
for (const r of studentCount.rows) {
  console.log(`  • [${r.level_code||'—'}] ${r.class_name} — ${r.student_count} students`);
}

// Find PRIMAIRE classes + their subjects via academicClassId
console.log('\n[F] PRIMAIRE classes + subjects (via academicClassId link):');
const prima = await client.query(`
  SELECT c.id AS class_id, c.name AS class_name, c."academicYearId",
         s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
         s.language, cs.coefficient
  FROM classes c
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  JOIN class_subjects cs ON cs."academicClassId" = c.id
  JOIN subjects s ON s.id = cs."subjectId"
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY c.name, s.name
`);
console.log(`Total rows: ${prima.rowCount}`);
const byClass = {};
for (const r of prima.rows) {
  if (!byClass[r.class_name]) byClass[r.class_name] = [];
  byClass[r.class_name].push(`${r.subject_name} (${r.subject_code})`);
}
for (const [cls, subs] of Object.entries(byClass)) {
  console.log(`  • ${cls}: ${subs.length} subjects — ${subs.slice(0,5).join(', ')}${subs.length > 5 ? '...' : ''}`);
}

await client.end();
