/**
 * Supprimer les education_levels et school_levels orphelins (doublons non utilisés)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // education_levels orphelins (0 students + 0 admissions)
  const orphanEL = [
    'a2283489-2eb9-4f30-b4c5-f1f0b6c3b3d8', // MATERNELLE
    '919c1d3f-d061-479a-b222-52d33f89e27c', // PRIMAIRE
    '99806112-eb62-4d29-925f-56603740f64c', // SECONDAIRE
  ];

  // school_levels orphelins (0 classes + 0 regimes + 0 structures)
  const orphanSL = [
    'cfcc0295-80ed-4d5c-9918-aa700e7ccc3d', // MATERNELLE
    '715228fb-45ff-4675-9c81-2fd110ca288f', // PRIMAIRE
    '375137b4-9708-4215-90f0-c7d9b7f90540', // SECONDAIRE
  ];

  console.log('\n=== Suppression education_levels orphelins ===');
  const elResult = await client.query(`DELETE FROM education_levels WHERE id = ANY($1::text[]) RETURNING id, name`, [orphanEL]);
  console.log(`  - ${elResult.rowCount} education_levels supprimés:`);
  for (const row of elResult.rows) console.log(`    ${row.name}`);

  console.log('\n=== Suppression school_levels orphelins ===');
  const slResult = await client.query(`DELETE FROM school_levels WHERE id = ANY($1::text[]) RETURNING id, code`, [orphanSL]);
  console.log(`  - ${slResult.rowCount} school_levels supprimés:`);
  for (const row of slResult.rows) console.log(`    ${row.code}`);

  // Vérification finale
  console.log('\n=== Vérification finale ===');
  const elFinal = await client.query('SELECT id, name FROM education_levels ORDER BY name');
  console.log(`education_levels restants: ${elFinal.rows.length}`);
  for (const row of elFinal.rows) console.log(`  ${row.name} | ${row.id}`);

  const slFinal = await client.query('SELECT id, code, name FROM school_levels ORDER BY code');
  console.log(`\nschool_levels restants: ${slFinal.rows.length}`);
  for (const row of slFinal.rows) console.log(`  ${row.code} | ${row.id}`);

  await client.end();
}
main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
