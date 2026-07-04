/**
 * Exécute la migration add_custom_fee_type_label.sql sur Neon DB.
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

    await client.query(`
      ALTER TABLE "fee_structures"
        ADD COLUMN IF NOT EXISTS "customFeeTypeLabel" TEXT
    `);
    console.log('✓ Colonne customFeeTypeLabel ajoutée à fee_structures');

    await client.query(`
      COMMENT ON COLUMN "fee_structures"."customFeeTypeLabel" IS
      'Libellé personnalisé du type de frais (utilisé uniquement quand feeType = OTHER). Ex: "Transport".'
    `);
    console.log('✓ Commentaire ajouté');

    // Vérification
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fee_structures'
        AND column_name = 'customFeeTypeLabel'
    `);
    console.log('\nVérification :');
    rows.forEach(r => console.log(`  - ${r.column_name} : ${r.data_type} | nullable=${r.is_nullable}`));

  } catch (err) {
    console.error('✗ Erreur :', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Connexion fermée');
  }
}

main();
