/**
 * ============================================================================
 * MIGRATION — Ajout colonne staffId à school_directors (BENIN/CSPEB)
 * ============================================================================
 * L'erreur Prisma P2010 "column staffId of relation school_directors does not exist"
 * signifie que la migration V2 n'a pas été exécutée sur la DB de production.
 * Ce script utilise pg directement pour ajouter la colonne.
 * ============================================================================
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('🔍 Vérification de la colonne staffId dans school_directors...');

  const check = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'school_directors' AND column_name = 'staffId'
  `);

  if (check.rows.length > 0) {
    console.log('✅ La colonne staffId existe déjà.');
  } else {
    console.log('⚠️  La colonne staffId n\'existe pas — ajout en cours...');
    await client.query(`ALTER TABLE school_directors ADD COLUMN IF NOT EXISTS "staffId" TEXT`);
    console.log('✅ Colonne staffId ajoutée avec succès.');
  }

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
