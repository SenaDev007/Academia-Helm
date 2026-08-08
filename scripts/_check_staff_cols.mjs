import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name IN ('staff', 'teachers', 'users')
  ORDER BY table_name, ordinal_position
`);
console.log(JSON.stringify(r.rows.map(x => x.column_name), null, 2));
await client.end();
