/**
 * Diagnostic v2 — une seule requête avec CTE pour analyser toutes les incohérences
 */
const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('⏳ Running comprehensive query...');
  const r = await client.query(`
    WITH
    -- Sum of transactions per account
    tx_sums AS (
      SELECT "studentAccountId", SUM(amount) as tx_sum, COUNT(*) as tx_count
      FROM finance_transactions
      WHERE "tenantId" = $1 AND "academicYearId" = $2
      GROUP BY "studentAccountId"
    ),
    -- Sum of breakdowns initial amounts per account (expected totalDue)
    bd_sums AS (
      SELECT ab."studentAccountId",
             SUM(ab."initialAmount") as expected_total_due,
             SUM(ab."paidAmount") as expected_total_paid,
             SUM(ab."remainingAmount") as expected_remaining,
             BOOL_OR(fs."feeType" = 'TUITION') as has_tuition,
             BOOL_OR(fs."feeType" = 'INSCRIPTION') as has_inscription,
             COUNT(*) as bd_count
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      GROUP BY ab."studentAccountId"
    )
    SELECT sa.id as account_id,
           s."lastName", s."firstName",
           sa."totalDue" as db_total_due,
           sa."totalPaid" as db_total_paid,
           sa."balance" as db_balance,
           COALESCE(ts.tx_sum, 0) as actual_tx_sum,
           COALESCE(ts.tx_count, 0) as tx_count,
           COALESCE(bs.expected_total_due, 0) as expected_total_due,
           COALESCE(bs.expected_total_paid, 0) as expected_total_paid,
           COALESCE(bs.expected_remaining, 0) as expected_remaining,
           COALESCE(bs.has_tuition, false) as has_tuition,
           COALESCE(bs.has_inscription, false) as has_inscription,
           COALESCE(bs.bd_count, 0) as bd_count
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN tx_sums ts ON ts."studentAccountId" = sa.id
    LEFT JOIN bd_sums bs ON bs."studentAccountId" = sa.id
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    ORDER BY s."lastName", s."firstName"
  `, [TENANT_ID, YEAR_ID]);

  console.log(`Total accounts: ${r.rows.length}\n`);

  let matched = 0, mismatched = 0;
  const toFix = [];

  for (const a of r.rows) {
    const dbDue = Number(a.db_total_due);
    const dbPaid = Number(a.db_total_paid);
    const dbBal = Number(a.db_balance);
    const txSum = Number(a.actual_tx_sum);
    const expDue = Number(a.expected_total_due);
    const expPaid = Number(a.expected_total_paid);

    const dueMismatch = Math.abs(expDue - dbDue) > 1;
    const paidMismatch = Math.abs(txSum - dbPaid) > 1;

    if (dueMismatch || paidMismatch) {
      mismatched++;
      toFix.push({
        accountId: a.account_id,
        lastName: a.lastName,
        firstName: a.firstName,
        dbTotalDue: dbDue,
        dbTotalPaid: dbPaid,
        dbBalance: dbBal,
        actualTxSum: txSum,
        expectedTotalDue: expDue,
        expectedTotalPaid: expPaid,
        hasTuition: a.has_tuition,
        hasInscription: a.has_inscription,
        bdCount: Number(a.bd_count),
        txCount: Number(a.tx_count),
        dueMismatch,
        paidMismatch,
      });
    } else {
      matched++;
    }
  }

  console.log(`✅ Comptes OK: ${matched}`);
  console.log(`❌ Comptes à corriger: ${mismatched}`);

  console.log('\n=== ÉCHANTILLON (30 premiers) ===');
  console.log('Name | dbDue | dbPaid | dbBal | txSum | expDue | expPaid | hasT | hasI | bdN | txN');
  for (const t of toFix.slice(0, 30)) {
    console.log(
      `${t.lastName} ${t.firstName}`.substring(0, 32).padEnd(32),
      `due=${String(t.dbTotalDue).padStart(7)}`,
      `paid=${String(t.dbTotalPaid).padStart(7)}`,
      `bal=${String(t.dbBalance).padStart(7)}`,
      `txS=${String(t.actualTxSum).padStart(7)}`,
      `expD=${String(t.expectedTotalDue).padStart(7)}`,
      `expP=${String(t.expectedTotalPaid).padStart(7)}`,
      `T=${t.hasTuition ? 'Y' : 'N'}`,
      `I=${t.hasInscription ? 'Y' : 'N'}`,
      `bd=${t.bdCount}`,
      `tx=${t.txCount}`
    );
  }

  const dueTooLow = toFix.filter(t => t.expectedTotalDue > t.dbTotalDue).length;
  const dueTooHigh = toFix.filter(t => t.expectedTotalDue < t.dbTotalDue).length;
  const paidTooLow = toFix.filter(t => t.actualTxSum > t.dbTotalPaid).length;
  const paidTooHigh = toFix.filter(t => t.actualTxSum < t.dbTotalPaid).length;
  console.log('\n=== STATISTIQUES ===');
  console.log(`totalDue trop bas (expected > db): ${dueTooLow}`);
  console.log(`totalDue trop haut (expected < db): ${dueTooHigh}`);
  console.log(`totalPaid trop bas (txSum > db): ${paidTooLow}`);
  console.log(`totalPaid trop haut (txSum < db): ${paidTooHigh}`);

  // Categorize the mismatches
  const noTuition = toFix.filter(t => !t.hasTuition).length;
  const noInscription = toFix.filter(t => !t.hasInscription).length;
  const hasBothBd = toFix.filter(t => t.hasTuition && t.hasInscription).length;
  console.log(`\n=== BREAKDOWNS ===`);
  console.log(`Sans TUITION: ${noTuition}`);
  console.log(`Sans INSCRIPTION: ${noInscription}`);
  console.log(`Avec les deux: ${hasBothBd}`);

  fs.writeFileSync('/home/z/my-project/scripts/to_fix_accounts.json', JSON.stringify(toFix, null, 2));
  console.log(`\n📝 Liste écrite dans scripts/to_fix_accounts.json`);

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
