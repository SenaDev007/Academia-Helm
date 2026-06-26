const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Trouver le tenant CSPEB
    const tenant = await client.query(`
      SELECT id, name, slug, subdomain, status
      FROM tenants
      WHERE name ILIKE '%CSPEB%' OR name ILIKE '%Éveil%' OR name ILIKE '%Eveil%' OR slug ILIKE '%cspeb%' OR slug ILIKE '%eveil%'
    `);
    console.log('=== Tenants trouvés ===');
    console.table(tenant.rows);

    if (tenant.rows.length === 0) {
      console.log('Aucun tenant CSPEB trouvé');
      return;
    }

    const tenantId = tenant.rows[0].id;
    console.log(`\nTenant ID: ${tenantId}`);

    // 2. Vérifier la config TenantWebsite
    const website = await client.query(`
      SELECT id, tenant_id, "heroTitle", "heroSubtitle", "heroImageUrl", "heroIsActive",
             "presentationTitle", "presentationIsActive",
             "admissionsTitle", "admissionsIsActive",
             "schoolLifeTitle", "schoolLifeIsActive",
             "customColors", "isActive", "aiEnabled",
             "contactEmail", "contactPhone", "contactAddress"
      FROM tenant_websites
      WHERE "tenantId" = $1
    `, [tenantId]);
    console.log('\n=== TenantWebsite config ===');
    console.table(website.rows);

    // 3. Vérifier le thème
    const theme = await client.query(`
      SELECT * FROM tenant_theme_settings WHERE tenant_id = $1
    `, [tenantId]);
    console.log('\n=== Theme settings ===');
    console.table(theme.rows);

    // 4. Vérifier les sélections de blocs
    const blocks = await client.query(`
      SELECT * FROM tenant_block_selections WHERE tenant_id = $1
    `, [tenantId]);
    console.log('\n=== Block selections ===');
    console.table(blocks.rows);

    // 5. Compter les collections
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM tenant_news_articles WHERE "tenantId" = $1) AS news_count,
        (SELECT COUNT(*) FROM tenant_events WHERE "tenantId" = $1) AS events_count,
        (SELECT COUNT(*) FROM tenant_gallery_items WHERE "tenantId" = $1) AS gallery_count,
        (SELECT COUNT(*) FROM tenant_testimonials WHERE "tenantId" = $1) AS testimonials_count,
        (SELECT COUNT(*) FROM tenant_faq_items WHERE "tenantId" = $1) AS faq_count,
        (SELECT COUNT(*) FROM tenant_contact_messages WHERE "tenantId" = $1) AS contact_count
    `, [tenantId]);
    console.log('\n=== Collections counts ===');
    console.table(counts.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
