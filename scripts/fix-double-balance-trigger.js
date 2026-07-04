/**
 * Fix double-comptage : supprimer le trigger en double + recalculer les soldes
 *
 * Problème : 2 triggers faisaient la même chose sur finance_transactions :
 *   - update_balance_after_transaction (ancien, sans bypass prevent_balance_update)
 *   - trg_update_balance_after_tx (nouveau, avec bypass)
 * → totalPaid incrémenté 2 fois à chaque transaction
 *
 * Solution :
 *   1. DROP le trigger update_balance_after_transaction (garder le nouveau)
 *   2. Recalculer totalPaid = SUM(breakdowns.paidAmount) pour tous les comptes
 *   3. Recalculer balance = totalDue - totalPaid
 *   4. Recalculer status (PAID/PARTIAL/ACTIVE)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== 1. Suppression du trigger en double ===');
  await client.query('DROP TRIGGER IF EXISTS update_balance_after_transaction ON finance_transactions');
  console.log('  ✅ Trigger update_balance_after_transaction supprimé');
  console.log('  (trg_update_balance_after_tx conservé — il gère le bypass prevent_balance_update)');

  console.log('\n=== 2. Recalcul des soldes pour tous les comptes ===');

  // Désactiver temporairement le trigger prevent_balance_update_trigger
  await client.query('ALTER TABLE student_accounts DISABLE TRIGGER prevent_balance_update_trigger');
  console.log('  ✅ Trigger prevent_balance_update_trigger désactivé temporairement');

  try {
    // Recalculer totalPaid depuis les breakdowns
    const recalc = await client.query(`
      UPDATE student_accounts sa
      SET
        "totalPaid" = COALESCE((
          SELECT SUM("paidAmount")
          FROM account_breakdowns ab
          WHERE ab."studentAccountId" = sa.id
        ), 0),
        "balance" = sa."totalDue" - COALESCE((
          SELECT SUM("paidAmount")
          FROM account_breakdowns ab
          WHERE ab."studentAccountId" = sa.id
        ), 0),
        "status" = CASE
          WHEN (sa."totalDue" - COALESCE((
            SELECT SUM("paidAmount") FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id
          ), 0)) <= 0 THEN 'PAID'::"AccountStatus"
          WHEN COALESCE((
            SELECT SUM("paidAmount") FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id
          ), 0) > 0 THEN 'PARTIAL'::"AccountStatus"
          ELSE 'ACTIVE'::"AccountStatus"
        END,
        "updatedAt" = NOW()
      WHERE EXISTS (
        SELECT 1 FROM finance_transactions ft WHERE ft."studentAccountId" = sa.id
      )
    `);
    console.log(`  ✅ ${recalc.rowCount} comptes recalculés`);
  } finally {
    // Réactiver le trigger
    await client.query('ALTER TABLE student_accounts ENABLE TRIGGER prevent_balance_update_trigger');
    console.log('  ✅ Trigger prevent_balance_update_trigger réactivé');
  }

  // Vérifier Aglossi Mariano
  console.log('\n=== 3. Vérification Aglossi Mariano ===');
  const student = await client.query("SELECT id FROM students WHERE \"lastName\" ILIKE '%AGLOSSI%'");
  if (student.rows.length > 0) {
    const sa = await client.query('SELECT "totalDue", "totalPaid", "balance", status FROM student_accounts WHERE "studentId" = $1', [student.rows[0].id]);
    console.log('  totalDue:', sa.rows[0].totaldue);
    console.log('  totalPaid:', sa.rows[0].totalpaid, '(attendu: 10000)');
    console.log('  balance:', sa.rows[0].balance, '(attendu: 33000)');
    console.log('  status:', sa.rows[0].status);
  }

  // Vérifier qu'il ne reste qu'un seul trigger de balance
  console.log('\n=== 4. Triggers restants sur finance_transactions ===');
  const triggers = await client.query("SELECT tgname FROM pg_trigger WHERE tgrelid = 'finance_transactions'::regclass AND NOT tgisinternal");
  for (const row of triggers.rows) console.log('  -', row.tgname);

  await client.end();
}
main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
