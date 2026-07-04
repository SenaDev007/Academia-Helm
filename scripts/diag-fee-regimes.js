/**
 * Diagnostic : vérifie les régimes et les school_levels pour identifier le souci
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    // 1. Tous les school_levels avec leur UUID
    console.log('\n=== school_levels (tous) ===');
    const sl = await client.query('SELECT id, code, name FROM school_levels ORDER BY code');
    for (const row of sl.rows) {
      console.log(`  ${row.code.padEnd(12)} | ${row.id} | ${row.name || ''}`);
    }

    // 2. Tous les education_levels (pour comparaison)
    console.log('\n=== education_levels (actifs) ===');
    const el = await client.query("SELECT id, name, \"isEnabled\" FROM education_levels WHERE \"isEnabled\" != false ORDER BY name");
    for (const row of el.rows) {
      console.log(`  ${row.name.padEnd(12)} | ${row.id}`);
    }

    // 3. Tous les fee_regimes
    console.log('\n=== fee_regimes (tous) ===');
    const fr = await client.query(`
      SELECT fr.id, fr.code, fr.label, fr."schoolLevelId", fr."academicYearId", fr."tenantId",
             sl.code AS sl_code
      FROM fee_regimes fr
      LEFT JOIN school_levels sl ON sl.id = fr."schoolLevelId"
      ORDER BY fr."academicYearId", fr."schoolLevelId"
    `);
    console.log(`  Total: ${fr.rows.length} régimes`);
    for (const row of fr.rows) {
      const slCode = row.sl_code || '❌ ORPHELIN';
      console.log(`  [${row.code}] ${row.label} | schoolLevel=${slCode} | schoolLevelId=${row.schoolLevelId.substring(0, 8)}...`);
    }

    // 4. Années académiques actives
    console.log('\n=== academic_years ===');
    const ay = await client.query('SELECT id, name, "isActive" FROM academic_years ORDER BY name');
    for (const row of ay.rows) {
      console.log(`  ${row.name.padEnd(12)} | isActive=${row.isActive} | ${row.id}`);
    }

    // 5. Tenants
    console.log('\n=== tenants ===');
    const t = await client.query('SELECT id, name FROM tenants ORDER BY name LIMIT 5');
    for (const row of t.rows) {
      console.log(`  ${row.name.padEnd(30)} | ${row.id}`);
    }

  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
