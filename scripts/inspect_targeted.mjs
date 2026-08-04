/**
 * Quick targeted inspection:
 *  - Find the right "school levels" table (school_levels vs education_levels)
 *  - Map schoolLevelId values used in classes/evaluations to their actual codes
 *  - Find tenant e0aaa032's situation (active year, classes, evaluation_types, evaluations)
 *  - Check class_subjects structure (academicClassId vs classId)
 *  - Check if grades have evaluationId properly linked (so we can backfill periodId)
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const SEP = '═'.repeat(80);
console.log(SEP); console.log('TARGETED INSPECTION'); console.log(SEP);

// Find tables that might hold school levels
console.log('\n[A] TABLES LIKELY RELATED TO SCHOOL LEVELS');
const candidateTables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name LIKE '%level%' OR table_name LIKE '%school%')
  ORDER BY table_name
`);
for (const r of candidateTables.rows) console.log(`  - ${r.table_name}`);

// Check school_levels table
console.log('\n[B] school_levels TABLE — COLUMNS');
const slCols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'school_levels' ORDER BY ordinal_position
`);
for (const c of slCols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type}`);

console.log('\n[C] school_levels ROWS');
const slRows = await client.query(`SELECT * FROM school_levels ORDER BY "tenantId", name`);
for (const r of slRows.rows) console.log(`  • id=${r.id.substring(0,8)} code=${r.code||'—'} name=${r.name} tenant=${r.tenantId?.substring(0,8)||'—'}`);

// Show distinct schoolLevelId values used in classes
console.log('\n[D] DISTINCT schoolLevelId in classes (with counts)');
const distinctLevels = await client.query(`
  SELECT "schoolLevelId", COUNT(*)::int AS cnt
  FROM classes GROUP BY "schoolLevelId" ORDER BY cnt DESC
`);
for (const r of distinctLevels.rows) console.log(`  • schoolLevelId=${r.schoolLevelId?.substring(0,8)||'NULL'} → ${r.cnt} classes`);

// Show evaluations distribution by tenant
console.log('\n[E] EVALUATIONS PER TENANT');
const evalByTenant = await client.query(`
  SELECT e."tenantId", t.name AS tenant_name, COUNT(*)::int AS cnt,
         COUNT(*) FILTER (WHERE e."teacherId" IS NULL)::int AS null_teacher
  FROM evaluations e LEFT JOIN tenants t ON t.id = e."tenantId"
  GROUP BY e."tenantId", t.name ORDER BY cnt DESC
`);
for (const r of evalByTenant.rows) console.log(`  • [${r.tenant_name?.substring(0,30)}] ${r.cnt} evals (null teacher: ${r.null_teacher})`);

// Show evaluations for tenant e0aaa032 specifically
console.log('\n[F] TENANT e0aaa032 — EVALUATIONS');
const e0evals = await client.query(`
  SELECT COUNT(*)::int AS cnt FROM evaluations WHERE "tenantId" = 'e0aaa032'
`);
console.log(`  • Total: ${e0evals.rows[0].cnt}`);

// Check tenant e0aaa032's academic year & periods
console.log('\n[G] TENANT e0aaa032 — ACADEMIC YEARS & PERIODS');
const e0years = await client.query(`
  SELECT id, name, "isActive" FROM academic_years WHERE "tenantId" = 'e0aaa032'
`);
for (const y of e0years.rows) console.log(`  • ${y.name} (${y.id.substring(0,8)}) active=${y.isActive}`);
const e0periods = await client.query(`
  SELECT id, name, type FROM academic_periods WHERE "tenantId" = 'e0aaa032'
`);
console.log(`  Periods: ${e0periods.rowCount}`);
for (const p of e0periods.rows) console.log(`    • ${p.name} (${p.type})`);

// Check tenant e0aaa032's evaluation_types
console.log('\n[H] TENANT e0aaa032 — EVALUATION TYPES');
const e0types = await client.query(`
  SELECT code, name, "schoolLevelId" FROM evaluation_types WHERE "tenantId" = 'e0aaa032'
`);
console.log(`  Total: ${e0types.rowCount}`);
for (const t of e0types.rows) console.log(`  • [${t.code}] ${t.name} level=${t.schoolLevelId?.substring(0,8)||'NULL'}`);

// Check class_subjects structure
console.log('\n[I] class_subjects COLUMNS');
const csCols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'class_subjects' ORDER BY ordinal_position
`);
for (const c of csCols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type}`);

console.log('\n[J] class_subjects SAMPLE (first 10)');
const csSample = await client.query(`
  SELECT * FROM class_subjects LIMIT 10
`);
for (const r of csSample.rows) console.log('  -', r);

// Check if grades have evaluationId (so we can backfill periodId)
console.log('\n[K] GRADES — BACKFILL CHECK (can we derive periodId from evaluation?)');
const gradesBackfillCheck = await client.query(`
  SELECT
    COUNT(*)::int AS total_grades,
    COUNT(*) FILTER (WHERE g."periodId" IS NULL)::int AS null_period,
    COUNT(*) FILTER (WHERE g."evaluationId" IS NOT NULL)::int AS has_eval,
    COUNT(*) FILTER (WHERE g."evaluationId" IS NOT NULL AND e."periodId" IS NOT NULL)::int AS can_backfill
  FROM grades g LEFT JOIN evaluations e ON e.id = g."evaluationId"
`);
console.log('  ', gradesBackfillCheck.rows[0]);

// Show distribution of evaluations by trimester + class
console.log('\n[L] EVALUATIONS DISTRIBUTION — by class × period × type');
const evalDist = await client.query(`
  SELECT c.name AS class_name, ap.name AS period, et.code AS type_code,
         COUNT(*)::int AS cnt
  FROM evaluations e
  LEFT JOIN classes c ON c.id = e."classId"
  LEFT JOIN academic_periods ap ON ap.id = e."periodId"
  LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
  GROUP BY c.name, ap.name, et.code
  ORDER BY c.name, ap.name, et.code
  LIMIT 50
`);
for (const r of evalDist.rows) {
  console.log(`  • [${r.class_name}] ${r.period} × ${r.type_code} = ${r.cnt}`);
}

await client.end();
console.log(`\n${SEP}\nEND\n${SEP}`);
