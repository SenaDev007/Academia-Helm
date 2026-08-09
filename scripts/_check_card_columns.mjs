import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const r = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'tenant_identity_profiles' AND column_name LIKE 'card%'
  ORDER BY column_name
`);
console.log('Existing card columns:', JSON.stringify(r.rows.map(x => x.column_name), null, 2));

const t = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'card_design_templates'
`);
console.log('card_design_templates table exists:', JSON.stringify(t.rows, null, 2));

await client.end();
