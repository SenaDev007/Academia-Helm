/**
 * Script : Applique la migration 014 (tendered_amount + change_given)
 * directement sur la base Neon PostgreSQL.
 *
 * Usage : node scripts/apply-migration-014.js
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_SQL = `
-- Migration 014 : Ajout des champs tenderedAmount + changeGiven à FinanceTransaction
ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS tendered_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS change_given NUMERIC(10, 2);

COMMENT ON COLUMN finance_transactions.tendered_amount IS 'Montant remis par le client en espèces (uniquement pour paymentMethod = CASH). Permet de tracer le reliquat dans le reçu PDF, WhatsApp et SMS.';
COMMENT ON COLUMN finance_transactions.change_given IS 'Reliquat / monnaie rendue au client (calculé côté frontend : tenderedAmount - amount, re-vérifié côté backend).';
`;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔗 Connexion à Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Connecté.');

    // Vérifier l'état avant migration
    const beforeCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'finance_transactions'
        AND column_name IN ('tendered_amount', 'change_given')
      ORDER BY column_name;
    `);

    if (beforeCheck.rows.length > 0) {
      console.log('⚠️  Colonnes déjà présentes avant migration :');
      beforeCheck.rows.forEach((r) => console.log(`   - ${r.column_name} (${r.data_type})`));
    } else {
      console.log('📋 Colonnes tendered_amount / change_given : ABSENTES (migration nécessaire).');
    }

    // Appliquer la migration
    console.log('\n🚀 Application de la migration 014...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migration 014 appliquée avec succès.');

    // Vérifier l'état après migration
    const afterCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'finance_transactions'
        AND column_name IN ('tendered_amount', 'change_given')
      ORDER BY column_name;
    `);

    console.log('\n📊 Vérification post-migration :');
    afterCheck.rows.forEach((r) => {
      console.log(`   - ${r.column_name}: ${r.data_type}, nullable=${r.is_nullable}`);
    });

    if (afterCheck.rows.length === 2) {
      console.log('\n🎉 SUCCÈS : Les 2 colonnes sont bien présentes dans finance_transactions.');
    } else {
      console.log('\n❌ ERREUR : Les colonnes n\'ont pas été créées correctement.');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Erreur lors de la migration :');
    console.error(err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée.');
  }
}

main();
