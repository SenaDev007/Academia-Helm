const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Get teacher_class_assignments columns
  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'teacher_class_assignments' ORDER BY ordinal_position
  `);
  console.log('teacher_class_assignments columns:', cols.rows.map(r => r.column_name));
  
  // Get sample data
  const sample = await client.query(`
    SELECT * FROM teacher_class_assignments WHERE "tenantId" = $1 LIMIT 3
  `, [TENANT_ID]);
  console.log('\nSample teacher_class_assignments:', JSON.stringify(sample.rows, null, 2));
  
  // Get class_subjects columns
  const csCols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'class_subjects' ORDER BY ordinal_position
  `);
  console.log('\nclass_subjects columns:', csCols.rows.map(r => r.column_name));
  
  // Get sample class_subjects
  const csSample = await client.query(`
    SELECT * FROM class_subjects WHERE "tenantId" = $1 LIMIT 3
  `, [TENANT_ID]);
  console.log('\nSample class_subjects:', JSON.stringify(csSample.rows, null, 2));
  
  // Get subject_assignments columns
  const saCols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'subject_assignments' ORDER BY ordinal_position
  `);
  console.log('\nsubject_assignments columns:', saCols.rows.map(r => r.column_name));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
