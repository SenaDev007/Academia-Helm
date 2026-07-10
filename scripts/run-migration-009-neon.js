/**
 * Applique la migration 009 (student_photos.studentId @unique) sur Neon
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'apps', 'api-server', 'migrations', '009_student_photo_unique.sql'), 'utf8');
  console.log('Migration 009 :\n', sql.substring(0, 200), '...\n');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('✅ Migration 009 appliquée avec succès');
    // Vérifier
    const r = await c.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'student_photos'`);
    console.log('Indexes après migration :', r.rows.map(x => x.indexname));
  } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error('Erreur:', e); process.exit(1); });
