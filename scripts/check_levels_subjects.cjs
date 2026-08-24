// Check SchoolLevel + Subject columns format
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  });
  await client.connect();

  // 1. SchoolLevel columns
  const slCols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'school_levels' ORDER BY ordinal_position LIMIT 10;
  `);
  console.log('=== school_levels columns ===');
  for (const r of slCols.rows) console.log(`  ${r.column_name} (${r.data_type})`);

  // 2. Sample school levels
  const slSample = await client.query(`SELECT * FROM "school_levels" LIMIT 5;`);
  console.log(`\n=== school_levels sample (${slSample.rows.length}) ===`);
  for (const r of slSample.rows) console.log(JSON.stringify(r));

  // 3. Subject columns
  const subCols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'subjects' ORDER BY ordinal_position LIMIT 15;
  `);
  console.log('\n=== subjects columns ===');
  for (const r of subCols.rows) console.log(`  ${r.column_name} (${r.data_type})`);

  // 4. Sample subjects
  const subSample = await client.query(`SELECT * FROM "subjects" LIMIT 3;`);
  console.log(`\n=== subjects sample (${subSample.rows.length}) ===`);
  for (const r of subSample.rows) console.log(JSON.stringify(r));

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
