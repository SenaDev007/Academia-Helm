/**
 * Vérification des tables CMS en BDD Neon
 */
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TABLES_TO_CHECK = [
  // CMS institutionnel (tenant-website)
  'tenant_websites',
  'tenant_news_articles',
  'tenant_events',
  'tenant_gallery_items',
  'tenant_testimonials',
  'tenant_faq_items',
  'tenant_contact_messages',
  // Thèmes
  'tenant_theme_settings',
  // Sélections de composants
  'tenant_block_selections',
  // Bibliothèque médias
  'tenant_media',
  // CMS plateforme (global)
  'blog_articles',
  'cms_pages',
  'legal_pages',
  'seo_meta',
  'media_assets',
];

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  console.log('Connexion à Neon...');
  try {
    const client = await pool.connect();
    console.log('✓ Connexion réussie\n');

    console.log('=== Vérification des tables ===\n');
    let found = 0;
    let missing = 0;

    for (const table of TABLES_TO_CHECK) {
      try {
        const res = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) AS exists`,
          [table]
        );
        const exists = res.rows[0]?.exists;
        if (exists) {
          // Compter les lignes
          const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
          const count = countRes.rows[0]?.count || 0;
          console.log(`✓ ${table.padEnd(30)} EXISTS (${count} lignes)`);
          found++;
        } else {
          console.log(`✗ ${table.padEnd(30)} MISSING`);
          missing++;
        }
      } catch (err) {
        console.log(`⚠ ${table.padEnd(30)} ERROR: ${err.message}`);
        missing++;
      }
    }

    console.log(`\n=== Résumé ===`);
    console.log(`✓ Tables trouvées : ${found}/${TABLES_TO_CHECK.length}`);
    console.log(`✗ Tables manquantes : ${missing}/${TABLES_TO_CHECK.length}`);

    // Pour les tables manquantes, afficher les SQL de création
    if (missing > 0) {
      console.log('\n=== Tables manquantes à créer ===');
    }

    client.release();
  } catch (err) {
    console.error('Erreur de connexion:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
