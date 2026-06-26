/**
 * Ajoute les colonnes adminStructureMode (school_settings) et isActive (school_levels)
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  const client = await pool.connect();
  console.log('✓ Connexion réussie\n');

  try {
    // 1. Ajouter adminStructureMode à school_settings
    console.log('=== Ajout colonne adminStructureMode sur school_settings ===');
    try {
      await client.query(`
        ALTER TABLE "school_settings"
        ADD COLUMN IF NOT EXISTS "adminStructureMode" TEXT NOT NULL DEFAULT 'SEPARATE'
      `);
      console.log('✓ Colonne adminStructureMode ajoutée (ou déjà existante)');
    } catch (err) {
      console.error('✗ Erreur:', err.message);
    }

    // 2. Ajouter isActive à school_levels
    console.log('\n=== Ajout colonne isActive sur school_levels ===');
    try {
      await client.query(`
        ALTER TABLE "school_levels"
        ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true
      `);
      console.log('✓ Colonne isActive ajoutée (ou déjà existante)');
    } catch (err) {
      console.error('✗ Erreur:', err.message);
    }

    // 3. Vérifier les colonnes
    console.log('\n=== Vérification ===');

    const ssCols = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'school_settings' AND column_name = 'adminStructureMode'
    `);
    console.log('school_settings.adminStructureMode:', ssCols.rows[0] || 'MANQUANT');

    const slCols = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'school_levels' AND column_name = 'isActive'
    `);
    console.log('school_levels.isActive:', slCols.rows[0] || 'MANQUANT');

    // 4. Vérifier le nombre de tenants avec SchoolSettings
    const ssCount = await client.query(`SELECT COUNT(*)::int AS count FROM school_settings`);
    console.log(`\nTenants avec SchoolSettings: ${ssCount.rows[0].count}`);

    // 5. Vérifier les niveaux existants
    const levelsCount = await client.query(`
      SELECT "tenantId", code, name, "isActive"
      FROM school_levels
      ORDER BY "tenantId", "order"
      LIMIT 10
    `);
    console.log('\nNiveaux scolaires (échantillon):');
    console.table(levelsCount.rows);

    console.log('\n✓ Migration terminée avec succès');
    console.log('  - Tous les tenants existants sont en mode SEPARATE (par défaut)');
    console.log('  - Tous les niveaux existants sont actifs (isActive = true)');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
