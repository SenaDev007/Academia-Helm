/**
 * Exécute la migration SQL directement sur Neon DB via node-postgres.
 * Évite d'attendre le déploiement Fly.io.
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

    // Vérifier si la colonne existe déjà
    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tenant_identity_profiles'
        AND column_name = 'whatsapp'
    `);

    if (rows.length > 0) {
      console.log('ℹ Colonne whatsapp existe déjà dans tenant_identity_profiles');
    } else {
      // Exécuter la migration
      await client.query(`
        ALTER TABLE "tenant_identity_profiles"
          ADD COLUMN IF NOT EXISTS "whatsapp" TEXT
      `);
      console.log('✓ Colonne whatsapp ajoutée à tenant_identity_profiles');

      await client.query(`
        COMMENT ON COLUMN "tenant_identity_profiles"."whatsapp" IS
        'Numéro WhatsApp de l''école au format E.164 (ex: +22997123456). Alimenté via l''onglet Identité du module Paramètres.'
      `);
      console.log('✓ Commentaire ajouté');
    }

    // Vérifier aussi SchoolSettings.whatsapp (devrait déjà exister)
    const { rows: rows2 } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'school_settings'
        AND column_name = 'whatsapp'
    `);
    if (rows2.length > 0) {
      console.log('✓ school_settings.whatsapp existe déjà');
    } else {
      console.log('⚠ school_settings.whatsapp MANQUE — création...');
      await client.query(`ALTER TABLE "school_settings" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT`);
      console.log('✓ school_settings.whatsapp créée');
    }

    // Vérification finale
    const { rows: verify } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE (table_name = 'tenant_identity_profiles' OR table_name = 'school_settings')
        AND column_name = 'whatsapp'
      ORDER BY table_name
    `);
    console.log('\nVérification finale :');
    verify.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

  } catch (err) {
    console.error('✗ Erreur :', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Connexion fermée');
  }
}

main();
