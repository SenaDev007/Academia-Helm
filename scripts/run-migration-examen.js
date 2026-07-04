/**
 * Exécute la migration fix_fee_type_amants_to_examen.sql sur Neon DB.
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Connecté à Neon DB');

    // Vérifier l'enum avant
    const { rows: beforeEnum } = await client.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'FeeType'
      ORDER BY e.enumsortorder
    `);
    console.log('\nEnum FeeType AVANT :');
    beforeEnum.forEach(r => console.log(`  - ${r.enumlabel}`));

    // 1. Ajouter EXAMEN
    try {
      await client.query(`ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'EXAMEN'`);
      console.log('\n✓ EXAMEN ajouté à l\'enum');
    } catch (e) { console.log('  ℹ EXAMEN:', e.message); }

    // 2. Migrer les données AMANTS → EXAMEN
    const r = await client.query(`UPDATE "fee_structures" SET "feeType" = 'EXAMEN' WHERE "feeType" = 'AMANTS'`);
    console.log(`✓ ${r.rowCount} ligne(s) AMANTS → EXAMEN`);

    // Vérification finale
    const { rows: afterEnum } = await client.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'FeeType'
      ORDER BY e.enumsortorder
    `);
    console.log('\nEnum FeeType APRÈS :');
    afterEnum.forEach(r => console.log(`  - ${r.enumlabel}`));

    const { rows: afterData } = await client.query(`
      SELECT "feeType", COUNT(*) as count
      FROM "fee_structures"
      GROUP BY "feeType"
      ORDER BY "feeType"
    `);
    console.log('\nDonnées APRÈS :');
    afterData.forEach(r => console.log(`  - ${r.feeType}: ${r.count}`));

  } catch (err) {
    console.error('✗ Erreur :', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Connexion fermée');
  }
}

main();
