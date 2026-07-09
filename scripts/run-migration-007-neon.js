#!/usr/bin/env node
/**
 * Exécute la migration 007_add_compte_ohada_mapping.sql sur la base Neon.
 * Usage : node /home/z/my-project/scripts/run-migration-007-neon.js
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgres://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const migrationFile = path.join(__dirname, '..', 'apps', 'api-server', 'migrations', '007_add_compte_ohada_mapping.sql');

async function main() {
  console.log('→ Lecture du fichier migration 007...');
  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log(`  ${sql.length} caractères lus`);

  console.log('→ Connexion à la base Neon...');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('  Connecté ✓');

    console.log('→ Exécution de la migration...');

    // Exécuter le SQL en une seule transaction pour assurer l'atomicité.
    // Neon supporte les multi-statements via client.query si on ne les splitte pas.
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('  ✓ Migration exécutée en transaction unique');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('  ✗ Échec de la transaction, ROLLBACK effectué');
      throw err;
    }

    // Vérification post-migration : compter les catégories mappées
    console.log('');
    console.log('→ Vérification post-migration...');

    const expenseCount = await client.query('SELECT COUNT(*) as total, COUNT("compteOhada") as mapped FROM expense_categories');
    console.log(`  expense_categories : ${expenseCount.rows[0].mapped}/${expenseCount.rows[0].total} catégories mappées OHADA`);

    const feeCount = await client.query('SELECT COUNT(*) as total, COUNT("compteOhada") as mapped FROM fee_categories');
    console.log(`  fee_categories     : ${feeCount.rows[0].mapped}/${feeCount.rows[0].total} catégories mappées OHADA`);

    // Afficher un échantillon du mapping
    console.log('');
    console.log('→ Échantillon du mapping (expense_categories) :');
    const sample = await client.query('SELECT name, code, "compteOhada", "compteOhadaLib" FROM expense_categories WHERE "compteOhada" IS NOT NULL LIMIT 10');
    sample.rows.forEach((r) => {
      console.log(`  ${r.compteOhada} — ${r.compteOhadaLib || r.name} (cat: ${r.name})`);
    });

    console.log('');
    console.log('→ Échantillon du mapping (fee_categories) :');
    const sampleFees = await client.query('SELECT name, code, "compteOhada", "compteOhadaLib" FROM fee_categories WHERE "compteOhada" IS NOT NULL LIMIT 10');
    sampleFees.rows.forEach((r) => {
      console.log(`  ${r.compteOhada} — ${r.compteOhadaLib || r.name} (cat: ${r.name})`);
    });

  } catch (err) {
    console.error('❌ Échec de la migration :', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('');
    console.log('→ Connexion fermée.');
  }
}

main().catch((e) => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
