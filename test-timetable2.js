const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Check table names
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%class%' OR table_name LIKE '%subject%' OR table_name LIKE '%teacher%'
    ORDER BY table_name
  `);
  console.log('Tables:', tables.rows.map(r => r.table_name));
  
  // Get timetable config details
  const config = await client.query(`
    SELECT * FROM timetable_configs WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\nTimetable config:', JSON.stringify(config.rows[0], null, 2));
  
  // Check academic_class (with underscore)
  const classes = await client.query(`
    SELECT id, name, code FROM academic_class WHERE "tenantId" = $1 AND "isActive" = true
  `, [TENANT_ID]).catch(() => ({rows: []}));
  console.log('\nAcademic classes:', classes.rows.length);
  classes.rows.forEach(c => console.log('  -', c.id, c.name));
  
  // Check subjects (table name?)
  const subjTables = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%subject%'
  `);
  console.log('\nSubject tables:', subjTables.rows.map(r => r.table_name));
  
  // Check teachers
  const teacherTables = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%teacher%'
  `);
  console.log('Teacher tables:', teacherTables.rows.map(r => r.table_name));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
