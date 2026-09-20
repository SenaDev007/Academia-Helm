/**
 * ============================================================================
 * apply-tenant-website-cms-migration.js
 * ============================================================================
 * Applique la migration 20260920120000_extend_tenant_website_cms sur la DB Neon.
 *
 * Cette migration ajoute toutes les colonnes nécessaires pour que TOUT le site
 * institutionnel soit modifiable depuis le CMS (programmes, corps enseignant,
 * étapes d'admission, documents requis, logos partenaires, navigation,
 * horaires, titres/sous-titres de toutes les sections, et stats dynamiques).
 *
 * Usage :
 *   cd apps/api-server
 *   node ../scripts/apply-tenant-website-cms-migration.js
 *
 * Prérequis : DATABASE_URL doit être définie dans apps/api-server/.env
 * ============================================================================
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERREUR: DATABASE_URL n\'est pas définie');
    console.error('   Veuillez créer apps/api-server/.env avec DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const migrationFile = path.join(
    __dirname,
    '..',
    'apps/api-server/prisma/migrations/20260920120000_extend_tenant_website_cms/migration.sql'
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
      console.log('Récapitulatif des colonnes ajoutées (idempotent) :');
      console.log('  - programs, programsTitle, programsSubtitle, programsIsActive');
      console.log('  - differentiators, differentiatorsIsActive');
      console.log('  - faculty, facultyTitle, facultySubtitle, facultyIsActive, facultyRatio');
      console.log('  - admissionSteps, admissionTitle, admissionSubtitle, admissionDocuments');
      console.log('  - partnerLogos, partnerLogosIsActive');
      console.log('  - navLinks');
      console.log('  - schoolHoursWeekdays, schoolHoursSaturday, schoolHoursIsActive');
      console.log('  - testimonialsTitle, testimonialsSubtitle, testimonialsIsActive');
      console.log('  - contactTitle, contactSubtitle, contactIsActive');
      console.log('  - newsTitle, newsSubtitle, newsIsActive');
      console.log('  - galleryTitle, gallerySubtitle, galleryIsActive');
      console.log('  - presentationSubtitle');
      console.log('  - statsMode, dynamicStatsConfig');
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
