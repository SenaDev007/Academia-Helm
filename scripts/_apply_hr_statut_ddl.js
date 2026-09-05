/**
 * Applique la migration RH « statut contractuel » (20260905140000) directement
 * sur la base Neon de production — idempotent, sans perte de données.
 * Usage : node /home/z/my-project/scripts/apply-hr-statut-ddl.js
 */
const fs = require('fs');
const { Client } = require('../apps/api-server/node_modules/pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const SQL_FILE =
  __dirname + '/../apps/api-server/prisma/migrations/20260905140000_hr_statut_contractuel/migration.sql';

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
    } catch (err) {
      console.error('ÉCHEC :', err.message, '\n→ instruction :', stmt.slice(0, 120), '…');
      process.exitCode = 1;
    }
  }
  console.log(`${applied}/${statements.length} instructions appliquées`);

  // Vérifications post-application
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name IN
    ('statutContractuel','cnssDeclarationDate','documentPaieType','prestationPaymentMode','prestationAmount','statutContractuelLockedAt')
    ORDER BY column_name`);
  console.log('staff →', cols.rows.map((r) => r.column_name).join(', '));

  const ccols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'employment_contracts' AND column_name IN
    ('statutContractuel','documentPaieType','prestationPaymentMode','prestationAmount')
    ORDER BY column_name`);
  console.log('employment_contracts →', ccols.rows.map((r) => r.column_name).join(', '));

  const j = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='hr_jobs' AND column_name='statutContractuel'`);
  console.log('hr_jobs →', j.rows.map((r) => r.column_name).join(', '));

  const rates = await client.query(`SELECT "fiscalYear", "cnssSalarial", "smig", "aibAvecIfu", "aibSansIfu", jsonb_array_length("itsBrackets") AS nb_tranches FROM payroll_fiscal_rates`);
  console.log('payroll_fiscal_rates →', JSON.stringify(rates.rows));

  const ssc = await client.query(`SELECT count(*)::int AS n FROM staff_statut_changes`);
  console.log('staff_statut_changes → table prête (lignes :', ssc.rows[0].n, ')');

  await client.end();
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
