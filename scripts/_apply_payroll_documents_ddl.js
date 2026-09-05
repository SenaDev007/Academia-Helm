/**
 * Applique la migration RH « documents de paie FP/EP » (20260906140000)
 * directement sur la base Neon de production — idempotent, sans perte de données.
 * Usage : node scripts/_apply_payroll_documents_ddl.js
 */
const fs = require('fs');

// Résolution pg : node_modules du repo (déploiement complet) OU sandbox (clone sans deps)
let Client;
try {
  ({ Client } = require('pg'));
} catch {
  ({ Client } = require('/home/z/my-project/ddl-tools/node_modules/pg'));
}

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WdxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const SQL_FILE =
  __dirname + '/../apps/api-server/prisma/migrations/20260906140000_hr_payroll_documents/migration.sql';

async function main() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  // Retirer les commentaires puis découper en instructions (aucun ';' dans les littéraux de ce fichier)
  const statements = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let applied = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      applied++;
      console.log(`  ✓ ${firstLine(stmt)}`);
    } catch (err) {
      if (/already exists|duplicate/i.test(err.message)) {
        console.log(`  = déjà présent : ${firstLine(stmt)}`);
      } else {
        console.error(`  ✗ ${firstLine(stmt)} → ${err.message}`);
        process.exitCode = 1;
      }
    }
  }

  // ── Post-check : structures créées ──
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'payroll_documents' ORDER BY ordinal_position
  `);
  console.log(`\nPost-check payroll_documents : ${cols.rows.length} colonnes`);
  console.log('  ' + cols.rows.map((r) => r.column_name).join(', '));

  const seq = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'payroll_document_sequences' ORDER BY ordinal_position
  `);
  console.log(`Post-check payroll_document_sequences : ${seq.rows.length} colonnes`);

  const conge = await client.query(`
    SELECT "fiscalYear", "joursCongesParMois" FROM "payroll_fiscal_rates" ORDER BY "fiscalYear"
  `);
  for (const r of conge.rows) {
    console.log(`Barème ${r.fiscalYear} : joursCongesParMois = ${r.joursCongesParMois}`);
  }

  const idx = await client.query(`
    SELECT indexname FROM pg_indexes WHERE tablename IN ('payroll_documents', 'payroll_document_sequences') ORDER BY indexname
  `);
  console.log(`\nIndex : ${idx.rows.length}`);
  for (const r of idx.rows) console.log(`  - ${r.indexname}`);

  await client.end();
  console.log(`\n${applied} instructions appliquées.`);
}

function firstLine(stmt) {
  return stmt.replace(/\s+/g, ' ').slice(0, 80);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
