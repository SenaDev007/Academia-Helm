const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});
async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'apps', 'api-server', 'migrations', '010_maternelle_pickup_hours.sql'), 'utf8');
  const c = await pool.connect();
  try { await c.query(sql); console.log('✅ Migration 010 appliquée'); }
  finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
