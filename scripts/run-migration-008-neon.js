#!/usr/bin/env node
/**
 * Exécute la migration 008_compta_auto_export.sql sur la base Neon.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgres://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const migrationFile = path.join(__dirname, '..', 'apps', 'api-server', 'migrations', '008_compta_auto_export.sql');

async function main() {
  console.log('→ Lecture du fichier migration 008...');
  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log(`  ${sql.length} caractères lus`);

  console.log('→ Connexion à la base Neon...');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('  Connecté ✓');

    console.log('→ Exécution de la migration 008...');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('  ✓ Migration exécutée en transaction unique');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('  ✗ Échec, ROLLBACK');
      throw err;
    }

    // Vérification
    console.log('');
    console.log('→ Vérification post-migration...');
    const result = await client.query(`
      SELECT
        "comptaAutoExportEnabled",
        "comptaAutoExportEmail",
        "comptaAutoExportFormat",
        "comptaAutoExportDay",
        "comptaAutoExportLastSent"
      FROM "financial_settings"
      LIMIT 5
    `);
    if (result.rows.length === 0) {
      console.log('  Aucune ligne dans financial_settings (normal si pas encore créée).');
    } else {
      console.log(`  ${result.rows.length} ligne(s) dans financial_settings :`);
      result.rows.forEach((r, i) => {
        console.log(`    [${i}] enabled=${r.comptaAutoExportEnabled} | email=${r.comptaAutoExportEmail || '—'} | format=${r.comptaAutoExportFormat} | day=${r.comptaAutoExportDay}`);
      });
    }

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
