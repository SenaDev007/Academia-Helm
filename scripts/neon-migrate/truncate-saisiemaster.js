// Truncate toutes les tables SaisieMaster pour reprendre les tests proprement
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  console.log('🔌 Connexion à Neon...');
  await client.connect();
  console.log('✅ Connecté');

  // Compter avant suppression
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM saisiemaster_prospects) AS prospects,
      (SELECT COUNT(*) FROM saisiemaster_sessions) AS sessions,
      (SELECT COUNT(*) FROM saisiemaster_testimonials) AS testimonials;
  `);
  console.log('\n📊 Avant truncate:');
  console.log(`   - saisiemaster_prospects:     ${counts.rows[0].prospects}`);
  console.log(`   - saisiemaster_sessions:      ${counts.rows[0].sessions}`);
  console.log(`   - saisiemaster_testimonials:  ${counts.rows[0].testimonials}`);

  // TRUNCATE CASCADE : supprime tout + les FK dépendantes
  console.log('\n🗑️  TRUNCATE des 3 tables (CASCADE)...');
  await client.query(`
    TRUNCATE TABLE
      saisiemaster_testimonials,
      saisiemaster_sessions,
      saisiemaster_prospects
    CASCADE;
  `);
  console.log('✅ Truncate terminé');

  // Vérifier après
  const afterCounts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM saisiemaster_prospects) AS prospects,
      (SELECT COUNT(*) FROM saisiemaster_sessions) AS sessions,
      (SELECT COUNT(*) FROM saisiemaster_testimonials) AS testimonials;
  `);
  console.log('\n📊 Après truncate:');
  console.log(`   - saisiemaster_prospects:     ${afterCounts.rows[0].prospects}`);
  console.log(`   - saisiemaster_sessions:      ${afterCounts.rows[0].sessions}`);
  console.log(`   - saisiemaster_testimonials:  ${afterCounts.rows[0].testimonials}`);

  await client.end();
  console.log('\n✅ Done — tables vidées, prêt pour les tests');
}

main().catch((err) => {
  console.error('❌ Échec:', err.message);
  if (err.detail) console.error('   Detail:', err.detail);
  process.exit(1);
});
