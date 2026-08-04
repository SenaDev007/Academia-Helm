import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[A] grades table columns:');
const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name='grades' ORDER BY ordinal_position
`);
for (const c of cols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable} default=${c.column_default||'—'}`);

console.log('\n[B] grades sample (first 3):');
const sample = await client.query(`SELECT * FROM grades LIMIT 3`);
for (const r of sample.rows) console.log('  -', r);

// Check evaluations table required columns
console.log('\n[C] evaluations table columns (nullable check):');
const ecols = await client.query(`
  SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name='evaluations' AND is_nullable='NO'
  ORDER BY ordinal_position
`);
for (const c of ecols.rows) console.log(`  - ${c.column_name.padEnd(28)} default=${c.column_default||'NONE'}`);

await client.end();
