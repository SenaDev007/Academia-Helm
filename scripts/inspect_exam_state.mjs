/**
 * Inspect current state of the exam module data:
 *  - tenants + education_levels
 *  - academic_years + academic_periods
 *  - classes (per level)
 *  - subjects (per level)
 *  - evaluation_types (per tenant/level)
 *  - evaluations + their teacherId/periodId/classId/subjectId distribution
 *  - grades count + their periodId status
 *  - teacher_class_assignments
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const SEP = '═'.repeat(80);
console.log(SEP);
console.log('INSPECTION — Exam Module Current State');
console.log(SEP);

// 1. Tenants
console.log('\n[1] TENANTS');
const tenants = await client.query(`
  SELECT id, name, status, "createdAt"
  FROM tenants ORDER BY name LIMIT 10
`);
for (const t of tenants.rows) console.log(`  • ${t.name} (${t.id.substring(0,8)}) — ${t.status}`);

// 2. Education levels per tenant
console.log('\n[2] EDUCATION LEVELS per tenant');
const levels = await client.query(`
  SELECT el.id, el.name, el."tenantId", t.name AS tenant_name
  FROM education_levels el JOIN tenants t ON t.id = el."tenantId"
  WHERE el."isEnabled" = true ORDER BY t.name, el.name
`);
for (const l of levels.rows) console.log(`  • [${l.tenant_name.substring(0,20)}] ${l.name} — id=${l.id.substring(0,8)}`);

// 3. Academic years
console.log('\n[3] ACADEMIC YEARS');
const years = await client.query(`
  SELECT id, name, "tenantId", "isActive", "startDate", "endDate"
  FROM academic_years ORDER BY "startDate" DESC LIMIT 20
`);
for (const y of years.rows) console.log(`  • ${y.name} (${y.id.substring(0,8)}) active=${y.isActive} tenant=${y.tenantId.substring(0,8)}`);

// 4. Academic periods
console.log('\n[4] ACADEMIC PERIODS (first 20)');
const periods = await client.query(`
  SELECT id, name, type, "academicYearId", "startDate", "endDate", "tenantId"
  FROM academic_periods ORDER BY "startDate" LIMIT 20
`);
for (const p of periods.rows) console.log(`  • ${p.name} (${p.id.substring(0,8)}) type=${p.type} year=${p.academicYearId?.substring(0,8)} tenant=${p.tenantId?.substring(0,8)}`);

// 5. Classes (per level) — discover columns first
console.log('\n[5a] CLASSES TABLE COLUMNS');
const classCols = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'classes' ORDER BY ordinal_position
`);
for (const c of classCols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type}`);

console.log('\n[5b] CLASSES (first 30)');
const classes = await client.query(`
  SELECT c.id, c.name, c."tenantId", c."schoolLevelId",
         el.name AS level_name
  FROM classes c
  LEFT JOIN education_levels el ON el.id = c."schoolLevelId"
  ORDER BY el.name, c.name LIMIT 30
`);
for (const c of classes.rows) {
  console.log(`  • [${c.level_name||'—'}] ${c.name} — id=${c.id.substring(0,8)} level=${c.schoolLevelId?.substring(0,8)||'NULL'}`);
}

// 6. Subjects (per level)
console.log('\n[6] SUBJECTS (first 30)');
const subjects = await client.query(`
  SELECT id, name, code, "tenantId", "schoolLevelId", language
  FROM subjects ORDER BY name LIMIT 30
`);
for (const s of subjects.rows) console.log(`  • ${s.name} (${s.code||'—'}) — lang=${s.language||'—'} level=${s.schoolLevelId?.substring(0,8)||'NULL'}`);

// 7. Evaluation types
console.log('\n[7] EVALUATION TYPES');
const evalTypes = await client.query(`
  SELECT id, name, code, "tenantId", "schoolLevelId", "isSystem"
  FROM evaluation_types ORDER BY code LIMIT 30
`);
for (const et of evalTypes.rows) console.log(`  • [${et.code}] ${et.name} — tenant=${et.tenantId.substring(0,8)} level=${et.schoolLevelId?.substring(0,8)||'NULL'} sys=${et.isSystem}`);

// 8. Evaluations summary
console.log('\n[8] EVALUATIONS — STATUS BREAKDOWN');
const evalStats = await client.query(`
  SELECT status, COUNT(*)::int AS count
  FROM evaluations GROUP BY status ORDER BY count DESC
`);
for (const s of evalStats.rows) console.log(`  • ${s.status.padEnd(20)} = ${s.count}`);

console.log('\n[8b] EVALUATIONS — NULL FIELD COUNTS');
const nullCounts = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "teacherId" IS NULL)::int AS null_teacher,
    COUNT(*) FILTER (WHERE "periodId" IS NULL)::int AS null_period,
    COUNT(*) FILTER (WHERE "classId" IS NULL)::int AS null_class,
    COUNT(*) FILTER (WHERE "subjectId" IS NULL)::int AS null_subject,
    COUNT(*) FILTER (WHERE "evaluationTypeId" IS NULL)::int AS null_type,
    COUNT(*) FILTER (WHERE "academicYearId" IS NULL)::int AS null_year
  FROM evaluations
`);
console.log('  ', nullCounts.rows[0]);

console.log('\n[8c] EVALUATIONS — SAMPLE (first 10)');
const evalSample = await client.query(`
  SELECT e.id, e.title, e.status,
         et.code AS type_code, et.name AS type_name,
         c.name AS class_name, s.name AS subject_name,
         ap.name AS period_name,
         e."teacherId", e."academicYearId", e."tenantId"
  FROM evaluations e
  LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
  LEFT JOIN classes c ON c.id = e."classId"
  LEFT JOIN subjects s ON s.id = e."subjectId"
  LEFT JOIN academic_periods ap ON ap.id = e."periodId"
  LIMIT 10
`);
for (const e of evalSample.rows) {
  console.log(`  • [${e.type_code||'—'}] ${e.title||e.type_name||'(no title)'} — class=${e.class_name||'—'} subj=${e.subject_name||'—'} period=${e.period_name||'NULL'} teacher=${e.teacherId?.substring(0,8)||'NULL'} status=${e.status}`);
}

// 9. Grades summary
console.log('\n[9] GRADES — NULL FIELD COUNTS');
const gradeStats = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "periodId" IS NULL)::int AS null_period,
    COUNT(*) FILTER (WHERE "evaluationId" IS NULL)::int AS null_eval,
    COUNT(*) FILTER (WHERE "studentId" IS NULL)::int AS null_student,
    COUNT(*) FILTER (WHERE "subjectId" IS NULL)::int AS null_subject
  FROM grades
`);
console.log('  ', gradeStats.rows[0]);

// 10. Teacher class assignments
console.log('\n[10] TEACHER_CLASS_ASSIGNMENTS TABLE COLUMNS');
const tcaCols = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'teacher_class_assignments' ORDER BY ordinal_position
`);
for (const c of tcaCols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type}`);

console.log('\n[10b] TEACHER_CLASS_ASSIGNMENTS (first 20)');
const tca = await client.query(`
  SELECT tca.id, tca."teacherId", tca."classId", tca."academicYearId",
         u.email AS teacher_email, c.name AS class_name
  FROM teacher_class_assignments tca
  LEFT JOIN users u ON u.id = tca."teacherId"
  LEFT JOIN classes c ON c.id = tca."classId"
  LIMIT 20
`);
for (const t of tca.rows) {
  console.log(`  • ${t.teacher_email||t.teacherId?.substring(0,8)} → class=${t.class_name||'—'}`);
}
console.log(`  Total teacher_class_assignments: ${tca.rowCount}`);

// 11. Classes by level counts
console.log('\n[11] CLASSES COUNT BY LEVEL');
const classByLevel = await client.query(`
  SELECT el.name AS level, COUNT(*)::int AS count
  FROM classes c LEFT JOIN education_levels el ON el.id = c."schoolLevelId"
  GROUP BY el.name ORDER BY el.name
`);
for (const r of classByLevel.rows) console.log(`  • ${r.level||'NULL'}: ${r.count}`);

// 12. class_subjects
console.log('\n[12] CLASS_SUBJECTS — NULL FIELD COUNTS');
const cs = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "classId" IS NULL)::int AS null_class,
    COUNT(*) FILTER (WHERE "academicClassId" IS NULL)::int AS null_acad_class,
    COUNT(*) FILTER (WHERE "subjectId" IS NULL)::int AS null_subject
  FROM class_subjects
`);
console.log('  ', cs.rows[0]);

console.log(`\n${SEP}`);
console.log('END OF INSPECTION');
console.log(SEP);
await client.end();
