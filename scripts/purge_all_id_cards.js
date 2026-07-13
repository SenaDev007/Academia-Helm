// Script : vide toutes les cartes scolaires (student_id_cards) de la base Neon
// Usage : node /home/z/my-project/scripts/purge_all_id_cards.js

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Connected\n');

    // 1. Compter les cartes avant suppression
    const before = await client.query('SELECT COUNT(*)::int AS total FROM "student_id_cards"');
    console.log(`📊 Cartes scolaires avant suppression : ${before.rows[0].total}`);

    // 2. Supprimer toutes les cartes
    console.log('\n🗑️  Suppression de toutes les cartes scolaires...');
    const result = await client.query('DELETE FROM "student_id_cards"');
    console.log(`✅ ${result.rowCount} carte(s) supprimée(s)`);

    // 3. Vérification
    const after = await client.query('SELECT COUNT(*)::int AS total FROM "student_id_cards"');
    console.log(`\n📊 Cartes scolaires après suppression : ${after.rows[0].total}`);

    console.log('\n🎉 Purge terminée. Vous pouvez maintenant régénérer les cartes avec le nouveau template.');
  } catch (err) {
    console.error('❌ Purge failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected');
  }
}

main();
