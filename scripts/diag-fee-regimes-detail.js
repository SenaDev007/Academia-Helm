/**
 * Vérifie les régimes avec détail complet (tenantId + academicYearId)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    // Pour chaque régime, afficher le tenant + academicYear + schoolLevel
    console.log('\n=== fee_regimes avec détails ===');
    const result = await client.query(`
      SELECT fr.id, fr.code, fr.label, fr."tenantId",
             fr."academicYearId", ay.name AS year_name,
             fr."schoolLevelId", sl.code AS sl_code,
             t.name AS tenant_name
      FROM fee_regimes fr
      LEFT JOIN school_levels sl ON sl.id = fr."schoolLevelId"
      LEFT JOIN academic_years ay ON ay.id = fr."academicYearId"
      LEFT JOIN tenants t ON t.id = fr."tenantId"
      ORDER BY t.name, ay.name, sl.code, fr.code
    `);
    for (const row of result.rows) {
      console.log(`  [${row.tenant_name?.substring(0, 15) || '?'}|${row.year_name}] [${row.code}] ${row.label}`);
      console.log(`    tenantId=${row.tenantId.substring(0, 8)}... yearId=${row.academicYearId.substring(0, 8)}... sl=${row.sl_code} slId=${row.schoolLevelId.substring(0, 8)}...`);
    }

    // Vérifier les tenants actifs
    console.log('\n=== tenants ===');
    const tenants = await client.query('SELECT id, name FROM tenants ORDER BY name');
    for (const t of tenants.rows) {
      console.log(`  ${t.name.substring(0, 40).padEnd(42)} | ${t.id}`);
    }
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
