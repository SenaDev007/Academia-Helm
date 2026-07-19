const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const r = await client.query(`
    SELECT slug, name FROM tenants 
    WHERE name ILIKE '%eveil%' OR name ILIKE '%afrique%' OR slug ILIKE '%eveil%'
    LIMIT 5
  `);
  console.log('Tenants:', JSON.stringify(r.rows, null, 2));
  
  const u = await client.query(`
    SELECT email, role, "tenantId" FROM users WHERE email = 'salumerhel2036@gmail.com'
  `);
  console.log('User:', JSON.stringify(u.rows, null, 2));
  
  // Check timetable tables
  const t = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name IN ('timetable_configs', 'timetable_solutions', 'timetable_constraints', 'timetable_entries', 'teacher_availability')
  `);
  console.log('Timetable tables:', JSON.stringify(t.rows.map(r => r.table_name), null, 2));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
