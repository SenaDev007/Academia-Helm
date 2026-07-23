/**
 * Verify evaluations backend CRUD - DB inspection script.
 * Run with: node /home/z/my-project/scripts/verify_evaluations_db.mjs
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const SEP = '='.repeat(80);
console.log(SEP);
console.log('VERIFICATION: Evaluations CRUD — Neon DB inspection');
console.log(SEP);

// 1. Table existence
console.log('\n[1] TABLE EXISTENCE');
const tables = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('evaluations','evaluation_types','grade_scales','academic_periods','exam_calculation_rules')
   ORDER BY table_name;`,
);
for (const r of tables.rows) console.log(`  ✓ ${r.table_name}`);
if (tables.rows.length === 0) console.log('  ⚠️  None of the expected tables exist!');

// 2. evaluations schema
console.log('\n[2] evaluations TABLE SCHEMA');
const evalCols = await client.query(
  `SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'evaluations'
   ORDER BY ordinal_position;`,
);
for (const c of evalCols.rows) {
  console.log(
    `  - ${c.column_name.padEnd(22)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}  default=${c.column_default || '—'}`,
  );
}

// 3. evaluation_types schema
console.log('\n[3] evaluation_types TABLE SCHEMA');
const typeCols = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'evaluation_types' ORDER BY ordinal_position;`,
);
for (const c of typeCols.rows) {
  console.log(`  - ${c.column_name.padEnd(22)} ${c.data_type}`);
}

// 4. grade_scales schema
console.log('\n[4] grade_scales TABLE SCHEMA');
const scaleCols = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'grade_scales' ORDER BY ordinal_position;`,
);
for (const c of scaleCols.rows) {
  console.log(`  - ${c.column_name.padEnd(22)} ${c.data_type}`);
}

// 5. Count evaluations
console.log('\n[5] EVALUATIONS COUNT');
const evalCount = await client.query('SELECT COUNT(*)::int AS count FROM evaluations;');
console.log(`  ${evalCount.rows[0].count} row(s)`);

// 6. List evaluation_types
console.log('\n[6] evaluation_types ROWS');
const types = await client.query('SELECT * FROM evaluation_types LIMIT 20;');
if (types.rows.length === 0) {
  console.log('  ⚠️  evaluation_types table is EMPTY — no default types seeded!');
} else {
  for (const t of types.rows) console.log('  -', t);
}

// 7. List grade_scales
console.log('\n[7] grade_scales ROWS');
const scales = await client.query('SELECT * FROM grade_scales LIMIT 20;');
if (scales.rows.length === 0) {
  console.log('  ⚠️  grade_scales table is EMPTY!');
} else {
  for (const s of scales.rows) console.log('  -', s);
}

// 8. List academic_periods
console.log('\n[8] academic_periods ROWS (first 20)');
const periods = await client.query('SELECT * FROM academic_periods LIMIT 20;');
if (periods.rows.length === 0) {
  console.log('  ⚠️  academic_periods table is EMPTY!');
} else {
  for (const p of periods.rows) console.log('  -', p);
}

// 9. Sample evaluations joined
console.log('\n[9] EVALUATIONS JOINED WITH TYPE/CLASS/SUBJECT (first 10)');
const sample = await client.query(
  `SELECT e.id, e.title, e.status, e."evaluationDate", e."maxScore", e.coefficient,
          et.name AS type_name, c.name AS class_name, s.name AS subject_name
   FROM evaluations e
   LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
   LEFT JOIN classes c ON c.id = e."classId"
   LEFT JOIN subjects s ON s.id = e."subjectId"
   LIMIT 10;`,
);
if (sample.rows.length === 0) {
  console.log('  ⚠️  No evaluation row to inspect.');
} else {
  for (const e of sample.rows) console.log('  -', e);
}

// 10. Distinct statuses present
console.log('\n[10] DISTINCT status VALUES in evaluations');
const statuses = await client.query(
  `SELECT status, COUNT(*)::int AS count FROM evaluations GROUP BY status ORDER BY count DESC;`,
);
if (statuses.rows.length === 0) {
  console.log('  (table empty — no status to show)');
} else {
  for (const s of statuses.rows) console.log(`  - ${s.status.padEnd(20)} ${s.count}`);
}

// 11. Tenants that have at least one evaluation_type
console.log('\n[11] TENANTS WITH evaluation_types (first 10)');
const tenantTypes = await client.query(
  `SELECT "tenantId", COUNT(*)::int AS type_count
   FROM evaluation_types GROUP BY "tenantId" ORDER BY type_count DESC LIMIT 10;`,
);
if (tenantTypes.rows.length === 0) {
  console.log('  ⚠️  No tenant has any evaluation_type.');
} else {
  for (const t of tenantTypes.rows) console.log(`  - tenant=${t.tenantId}  types=${t.type_count}`);
}

console.log(`\n${SEP}`);
console.log('END OF VERIFICATION');
console.log(SEP);

await client.end();
