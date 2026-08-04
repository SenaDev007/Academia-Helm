import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[A] grades table ALL columns:');
const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name='grades' ORDER BY ordinal_position
`);
for (const c of cols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable} default=${c.column_default||'—'}`);

await client.end();
