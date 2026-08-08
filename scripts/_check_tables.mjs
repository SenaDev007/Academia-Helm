import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND (table_name ILIKE '%staff%' OR table_name ILIKE '%teacher%' OR table_name ILIKE '%user%')
  ORDER BY table_name
`);
console.log(JSON.stringify(r.rows.map(x => x.table_name), null, 2));
await client.end();
