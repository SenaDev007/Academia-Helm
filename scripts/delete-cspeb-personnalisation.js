/**
 * Vérifie et supprime la personnalisation du site institutionnel du tenant CSPEB
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const TENANT_SLUG = 'cspeb-eveildafriqueeducation';

async function main() {
  const client = await pool.connect();
  console.log('✓ Connexion réussie\n');

  try {
    // 1. Trouver le tenant CSPEB
    const tenant = await client.query(`
      SELECT id, name, slug, subdomain, status
      FROM tenants
      WHERE slug = $1 OR subdomain = $1
    `, [TENANT_SLUG]);

    if (tenant.rows.length === 0) {
      console.log('✗ Aucun tenant trouvé avec slug:', TENANT_SLUG);
      return;
    }

    const t = tenant.rows[0];
    console.log('=== Tenant trouvé ===');
    console.log(`  ID: ${t.id}`);
    console.log(`  Nom: ${t.name}`);
    console.log(`  Slug: ${t.slug}`);
    console.log(`  Statut: ${t.status}\n`);

    const tenantId = t.id;

    // 2. Vérifier l'état actuel avant suppression
    console.log('=== État actuel de la personnalisation ===\n');

    // TenantWebsite (camelCase)
    const website = await client.query(`
      SELECT id, "heroTitle", "heroIsActive", "presentationIsActive",
             "admissionsIsActive", "schoolLifeIsActive", "customColors",
             "isActive", "aiEnabled", "footerIsActive"
      FROM tenant_websites
      WHERE "tenantId" = $1
    `, [tenantId]);

    if (website.rows.length > 0) {
      console.log('■ tenant_websites: 1 ligne trouvée');
      console.log('  heroTitle:', website.rows[0].heroTitle);
      console.log('  customColors:', website.rows[0].customColors);
      console.log('  aiEnabled:', website.rows[0].aiEnabled);
      console.log('  isActive:', website.rows[0].isActive);
    } else {
      console.log('■ tenant_websites: aucune ligne');
    }

    // Theme settings (snake_case)
    const theme = await client.query(`
      SELECT theme_id, mode FROM tenant_theme_settings WHERE tenant_id = $1
    `, [tenantId]);
    console.log(`■ tenant_theme_settings: ${theme.rows.length} ligne(s)`);
    if (theme.rows.length > 0) {
      console.log('  theme_id:', theme.rows[0].theme_id);
      console.log('  mode:', theme.rows[0].mode);
    }

    // Block selections (snake_case)
    const blocks = await client.query(`
      SELECT category, variant_id, color_overrides
      FROM tenant_block_selections WHERE tenant_id = $1
    `, [tenantId]);
    console.log(`■ tenant_block_selections: ${blocks.rows.length} ligne(s)`);
    blocks.rows.forEach(b => {
      console.log(`  - ${b.category}: ${b.variant_id}${b.color_overrides ? ' (avec overrides)' : ''}`);
    });

    // Collections
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM tenant_news_articles WHERE "tenantId" = $1) AS news,
        (SELECT COUNT(*) FROM tenant_events WHERE "tenantId" = $1) AS events,
        (SELECT COUNT(*) FROM tenant_gallery_items WHERE "tenantId" = $1) AS gallery,
        (SELECT COUNT(*) FROM tenant_testimonials WHERE "tenantId" = $1) AS testimonials,
        (SELECT COUNT(*) FROM tenant_faq_items WHERE "tenantId" = $1) AS faq,
        (SELECT COUNT(*) FROM tenant_contact_messages WHERE "tenantId" = $1) AS contact
    `, [tenantId]);
    console.log('■ Collections:');
    console.log('  Actualités:', counts.rows[0].news);
    console.log('  Événements:', counts.rows[0].events);
    console.log('  Galerie:', counts.rows[0].gallery);
    console.log('  Témoignages:', counts.rows[0].testimonials);
    console.log('  FAQ:', counts.rows[0].faq);
    console.log('  Messages contact:', counts.rows[0].contact);

    // 3. Demander confirmation (automatique via argument)
    const shouldDelete = process.argv.includes('--confirm');
    if (!shouldDelete) {
      console.log('\n⚠ Pour supprimer la personnalisation, relancez avec --confirm');
      return;
    }

    // 4. Suppression
    console.log('\n=== Suppression de la personnalisation ===\n');

    // 4a. Supprimer les collections (contenu créé par le directeur)
    const delNews = await client.query(`DELETE FROM tenant_news_articles WHERE "tenantId" = $1`, [tenantId]);
    console.log(`✓ Actualités supprimées: ${delNews.rowCount} ligne(s)`);
    const delEvents = await client.query(`DELETE FROM tenant_events WHERE "tenantId" = $1`, [tenantId]);
    console.log(`✓ Événements supprimés: ${delEvents.rowCount} ligne(s)`);
    const delGallery = await client.query(`DELETE FROM tenant_gallery_items WHERE "tenantId" = $1`, [tenantId]);
    console.log(`✓ Galerie supprimée: ${delGallery.rowCount} ligne(s)`);
    const delTestimonials = await client.query(`DELETE FROM tenant_testimonials WHERE "tenantId" = $1`, [tenantId]);
    console.log(`✓ Témoignages supprimés: ${delTestimonials.rowCount} ligne(s)`);
    const delFaq = await client.query(`DELETE FROM tenant_faq_items WHERE "tenantId" = $1`, [tenantId]);
    console.log(`✓ FAQ supprimée: ${delFaq.rowCount} ligne(s)`);
    // On garde les messages de contact reçus (ce sont des messages de visiteurs, pas de la personnalisation)
    console.log('✓ Messages de contact conservés (messages reçus, pas de la personnalisation)');

    // 4b. Supprimer la config TenantWebsite (toute la personnalisation)
    const delWebsite = await client.query(`DELETE FROM tenant_websites WHERE "tenantId" = $1`, [tenantId]);
    console.log(`✓ Config TenantWebsite supprimée: ${delWebsite.rowCount} ligne(s)`);

    // 4c. Supprimer le thème choisi
    const delTheme = await client.query(`DELETE FROM tenant_theme_settings WHERE tenant_id = $1`, [tenantId]);
    console.log(`✓ Thème supprimé: ${delTheme.rowCount} ligne(s)`);

    // 4d. Supprimer les sélections de composants
    const delBlocks = await client.query(`DELETE FROM tenant_block_selections WHERE tenant_id = $1`, [tenantId]);
    console.log(`✓ Sélections de composants supprimées: ${delBlocks.rowCount} ligne(s)`);

    console.log('\n=== Suppression terminée ===');
    console.log('Le site institutionnel du tenant CSPEB est maintenant remis à l\'état par défaut.');
    console.log('Toutes les sections afficheront le contenu Academia Helm par défaut.');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
