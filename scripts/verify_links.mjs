import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Verify link: class_subjects.academicClassId = classes.officialClassId
console.log('[A] Verify class_subjects.academicClassId → classes.officialClassId:');
const verify = await client.query(`
  SELECT c.name AS class_name, c."officialClassId",
         COUNT(cs.id)::int AS subject_count
  FROM classes c
  JOIN class_subjects cs ON cs."academicClassId" = c."officialClassId"
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  GROUP BY c.name, c."officialClassId"
  ORDER BY c.name
`);
for (const r of verify.rows) console.log(`  • ${r.class_name} — ${r.subject_count} subjects (officialClassId=${r.officialClassId?.substring(0,8)})`);

// Verify link: student_enrollments.classId = classes.id
console.log('\n[B] Verify student_enrollments.classId → classes.id:');
const se = await client.query(`
  SELECT c.name AS class_name, COUNT(se.id)::int AS student_count
  FROM classes c
  JOIN student_enrollments se ON se."classId" = c.id
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
    AND se.status = 'ACTIVE'
  GROUP BY c.name ORDER BY c.name
`);
for (const r of se.rows) console.log(`  • ${r.class_name} — ${r.student_count} students`);

// For PRIMAIRE classes, show class info + subject count + student count
console.log('\n[C] PRIMAIRE classes summary (2026-2027):');
const summary = await client.query(`
  SELECT c.id, c.name, c."officialClassId", c."schoolLevelId",
    (SELECT COUNT(*) FROM class_subjects cs WHERE cs."academicClassId" = c."officialClassId") AS subject_count,
    (SELECT COUNT(*) FROM student_enrollments se WHERE se."classId" = c.id AND se.status = 'ACTIVE') AS student_count,
    (SELECT COUNT(*) FROM evaluations e WHERE e."classId" = c.id) AS evaluation_count
  FROM classes c
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY c.name
`);
for (const r of summary.rows) {
  console.log(`  • ${r.name} — id=${r.id.substring(0,8)} subjects=${r.subject_count} students=${r.student_count} existing_evals=${r.evaluation_count}`);
}

// Show TCA for PRIMAIRE classes (to know teacherId)
console.log('\n[D] Teacher_Class_Assignments for PRIMAIRE classes:');
const tca = await client.query(`
  SELECT tca."teacherId", tca."classId", tca."classSubjectId",
         u.email, u."firstName", u."lastName",
         c.name AS class_name
  FROM teacher_class_assignments tca
  JOIN classes c ON c.id = tca."classId"
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  LEFT JOIN users u ON u.id = tca."teacherId"
  WHERE tca."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY c.name
`);
console.log(`  TCA count: ${tca.rowCount}`);
for (const r of tca.rows) {
  console.log(`  • ${r.class_name} → teacher=${r.email||r.teacherId?.substring(0,8)} (${r.lastName||''} ${r.firstName||''}) classSubject=${r.classSubjectId?.substring(0,8)||'NULL'}`);
}

// Also check for any users with role ENSEIGNANT for this tenant
console.log('\n[E] Users with ENSEIGNANT role for tenant 59b8c348:');
const teachers = await client.query(`
  SELECT u.id, u.email, u."firstName", u."lastName", u.role
  FROM users u
  WHERE u."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND u.role IN ('ENSEIGNANT', 'TEACHER')
  ORDER BY u."lastName"
`);
console.log(`  Count: ${teachers.rowCount}`);
for (const t of teachers.rows) {
  console.log(`  • ${t.lastName||''} ${t.firstName||''} (${t.email}) role=${t.role} id=${t.id.substring(0,8)}`);
}

// Show academic periods for the active year
console.log('\n[F] Academic periods for 2026-2027 (a7593470):');
const periods = await client.query(`
  SELECT id, name, type, "startDate", "endDate"
  FROM academic_periods
  WHERE "academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
  ORDER BY "startDate"
`);
for (const p of periods.rows) {
  console.log(`  • ${p.name} (${p.type}) — ${p.startDate?.toString().substring(0,10)} to ${p.endDate?.toString().substring(0,10)} — id=${p.id.substring(0,8)}`);
}

// Show evaluation_types for PRIMAIRE level
console.log('\n[G] Evaluation types for PRIMAIRE (bc434610):');
const types = await client.query(`
  SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
  FROM evaluation_types
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND "schoolLevelId" = 'bc434610-8cf6-4415-a51a-cc5300cd99da'
  ORDER BY code
`);
for (const t of types.rows) {
  console.log(`  • [${t.code}] ${t.name} — max=${t.defaultMaxScore} coef=${t.defaultCoefficient} id=${t.id.substring(0,8)}`);
}

await client.end();
