/**
 * Diagnostic : analyser les patterns d'incohérence
 * - Total des transactions réelles vs totalPaid dans student_accounts
 * - Breakdowns manquants (TUITION absent)
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Pour chaque compte, calculer le total des transactions réelles
  const accounts = await client.query(`
    SELECT sa.id, sa."totalDue", sa."totalPaid", sa."balance",
           s."lastName", s."firstName",
           COALESCE(SUM(ft.amount), 0) as actual_tx_sum,
           COUNT(ft.id) as tx_count
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN finance_transactions ft ON ft."studentAccountId" = sa.id
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    GROUP BY sa.id, sa."totalDue", sa."totalPaid", sa."balance", s."lastName", s."firstName"
    ORDER BY s."lastName", s."firstName"
  `, [TENANT_ID, YEAR_ID]);

  console.log(`Total accounts: ${accounts.rows.length}\n`);

  // 2. Pour chaque compte, vérifier les breakdowns
  let matched = 0, mismatched = 0;
  let noTuitionBd = 0, noInscriptionBd = 0, bothBdOk = 0;
  let txSumVsTotalPaidMismatch = 0;

  const toFix = [];

  for (const a of accounts.rows) {
    const bds = await client.query(`
      SELECT ab."initialAmount", ab."paidAmount", fs."feeType"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1
    `, [a.id]);

    const hasTuition = bds.rows.some(b => b.feeType === 'TUITION');
    const hasInscription = bds.rows.some(b => b.feeType === 'INSCRIPTION');
    if (!hasTuition) noTuitionBd++;
    if (!hasInscription) noInscriptionBd++;
    if (hasTuition && hasInscription) bothBdOk++;

    const actualTxSum = Number(a.actual_tx_sum);
    const dbTotalPaid = Number(a.totalPaid);
    if (Math.abs(actualTxSum - dbTotalPaid) > 1) {
      txSumVsTotalPaidMismatch++;
    }

    // Compute expected totalDue from breakdowns
    const expectedTotalDue = bds.rows.reduce((sum, b) => sum + Number(b.initialAmount), 0);
    const dbTotalDue = Number(a.totalDue);
    const dueMismatch = Math.abs(expectedTotalDue - dbTotalDue) > 1;

    if (dueMismatch || Math.abs(actualTxSum - dbTotalPaid) > 1) {
      mismatched++;
      toFix.push({
        accountId: a.id,
        lastName: a.lastName,
        firstName: a.firstName,
        dbTotalDue,
        dbTotalPaid,
        dbBalance: Number(a.balance),
        actualTxSum,
        expectedTotalDue,
        hasTuition,
        hasInscription,
        bdCount: bds.rows.length,
        txCount: Number(a.tx_count),
        dueMismatch,
        paidMismatch: Math.abs(actualTxSum - dbTotalPaid) > 1,
      });
    } else {
      matched++;
    }
  }

  console.log('=== RAPPORT ===');
  console.log(`Comptes OK (totalDue + totalPaid match): ${matched}`);
  console.log(`Comptes à corriger: ${mismatched}`);
  console.log(`\nBreakdowns manquants:`);
  console.log(`  Sans TUITION: ${noTuitionBd}`);
  console.log(`  Sans INSCRIPTION: ${noInscriptionBd}`);
  console.log(`  Avec les deux: ${bothBdOk}`);
  console.log(`\ntx_sum vs totalPaid mismatch: ${txSumVsTotalPaidMismatch}`);

  console.log('\n=== ÉCHANTILLON DES COMPTES À CORRIGER (20 premiers) ===');
  console.log('Name | dbDue | dbPaid | dbBal | txSum | expectedDue | hasTuition | hasInsc | txCount');
  for (const t of toFix.slice(0, 20)) {
    console.log(
      `${t.lastName} ${t.firstName}`.padEnd(35),
      `due=${String(t.dbTotalDue).padStart(7)}`,
      `paid=${String(t.dbTotalPaid).padStart(7)}`,
      `bal=${String(t.dbBalance).padStart(7)}`,
      `txSum=${String(t.actualTxSum).padStart(7)}`,
      `expDue=${String(t.expectedTotalDue).padStart(7)}`,
      `T=${t.hasTuition ? 'Y' : 'N'}`,
      `I=${t.hasInscription ? 'Y' : 'N'}`,
      `tx=${t.txCount}`
    );
  }

  // Stats
  const dueTooLow = toFix.filter(t => t.expectedTotalDue > t.dbTotalDue).length;
  const dueTooHigh = toFix.filter(t => t.expectedTotalDue < t.dbTotalDue).length;
  const paidTooLow = toFix.filter(t => t.actualTxSum > t.dbTotalPaid).length;
  const paidTooHigh = toFix.filter(t => t.actualTxSum < t.dbTotalPaid).length;
  console.log('\n=== STATISTIQUES ===');
  console.log(`totalDue trop bas (expected > db): ${dueTooLow}`);
  console.log(`totalDue trop haut (expected < db): ${dueTooHigh}`);
  console.log(`totalPaid trop bas (txSum > db): ${paidTooLow}`);
  console.log(`totalPaid trop haut (txSum < db): ${paidTooHigh}`);

  // Write toFix list to JSON file for next step
  const fs = require('fs');
  fs.writeFileSync('/home/z/my-project/scripts/to_fix_accounts.json', JSON.stringify(toFix, null, 2));
  console.log(`\n📝 Liste complète écrite dans scripts/to_fix_accounts.json (${toFix.length} comptes)`);

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
