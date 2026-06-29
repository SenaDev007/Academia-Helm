const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});
async function main() {
  const client = await pool.connect();
  try {
    // 1. Compter les matières
    const count = await client.query(`SELECT COUNT(*)::int AS count FROM "subjects"`);
    console.log('Total subjects in DB:', count.rows[0].count);

    // 2. Voir les matières avec leur tenantId et academicYearId
    const subjects = await client.query(`
      SELECT s.id, s."tenantId", s."academicYearId", s.code, s.name, s."schoolLevelId",
             sl.code AS level_code, sl.name AS level_name
      FROM "subjects" s
      LEFT JOIN "school_levels" sl ON s."schoolLevelId" = sl.id
      ORDER BY s."createdAt" DESC
      LIMIT 10
    `);
    console.log('\nSubjects (last 10):');
    console.table(subjects.rows);

    // 3. Vérifier les tenants
    const tenants = await client.query(`SELECT id, name, slug FROM tenants LIMIT 5`);
    console.log('\nTenants:');
    console.table(tenants.rows);

    // 4. Vérifier les années scolaires
    const years = await client.query(`SELECT id, name, "tenantId", "isActive" FROM "academic_years" LIMIT 10`);
    console.log('\nAcademic years:');
    console.table(years.rows);
  } finally { client.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
