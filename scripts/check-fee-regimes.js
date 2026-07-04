/**
 * Vérification : liste les régimes avec tenant + academicYear pour repérer les doublons
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT fr."id", fr."code", fr."label", fr."tenantId", fr."academicYearId",
             sl."code" AS "schoolLevelCode", ay."name" AS "yearName"
      FROM "fee_regimes" fr
      JOIN "school_levels" sl ON sl."id" = fr."schoolLevelId"
      LEFT JOIN "academic_years" ay ON ay."id" = fr."academicYearId"
      ORDER BY fr."tenantId", sl."code", fr."code";
    `);
    console.log(`📊 ${result.rows.length} régimes valides :`);
    for (const row of result.rows) {
      console.log(`   - [${row.tenantId?.substring(0, 8)}|${row.yearName}] [${row.code}] ${row.label} (${row.schoolLevelCode})`);
    }
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
