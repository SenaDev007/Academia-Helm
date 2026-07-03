/**
 * Exécute la migration update_fee_type_enum.sql sur Neon DB.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const sqlPath = path.join(__dirname, '..', 'apps', 'api-server', 'prisma', 'migrations', '20260703130000_update_fee_type_enum.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Connecté à Neon DB');

    // Vérifier les valeurs actuelles de l'enum
    const { rows: beforeEnum } = await client.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'FeeType'
      ORDER BY e.enumsortorder
    `);
    console.log('\nEnum FeeType AVANT :');
    beforeEnum.forEach(r => console.log(`  - ${r.enumlabel}`));

    // Compter les données existantes par type
    const { rows: beforeData } = await client.query(`
      SELECT "feeType", COUNT(*) as count
      FROM "fee_structures"
      GROUP BY "feeType"
      ORDER BY "feeType"
    `);
    console.log('\nDonnées AVANT :');
    beforeData.forEach(r => console.log(`  - ${r.feeType}: ${r.count}`));

    // Exécuter la migration
    // Note: ALTER TYPE ... ADD VALUE ne peut pas être dans une transaction
    // On exécute statement par statement
    console.log('\nExécution de la migration...');

    // 1. Ajouter CANTEEN
    try {
      await client.query(`ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'CANTEEN'`);
      console.log('  ✓ CANTEEN ajouté');
    } catch (e) { console.log('  ℹ CANTEEN:', e.message); }

    // 2. Ajouter AMANTS
    try {
      await client.query(`ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'AMANTS'`);
      console.log('  ✓ AMANTS ajouté');
    } catch (e) { console.log('  ℹ AMANTS:', e.message); }

    // 3. Ajouter OTHER
    try {
      await client.query(`ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'OTHER'`);
      console.log('  ✓ OTHER ajouté');
    } catch (e) { console.log('  ℹ OTHER:', e.message); }

    // 4. Migrer les données existantes
    const r1 = await client.query(`UPDATE "fee_structures" SET "feeType" = 'CANTEEN' WHERE "feeType" = 'ANNEX'`);
    console.log(`  ✓ ${r1.rowCount} ligne(s) ANNEX → CANTEEN`);

    const r2 = await client.query(`UPDATE "fee_structures" SET "feeType" = 'AMANTS' WHERE "feeType" = 'EXCEPTIONAL'`);
    console.log(`  ✓ ${r2.rowCount} ligne(s) EXCEPTIONAL → AMANTS`);

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
    if (err.detail) console.error('  Détail :', err.detail);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Connexion fermée');
  }
}

main();
