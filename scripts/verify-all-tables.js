/**
 * Vérification exhaustive de toutes les tables CMS + multi-niveaux en BDD Neon
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const TABLES = [
  // CMS institutionnel (tenant-website)
  'tenant_websites',
  'tenant_news_articles',
  'tenant_events',
  'tenant_gallery_items',
  'tenant_testimonials',
  'tenant_faq_items',
  'tenant_contact_messages',
  // Multi-niveaux — sections par niveau
  'tenant_website_level_sections',
  // Thèmes
  'tenant_theme_settings',
  // Sélections de composants CMS
  'tenant_block_selections',
  // Bibliothèque médias
  'tenant_media',
  // Affectations administratives level-aware
  'staff_admin_assignments',
  // CMS plateforme (global)
  'blog_articles',
  'cms_pages',
  'legal_pages',
  'seo_meta',
  'media_assets',
];

const COLUMNS_TO_CHECK = [
  { table: 'school_settings', column: 'adminStructureMode' },
  { table: 'school_levels', column: 'isActive' },
  { table: 'hr_jobs', column: 'schoolLevelCode' },
];

async function main() {
  const client = await pool.connect();
  console.log('✓ Connexion réussie\n');

  try {
    let found = 0, missing = 0;

    console.log('=== VÉRIFICATION DES TABLES ===\n');
    for (const table of TABLES) {
      const res = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) AS exists`,
        [table]
      );
      const exists = res.rows[0]?.exists;
      if (exists) {
        const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`).catch(() => ({ rows: [{ count: '?' }] }));
        const count = countRes.rows[0]?.count ?? '?';
        console.log(`✓ ${table.padEnd(40)} EXISTS (${count} lignes)`);
        found++;
      } else {
        console.log(`✗ ${table.padEnd(40)} MISSING`);
        missing++;
      }
    }

    console.log(`\n=== TABLES: ${found}/${TABLES.length} trouvées, ${missing} manquantes ===\n`);

    console.log('=== VÉRIFICATION DES COLONNES ===\n');
    for (const { table, column } of COLUMNS_TO_CHECK) {
      const res = await client.query(
        `SELECT column_name, data_type, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      );
      if (res.rows.length > 0) {
        console.log(`✓ ${table}.${column} : ${res.rows[0].data_type} (default: ${res.rows[0].column_default || 'none'})`);
      } else {
        console.log(`✗ ${table}.${column} : MISSING`);
      }
    }

    console.log('\n=== VÉRIFICATION DES INDEX ===\n');
    const indexes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE indexname IN (
        'idx_staff_admin_assignments_tenant_staff',
        'idx_staff_admin_assignments_tenant_level',
        'idx_staff_admin_assignments_tenant_role_active',
        'idx_tenant_website_level_sections_tenant_level',
        'idx_tenant_theme_settings_tenant',
        'idx_tenant_block_selections_tenant',
        'idx_tenant_media_tenant_created',
        'idx_tenant_media_tenant_folder',
        'idx_hr_jobs_tenant_schoollevel'
      )
      ORDER BY tablename, indexname
    `);
    for (const idx of indexes.rows) {
      console.log(`✓ ${idx.tablename}.${idx.indexname}`);
    }

    console.log('\n=== RÉSUMÉ FINAL ===');
    console.log(`Tables: ${found}/${TABLES.length}`);
    console.log(`Colonnes vérifiées: ${COLUMNS_TO_CHECK.length}`);
    console.log(`Index vérifiés: ${indexes.rows.length}`);

    if (missing === 0) {
      console.log('\n✅ TOUTES LES TABLES SONT PRÉSENTES EN BDD');
    } else {
      console.log(`\n⚠️  ${missing} TABLE(S) MANQUANTE(S)`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
