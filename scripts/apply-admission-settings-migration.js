/**
 * ============================================================================
 * apply-admission-settings-migration.js
 * ============================================================================
 * Applique la migration 20260925130000_add_admission_settings sur la DB Neon.
 * Crée 3 tables : admission_settings, admission_steps, admission_documents.
 * ============================================================================
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERREUR: DATABASE_URL n\'est pas définie');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const migrationFile = path.join(
    __dirname,
    '..',
    'apps/api-server/prisma/migrations/20260925130000_add_admission_settings/migration.sql'
  );

  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Fichier de migration introuvable: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log('📄 Migration SQL chargée:', migrationFile);
  console.log('🔗 Connexion à la base de données...');

  try {
    const client = await pool.connect();
    try {
      console.log('▶️  Exécution de la migration...');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✅ Migration appliquée avec succès !');
      console.log('');
      console.log('Tables créées (idempotent) :');
      console.log('  - admission_settings (config globale par tenant)');
      console.log('  - admission_steps (étapes d\'admission)');
      console.log('  - admission_documents (documents requis)');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur pendant la migration:', err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Connexion à la DB échouée:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
