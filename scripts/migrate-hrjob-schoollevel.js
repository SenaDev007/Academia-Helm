const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});
async function main() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "schoolLevelCode" TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_hr_jobs_tenant_schoollevel" ON "hr_jobs" ("tenantId", "schoolLevelCode")`);
    console.log('✓ hr_jobs.schoolLevelCode ajouté + index créé');
  } finally { client.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
