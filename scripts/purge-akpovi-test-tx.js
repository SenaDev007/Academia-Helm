/**
 * PURGE DES ENCAISSEMENTS DE TEST — CSPEB / élève Akpovi Péniel
 * (Sèhomie Pénielle Béroukhyah AKPOVI TOHOU, matricule CSPEBE-E-26-005)
 *
 * Transaction unique, tout ou rien :
 *   1. Désactive les triggers d'immutabilité (immutabilité financière) — le temps de la purge
 *   2. Supprime les 4 finance_transactions de test (allocations en cascade)
 *   3. Ré-active les triggers
 *   4. Réinitialise les account_breakdowns (paidAmount → 0, remainingAmount → adjustedAmount)
 *   5. Réinitialise le student_account (totalPaid → 0, balance → totalDue, status → ACTIVE)
 *      via set_config('app.allow_balance_update') — même mécanisme que le trigger serveur
 *   6. Réinitialise les clôtures journalières des dates concernées (totalIncome → 0)
 *   7. Trace la purge dans financial_audit_logs (PURGE_TEST_DATA)
 *
 * Usage : node scripts/purge-akpovi-test-tx.js [--dry-run]
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const DRY_RUN = process.argv.includes('--dry-run');

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const STUDENT_ACCOUNT_ID = '84888277-5081-41fb-aef2-1e0cf997993a';
const STUDENT_ID = 'c9a4b7d0-fadd-40a8-8ec0-c472772b5708';

const TX_IDS = [
  '0afb65bf-7897-42da-a9e1-cdce42795f99', // CSPEBE-REC-26-001 | 10000 XOF CASH | 2026-08-14
  'c5770bfb-a43a-4755-8b44-714fa134b3b4', // CSPEBE-REC-26-002 |  1000 XOF FEDAPAY | 2026-08-14
  'dedfcf07-b9b6-46a7-bb62-1f8839aa5c24', // CSPEBE-REC-26-003 |  1000 XOF CASH | 2026-08-23
  '8b923801-3adb-4e43-bcc1-70e39de146fb', // CSPEBE-REC-26-004 |  5000 XOF CASH | 2026-09-01
];

const DELETE_TRIGGERS = ['no_delete_finance_transaction', 'trg_no_delete_finance_transaction'];

const CLOSURE_DATES = ['2026-08-14', '2026-08-23', '2026-09-01'];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');

    // ─── 0. Vérifications préalables ───────────────────────────────────────
    const check = await client.query(
      `SELECT "receiptNumber", amount, "studentAccountId", "tenantId" FROM finance_transactions WHERE id = ANY($1)`,
      [TX_IDS]
    );
    if (check.rows.length !== TX_IDS.length) {
      throw new Error(`Vérification échouée : ${check.rows.length}/${TX_IDS.length} transactions trouvées`);
    }
    for (const r of check.rows) {
      if (r.studentAccountId !== STUDENT_ACCOUNT_ID || r.tenantId !== TENANT_ID) {
        throw new Error(`Transaction ${r.receiptNumber} n'appartient pas au compte/tenant attendu — ABORT`);
      }
      console.log(`  À purger : ${r.receiptNumber} | ${r.amount} XOF`);
    }

    // ─── 1. Désactiver les triggers d'immutabilité ─────────────────────────
    for (const trig of DELETE_TRIGGERS) {
      await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER ${trig}`);
      console.log(`  Trigger désactivé : ${trig}`);
    }

    // ─── 2. Supprimer les allocations puis les transactions ────────────────
    const delAlloc = await client.query(
      `DELETE FROM finance_transaction_allocations WHERE "financeTransactionId" = ANY($1)`,
      [TX_IDS]
    );
    console.log(`  Allocations supprimées : ${delAlloc.rowCount}`);
    const delTx = await client.query(
      `DELETE FROM finance_transactions WHERE id = ANY($1) AND "studentAccountId" = $2 AND "tenantId" = $3`,
      [TX_IDS, STUDENT_ACCOUNT_ID, TENANT_ID]
    );
    if (delTx.rowCount !== TX_IDS.length) {
      throw new Error(`Suppression partielle : ${delTx.rowCount}/${TX_IDS.length} — ROLLBACK`);
    }
    console.log(`  Transactions supprimées : ${delTx.rowCount}`);

    // ─── 3. Ré-activer les triggers ────────────────────────────────────────
    for (const trig of DELETE_TRIGGERS) {
      await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER ${trig}`);
      console.log(`  Trigger ré-activé : ${trig}`);
    }

    // ─── 4. Réinitialiser les account_breakdowns ───────────────────────────
    const bd = await client.query(
      `UPDATE account_breakdowns
         SET "paidAmount" = 0,
             "remainingAmount" = "adjustedAmount"
       WHERE "studentAccountId" = $1
       RETURNING id, "paidAmount", "remainingAmount"`,
      [STUDENT_ACCOUNT_ID]
    );
    bd.rows.forEach(r => console.log(`  Breakdown ${r.id} → payé=0, restant=${r.remainingAmount}`));

    // ─── 5. Réinitialiser le student_account (bypass contrôlé du trigger) ──
    // Même mécanisme que update_account_balance_after_tx : set_config
    // app.allow_balance_update=true (portée transaction).
    await client.query(`SELECT set_config('app.allow_balance_update', 'true', true)`);
    const updAcc = await client.query(
      `UPDATE student_accounts
         SET "totalPaid" = 0,
             "balance" = "totalDue",
             "arrearsAmount" = 0,
             "status" = 'ACTIVE',
             "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, "totalDue", "totalPaid", "balance", "status"`,
      [STUDENT_ACCOUNT_ID]
    );
    console.log(`  Compte remis à neuf : dû=${updAcc.rows[0].totalDue}, payé=0, solde=${updAcc.rows[0].balance}, statut=${updAcc.rows[0].status}`);

    // ─── 6. Réinitialiser les clôtures journalières des dates des tests ────
    const closures = await client.query(
      `UPDATE finance_daily_closures
         SET "totalIncome" = 0,
             "netBalance" = 0 - "totalExpense"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND date::date = ANY($3::date[])
       RETURNING id, date, "totalIncome", "netBalance"`,
      [TENANT_ID, ACADEMIC_YEAR_ID, CLOSURE_DATES]
    );
    closures.rows.forEach(c =>
      console.log(`  Clôture ${c.date.toISOString().slice(0, 10)} → income=0, net=${c.netBalance}`)
    );

    // ─── 7. Tracer la purge (audit) ────────────────────────────────────────
    const { randomUUID } = require('crypto');
    const PROMOTER_USER_ID = '1eb1cace-3006-4e13-941a-a76b600177ae'; // salumerhel2036@gmail.com (promoteur CSPEB)
    await client.query(
      `INSERT INTO financial_audit_logs
         ("id", "tenantId", "entityType", "entityId", "action", "oldValue", "newValue", "performedById", "performedAt")
       VALUES ($1, $2, 'FinanceTransaction', $3, 'PURGE_TEST_DATA', $4, $5, $6, NOW())`,
      [
        randomUUID(),
        TENANT_ID,
        STUDENT_ACCOUNT_ID,
        JSON.stringify({
          purged: 'CSPEBE-REC-26-001 10000, CSPEBE-REC-26-002 1000, CSPEBE-REC-26-003 1000, CSPEBE-REC-26-004 5000',
          student: 'Sèhomie Pénielle Béroukhyah AKPOVI TOHOU (CSPEBE-E-26-005)',
          total: 17000,
          reason: 'Encaissements de TEST à supprimer (instruction promoteur)',
          accountBefore: { totalDue: 3000, totalPaid: 17000, balance: -14000, status: 'PAID' },
          closuresReset: CLOSURE_DATES,
        }),
        JSON.stringify({
          accountAfter: { totalDue: 3000, totalPaid: 0, balance: 3000, status: 'ACTIVE' },
          transactionsDeleted: TX_IDS.length,
          triggersRestored: true,
        }),
        PROMOTER_USER_ID,
      ]
    );
    console.log('  Audit PURGE_TEST_DATA inséré');

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n[DRY-RUN] ROLLBACK effectué — aucune donnée modifiée.');
    } else {
      await client.query('COMMIT');
      console.log('\n✅ PURGE VALIDÉE (COMMIT).');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ ERREUR — ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
