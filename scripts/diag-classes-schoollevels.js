/**
 * Vérifie quel schoolLevelId est utilisé par les classes (pour comprendre l'API /api/school-levels)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('\n=== Classes avec leur schoolLevelId et schoolLevel.code ===');
    const result = await client.query(`
      SELECT c.id, c.name, c."schoolLevelId", sl.code AS sl_code
      FROM classes c
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
      ORDER BY sl.code, c.name
      LIMIT 30
    `);
    for (const row of result.rows) {
      console.log(`  ${row.sl_code.padEnd(12)} | schoolLevelId=${String(row.schoolLevelId).substring(0, 8)}... | ${row.name}`);
    }
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
