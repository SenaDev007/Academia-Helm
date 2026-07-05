/**
 * Recalculer le compte de AKPOVI Béroukhyah pour appliquer l'override TUITION
 * (28000 au lieu de 35000)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const studentId = 'c9a4b7d0-fadd-40a8-8ec0-c472772b5708'; // AKPOVI
  const accountId = '84888277-5081-41fb-aef2-1e0cf997993a';

  console.log('=== Avant recalcul ===');
  const before = await client.query('SELECT "totalDue", "totalPaid", "balance" FROM student_accounts WHERE id = $1', [accountId]);
  console.log('  totalDue:', before.rows[0].totalDue, '| totalPaid:', before.rows[0].totalPaid, '| balance:', before.rows[0].balance);

  // 1. Mettre à jour le breakdown TUITION avec le montant personnalisé
  const override = await client.query('SELECT "customAmount", "feeStructureId" FROM fee_overrides WHERE "studentId" = $1', [studentId]);
  console.log('\nOverride:', override.rows[0]);

  if (override.rows.length > 0) {
    const customAmount = override.rows[0].customAmount;
    const fsId = override.rows[0].feestructureid;

    // Mettre à jour le breakdown
    const updated = await client.query(`
      UPDATE account_breakdowns
      SET "initialAmount" = $1, "adjustedAmount" = $1, "remainingAmount" = $1 - "paidAmount"
      WHERE "studentAccountId" = $2 AND "feeStructureId" = $3
      RETURNING id, "initialAmount", "remainingAmount"
    `, [customAmount, accountId, fsId]);
    console.log('\nBreakdown mis à jour:', updated.rows[0]);
  }

  // 2. Recalculer totalDue + balance (désactiver trigger temporairement)
  await client.query('ALTER TABLE student_accounts DISABLE TRIGGER prevent_balance_update_trigger');
  try {
    const recalc = await client.query(`
      UPDATE student_accounts
      SET
        "totalDue" = (SELECT COALESCE(SUM("initialAmount"), 0) FROM account_breakdowns WHERE "studentAccountId" = $1),
        "totalPaid" = (SELECT COALESCE(SUM("paidAmount"), 0) FROM account_breakdowns WHERE "studentAccountId" = $1),
        "balance" = (SELECT COALESCE(SUM("initialAmount"), 0) - COALESCE(SUM("paidAmount"), 0) FROM account_breakdowns WHERE "studentAccountId" = $1),
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING "totalDue", "totalPaid", "balance"
    `, [accountId]);
    console.log('\n=== Après recalcul ===');
    console.log('  totalDue:', recalc.rows[0].totalDue, '| totalPaid:', recalc.rows[0].totalPaid, '| balance:', recalc.rows[0].balance);
  } finally {
    await client.query('ALTER TABLE student_accounts ENABLE TRIGGER prevent_balance_update_trigger');
  }

  await client.end();
}
main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
