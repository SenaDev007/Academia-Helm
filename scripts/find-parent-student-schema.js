/**
 * Find tables related to parent-student relationships
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

(async () => {
  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  // Find all tables that mention "parent" or "guardian" or "student" in their name
  console.log('📋 Tables related to parent/student/guardian:');
  const res = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE tablename ILIKE '%parent%' OR tablename ILIKE '%guardian%' OR tablename ILIKE '%student%'
    ORDER BY tablename;
  `);
  for (const r of res.rows) {
    console.log(`   - ${r.tablename}`);
  }

  // For each candidate table, show its columns
  for (const r of res.rows) {
    console.log(`\n📋 Columns of ${r.tablename}:`);
    try {
      const cols = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [r.tablename]);
      for (const c of cols.rows) {
        console.log(`   - ${c.column_name} (${c.data_type})`);
      }
    } catch (e) { console.error(`   Error: ${e.message}`); }
  }

  await client.end();
})();
