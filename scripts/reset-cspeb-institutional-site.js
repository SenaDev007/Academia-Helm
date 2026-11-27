/**
 * reset-cspeb-institutional-site.js — 2026-11-27
 *
 * Demande promoteur : « tu vas prendre l'école tenante CSTEB qui est dans la
 * base de données, tu vas réinitialiser et supprimer tous les paramétrages
 * pour cette école dans le module institutionnel, tu vas tout supprimer de
 * la base de données. »
 *
 * (En base, l'école est CSPEB — Complexe Scolaire La Pépinière de l'Éveil /
 *  l'Éveil Ballade ? — retrouvée par slug/subdomain ILIKE '%cspeb%'.)
 *
 * Supprime POUR CE TENANT uniquement :
 *   - tenant_websites            (tout le paramétrage CMS : hero, chiffres,
 *                                  mots, présentation, couleurs custom…)
 *   - tenant_website_level_sections (sections par niveau)
 *   - tenant_news_articles       (actualités)
 *   - tenant_events              (agenda)
 *   - tenant_gallery_items       (galerie)
 *   - tenant_testimonials        (témoignages)
 *   - tenant_faq_items           (FAQ)
 *   - tenant_contact_messages    (messages reçus via le formulaire)
 *   - tenant_theme_settings      (thème choisi dans l'onglet Thèmes)
 *
 * Après exécution, le site public de l'école retombe sur les valeurs par
 * défaut Helm (placeholders + palette Helm) — comme une école qui n'a encore
 * rien paramétré. Les AUTRES écoles ne sont pas touchées.
 *
 * Usage : node scripts/reset-cspeb-institutional-site.js [--dry-run]
 */
const { Client } = require('pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const DRY_RUN = process.argv.includes('--dry-run');

// Tables (ordre : collections filles d'abord, puis le paramétrage principal)
const TABLES_TO_CLEAR = [
  ['tenant_website_level_sections', 'Sections par niveau'],
  ['tenant_news_articles', 'Actualités'],
  ['tenant_events', 'Agenda / événements'],
  ['tenant_gallery_items', 'Galerie photos'],
  ['tenant_testimonials', 'Témoignages'],
  ['tenant_faq_items', 'FAQ'],
  ['tenant_contact_messages', 'Messages reçus (formulaire de contact)'],
  ['tenant_websites', 'Paramétrage du site institutionnel (CMS)'],
  ['tenant_theme_settings', 'Thème choisi'],
];

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('✅ Connecté à Neon\n');

  // ── 1. Trouver le tenant CSPEB ──────────────────────────────────────────
  const tenants = await client.query(
    `SELECT id, name, slug, subdomain, status FROM tenants
     WHERE slug ILIKE '%cspeb%' OR subdomain ILIKE '%cspeb%' OR name ILIKE '%cspeb%'
        OR name ILIKE '%eveil%'
     ORDER BY name`,
  );

  if (tenants.rows.length === 0) {
    console.error('❌ Aucun tenant CSPEB trouvé (slug/subdomain/name ILIKE %cspeb% ou %eveil%).');
    await client.end();
    process.exit(1);
  }
  if (tenants.rows.length > 1) {
    console.error('❌ Plusieurs tenants correspondent — préciser :');
    tenants.rows.forEach((t) => console.error(`   - ${t.name} (id=${t.id}, slug=${t.slug})`));
    await client.end();
    process.exit(1);
  }

  const tenant = tenants.rows[0];
  console.log('🏫 École ciblée (réinitialisation du module institutionnel) :');
  console.log(`   • Nom        : ${tenant.name}`);
  console.log(`   • Slug       : ${tenant.slug}`);
  console.log(`   • Sous-domaine : ${tenant.subdomain || '—'}`);
  console.log(`   • Statut     : ${tenant.status}`);
  console.log(`   • Tenant ID  : ${tenant.id}\n`);

  // ── 2. Inventaire AVANT suppression ─────────────────────────────────────
  console.log('📋 État actuel du module institutionnel pour cette école :\n');
  let totalRows = 0;
  for (const [table, label] of TABLES_TO_CLEAR) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id = $1`,
      [tenant.id],
    );
    const n = rows[0].n;
    totalRows += n;
    console.log(`   ${n > 0 ? '🔴' : '⚪'} ${label} (${table}) : ${n} ligne(s)`);
  }
  console.log(`\n   TOTAL : ${totalRows} ligne(s) à supprimer.\n`);

  // Aperçu du paramétrage principal (pour trace)
  const site = await client.query(
    `SELECT hero_title, contact_email, contact_phone, custom_colors, logo_palette
     FROM tenant_websites WHERE tenant_id = $1`,
    [tenant.id],
  );
  if (site.rows[0]) {
    const s = site.rows[0];
    console.log('🔍 Trace du paramétrage actuel (avant suppression) :');
    console.log(`   • hero_title   : ${(s.hero_title || '—').slice(0, 80)}`);
    console.log(`   • contact_email: ${s.contact_email || '—'}`);
    console.log(`   • custom_colors: ${s.custom_colors ? JSON.stringify(s.custom_colors).slice(0, 120) : '—'}`);
    console.log(`   • logo_palette : ${s.logo_palette ? JSON.stringify(s.logo_palette).slice(0, 120) : '—'}\n`);
  }

  if (DRY_RUN) {
    console.log('🧪 DRY-RUN — aucune suppression effectuée. Relancer sans --dry-run pour exécuter.');
    await client.end();
    return;
  }

  // ── 3. Suppression ──────────────────────────────────────────────────────
  console.log('🗑️  Suppression en cours…');
  for (const [table, label] of TABLES_TO_CLEAR) {
    const res = await client.query(
      `DELETE FROM "${table}" WHERE tenant_id = $1`,
      [tenant.id],
    );
    if (res.rowCount > 0) {
      console.log(`   ✅ ${label} : ${res.rowCount} ligne(s) supprimée(s)`);
    }
  }

  // ── 4. Vérification APRÈS ───────────────────────────────────────────────
  console.log('\n🔎 Vérification après suppression :');
  let leftovers = 0;
  for (const [table, label] of TABLES_TO_CLEAR) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id = $1`,
      [tenant.id],
    );
    if (rows[0].n > 0) {
      leftovers += rows[0].n;
      console.log(`   ❌ ${label} : ${rows[0].n} ligne(s) RESTANTE(S) !`);
    }
  }
  if (leftovers === 0) {
    console.log('   ✅ Toutes les tables sont vides pour ce tenant — module institutionnel réinitialisé.');
  }

  console.log('\n➡️  Le site public de l\'école affiche désormais les valeurs par défaut Helm');
  console.log('    (placeholders + palette Helm), comme une école non paramétrée.');
  console.log('    Le module Site Institutionnel de l\'app repart d\'une base vierge.');

  await client.end();
}

main().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
