const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Check what 82417850 is (from timetable config)
  const eduLevel = await client.query(`SELECT id, name FROM education_levels WHERE id = '82417850-f9cc-4be6-8a6b-370db5509e11'`);
  console.log('Education level (config):', JSON.stringify(eduLevel.rows));
  
  // Check school_levels for this tenant
  const schoolLevels = await client.query(`SELECT id, name, code FROM school_levels WHERE "tenantId" = $1`, [TENANT_ID]);
  console.log('School levels:', JSON.stringify(schoolLevels.rows, null, 2));
  
  // Check what schoolLevelId the classes use
  const classLevels = await client.query(`
    SELECT DISTINCT c."schoolLevelId", sl.name 
    FROM classes c 
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE c."tenantId" = $1
  `, [TENANT_ID]);
  console.log('Class school levels:', JSON.stringify(classLevels.rows, null, 2));
  
  // Check what schoolLevelId subjects use
  const subjectLevels = await client.query(`
    SELECT DISTINCT s."schoolLevelId", sl.name 
    FROM subjects s 
    LEFT JOIN school_levels sl ON sl.id = s."schoolLevelId"
    WHERE s."tenantId" = $1
  `, [TENANT_ID]);
  console.log('Subject school levels:', JSON.stringify(subjectLevels.rows, null, 2));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
