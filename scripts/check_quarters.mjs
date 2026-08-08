import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[A] quarters table columns:');
const cols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='quarters' ORDER BY ordinal_position
`);
for (const c of cols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type}`);

console.log('\n[B] quarters table rows:');
const rows = await client.query(`
  SELECT * FROM quarters ORDER BY "academicYearId", name
`);
for (const r of rows.rows) console.log('  -', r);

console.log('\n[C] academic_periods table rows (for comparison):');
const ap = await client.query(`
  SELECT id, name, type, "academicYearId" FROM academic_periods
  WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY "academicYearId", name
`);
for (const r of ap.rows) console.log('  -', r);

console.log('\n[D] grades_periodId_fkey constraint definition:');
const fk = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conname = 'grades_periodId_fkey'
`);
for (const r of fk.rows) console.log('  ', r.def);

console.log('\n[E] evaluations_periodId_fkey constraint definition:');
const fk2 = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conname = 'evaluations_periodId_fkey'
`);
for (const r of fk2.rows) console.log('  ', r.def);

await client.end();
