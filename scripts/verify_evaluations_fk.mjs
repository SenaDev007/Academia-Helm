import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('Foreign keys on evaluations table:');
const r = await client.query(`
  SELECT conname, confrelid::regclass AS table_to, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE contype = 'f' AND conrelid = 'evaluations'::regclass;
`);
if (r.rows.length === 0) console.log('  (no FK constraints — periodId/classId/etc are NOT enforced)');
for (const row of r.rows) console.log('  -', row.conname, '→', row.table_to, '|', row.def);

console.log('\nEnum EvaluationStatus values:');
const r3 = await client.query(`
  SELECT e.enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'EvaluationStatus' ORDER BY e.enumsortorder;
`);
for (const row of r3.rows) console.log('  -', row.enumlabel);

console.log('\nQuarter table existence + row count:');
const r4 = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_name IN ('quarters','academic_periods');`,
);
for (const row of r4.rows) console.log('  -', row.table_name, 'exists');
const qcount = await client.query('SELECT COUNT(*)::int AS c FROM quarters');
console.log(`  quarters row count = ${qcount.rows[0].c}`);
const acount = await client.query('SELECT COUNT(*)::int AS c FROM academic_periods');
console.log(`  academic_periods row count = ${acount.rows[0].c}`);

await client.end();
