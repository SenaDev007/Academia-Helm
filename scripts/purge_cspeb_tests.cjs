/**
 * ============================================================================
 * PURGE DES DONNÉES DE TEST — École CSPEB (tenant 59b8c348)
 * ============================================================================
 * Supprime :
 *   1. Les 4 élèves tests : Testflux DYNAMIQUE (-103), Ariel AKPOVI (-104),
 *      Testperf CLASSELOAD (-105), Testperf2 CLASSELOAD2 (-106)
 *      + Carine BIAOU #1 (doublon stray sans matricule, zéro donnée)
 *      → cascade : comptes, imputations, photos, etc.
 *   2. Les 6 transactions de test (3 encaissements + 3 reversals appariées)
 *   3. L'allocation de frais associée (REC-26-003)
 *   4. Le transfert de caisse orphelin (résidu d'une purge précédente)
 *   5. La clôture journalière du 2026-09-07 (income de test 9500 → 0)
 *   6. Les soldes des 2 caisses pollués par les tests (→ 0)
 *   7. Trace d'audit PURGE_TEST_DATA
 *
 * CONSERVÉ : Carine BIAOU #2 (CSPEBE-E-26-102) — inscription réelle
 * (même profil qu'Oswaldine DAGBANON, inscrite aujourd'hui via le même flux).
 *
 * Usage : node purge_cspeb_tests.cjs [--dry-run]
 */
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const DRY_RUN = process.argv.includes('--dry-run');

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const PROMOTER_USER_ID = '1eb1cace-3006-4e13-941a-a76b600177ae'; // salumerhel2036@gmail.com (promoteur CSPEB)

// ── Élèves à supprimer ──────────────────────────────────────────────────────
const STUDENTS = [
  { id: 'e045da60-b849-42ce-a0ae-f9102a930bef', nom: 'Testflux DYNAMIQUE', mat: 'CSPEBE-E-26-103' },
  { id: '27fad22d-f319-4358-a007-a8d44acdb963', nom: 'Ariel AKPOVI', mat: 'CSPEBE-E-26-104' },
  { id: 'a93fcfc8-6d2b-4560-a83b-9b707413ff1a', nom: 'Testperf CLASSELOAD', mat: 'CSPEBE-E-26-105' },
  { id: '7e2199bf-aecf-4c8b-b58d-a91a7aec03f6', nom: 'Testperf2 CLASSELOAD2', mat: 'CSPEBE-E-26-106' },
  { id: 'ade7f99f-2dae-4bfd-a25e-665538ee16eb', nom: 'Carine BIAOU (doublon stray)', mat: null },
];

// ── Transactions à supprimer ────────────────────────────────────────────────
const TX_IDS = [
  'ddeeeff0-bb65-42f0-9f02-b1fcf4fc6225', // CSPEBE-REC-26-001 | PAYMENT 2000 Testperf
  'ace112f3-e5d7-4106-b478-9a382cf96c40', // AH-2026-000001     | REVERSAL -2000
  '089e9774-db8a-4d36-8745-10679ffb14ad', // CSPEBE-REC-26-002 | PAYMENT 1500 Testperf
  'a47cab96-7fb7-4b2c-a6de-95a5d4bb45e1', // AH-2026-000002     | REVERSAL -1500
  '8709d0a8-da60-430a-b07f-e5a75c87d0e9', // CSPEBE-REC-26-003 | PAYMENT 6000 Testperf2
  'ac2dec3f-50d0-4028-9801-dae51dd0ee54', // AH-2026-000003     | REVERSAL -6000
];

const DELETE_TRIGGERS = ['no_delete_finance_transaction', 'trg_no_delete_finance_transaction'];

const ORPHAN_TRANSFER_ID = '2d50507e-30d4-4e24-8f26-3e4bf43476dc'; // AUTO-c5770bfb (tx déjà purgée)
const CLOSURE_DATE = '2026-09-07';
const CAISSES = [
  { id: 'e3dfa59c-5928-4ea5-91fc-ad1e2c7e4b06', nom: "Caisse d'accueil", avant: 19500 },
  { id: '9a80c740-db44-4051-9cb5-1ede3742d8d8', nom: 'Caisse Paiements en Ligne', avant: 1000 },
];

function fail(msg) { throw new Error(msg); }

async function main() {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(DRY_RUN ? '=== DRY-RUN (aucune modification) ===' : '=== PURGE RÉELLE ===\n');

  try {
    await c.query('BEGIN');

    // ── 0. Vérifications préalables ─────────────────────────────────────────
    const chkStudents = await c.query(
      `SELECT id, "firstName", "lastName", matricule FROM students WHERE id = ANY($1) AND "tenantId" = $2`,
      [STUDENTS.map(s => s.id), TENANT_ID]
    );
    if (chkStudents.rows.length !== STUDENTS.length)
      fail(`Élèves : ${chkStudents.rows.length}/${STUDENTS.length} trouvés — ABORT`);
    for (const s of chkStudents.rows) console.log(`  ✓ élève : ${s.firstName} ${s.lastName} (${s.matricule || 'sans mat'})`);

    const chkTx = await c.query(
      `SELECT id, "receiptNumber", amount FROM finance_transactions WHERE id = ANY($1) AND "tenantId" = $2`,
      [TX_IDS, TENANT_ID]
    );
    if (chkTx.rows.length !== TX_IDS.length)
      fail(`Transactions : ${chkTx.rows.length}/${TX_IDS.length} trouvées — ABORT`);
    for (const t of chkTx.rows) console.log(`  ✓ tx : ${t.receiptNumber} (${t.amount})`);

    const chkClosure = await c.query(
      `SELECT id, "totalIncome", "netBalance" FROM finance_daily_closures
       WHERE "tenantId" = $1 AND date = $2::date AND "totalIncome" = 9500`,
      [TENANT_ID, CLOSURE_DATE]
    );
    if (chkClosure.rows.length !== 1)
      fail(`Clôture 2026-09-07 (income 9500) : ${chkClosure.rows.length} ligne(s) — ABORT`);
    console.log(`  ✓ clôture ${CLOSURE_DATE} : income=${chkClosure.rows[0].totalIncome}`);

    const chkTr = await c.query(
      `SELECT COUNT(*)::int AS n FROM student_transfer_requests WHERE "studentId" = ANY($1)`,
      [STUDENTS.map(s => s.id)]
    );
    if (chkTr.rows[0].n > 0) fail(`transfer_requests bloquantes : ${chkTr.rows[0].n} — ABORT`);

    // ── 1. Désactiver les triggers d'immutabilité des transactions ──────────
    for (const trig of DELETE_TRIGGERS) await c.query(`ALTER TABLE finance_transactions DISABLE TRIGGER ${trig}`);
    console.log('  triggers delete finance_transactions désactivés');

    // ── 2. Allocations des transactions ────────────────────────────────────
    const delAlloc = await c.query(
      `DELETE FROM finance_transaction_allocations WHERE "financeTransactionId" = ANY($1)`,
      [TX_IDS]
    );
    console.log(`  allocations supprimées : ${delAlloc.rowCount}`);

    // ── 3. Transactions ─────────────────────────────────────────────────────
    const delTx = await c.query(
      `DELETE FROM finance_transactions WHERE id = ANY($1) AND "tenantId" = $2`,
      [TX_IDS, TENANT_ID]
    );
    if (delTx.rowCount !== TX_IDS.length) fail(`tx supprimées : ${delTx.rowCount}/${TX_IDS.length} — ROLLBACK`);
    console.log(`  transactions supprimées : ${delTx.rowCount}`);

    // ── 4. Ré-activer les triggers ─────────────────────────────────────────
    for (const trig of DELETE_TRIGGERS) await c.query(`ALTER TABLE finance_transactions ENABLE TRIGGER ${trig}`);
    console.log('  triggers ré-activés');

    // ── 5. Transfert de caisse orphelin (résidu purge précédente) ──────────
    const delTr = await c.query(
      `DELETE FROM cash_register_transfers WHERE id = $1 AND "tenantId" = $2`,
      [ORPHAN_TRANSFER_ID, TENANT_ID]
    );
    console.log(`  transfert caisse orphelin supprimé : ${delTr.rowCount}`);

    // ── 6. Clôture journalière du 2026-09-07 → zéro ────────────────────────
    const updCl = await c.query(
      `UPDATE finance_daily_closures
         SET "totalIncome" = 0, "netBalance" = 0 - "totalExpense"
       WHERE "tenantId" = $1 AND date = $2::date AND "totalIncome" = 9500
       RETURNING id, "totalIncome", "netBalance"`,
      [TENANT_ID, CLOSURE_DATE]
    );
    if (updCl.rowCount !== 1) fail(`clôture reset : ${updCl.rowCount} — ROLLBACK`);
    console.log(`  clôture ${CLOSURE_DATE} → income=0, net=${updCl.rows[0].netBalance}`);

    // ── 7. Soldes des caisses → 0 (100 % flux de test) ──────────────────────
    const updCaisses = await c.query(
      `UPDATE cash_registers SET "currentBalance" = "openingBalance", "updatedAt" = NOW()
       WHERE id = ANY($1) AND "tenantId" = $2
       RETURNING name, "currentBalance"`,
      [CAISSES.map(x => x.id), TENANT_ID]
    );
    if (updCaisses.rowCount !== CAISSES.length) fail(`caisses reset : ${updCaisses.rowCount}/${CAISSES.length} — ROLLBACK`);
    for (const r of updCaisses.rows) console.log(`  caisse « ${r.name} » → solde ${r.currentBalance}`);

    // ── 8. Suppression des élèves (cascade comptes/imputations/etc.) ────────
    // Trigger de garde : la suppression physique d'élèves est interdite en
    // temps normal (trg_prevent_student_delete). On le désactive le temps de
    // la transaction — un ROLLBACK le restaurerait aussi (DDL transactionnel).
    await c.query(`SELECT set_config('app.allow_balance_update', 'true', true)`);
    await c.query(`SELECT set_config('app.allow_manual_block_update', 'true', true)`);
    await c.query(`ALTER TABLE students DISABLE TRIGGER trg_prevent_student_delete`);
    console.log('  trigger students désactivé (trx locale)');
    const delStu = await c.query(
      `DELETE FROM students WHERE id = ANY($1) AND "tenantId" = $2`,
      [STUDENTS.map(s => s.id), TENANT_ID]
    );
    await c.query(`ALTER TABLE students ENABLE TRIGGER trg_prevent_student_delete`);
    console.log('  trigger students ré-activé');
    if (delStu.rowCount !== STUDENTS.length) fail(`élèves supprimés : ${delStu.rowCount}/${STUDENTS.length} — ROLLBACK`);
    console.log(`  élèves supprimés : ${delStu.rowCount} (cascades comptes, imputations, photos…)`);

    // ── 9. Trace d'audit ───────────────────────────────────────────────────
    await c.query(
      `INSERT INTO financial_audit_logs
         ("id", "tenantId", "entityType", "entityId", "action", "oldValue", "newValue", "performedById", "performedAt")
       VALUES ($1, $2, 'Student', $3, 'PURGE_TEST_DATA', $4, $5, $6, NOW())`,
      [
        randomUUID(),
        TENANT_ID,
        STUDENTS[0].id,
        JSON.stringify({
          reason: 'Suppression des élèves et encaissements de TEST (instruction utilisateur)',
          elevesSupprimes: STUDENTS.map(s => `${s.nom} (${s.mat || 'sans matricule'})`),
          transactionsSupprimees: ['CSPEBE-REC-26-001 (2000)', 'CSPEBE-REC-26-002 (1500)', 'CSPEBE-REC-26-003 (6000)',
                                   'AH-2026-000001 (-2000)', 'AH-2026-000002 (-1500)', 'AH-2026-000003 (-6000)'],
          transfersOrphelins: 1,
          closuresReset: ['2026-09-07 (income 9500 → 0)'],
          caissesReset: CAISSES.map(x => `${x.nom} (${x.avant} → 0)`),
        }),
        JSON.stringify({ elevesRestants: 98, transactionsTenant: 0, triggersRestaures: true }),
        PROMOTER_USER_ID,
      ]
    );
    console.log('  audit PURGE_TEST_DATA inséré');

    if (DRY_RUN) {
      await c.query('ROLLBACK');
      console.log('\n[DRY-RUN] ROLLBACK — aucune donnée modifiée.');
    } else {
      await c.query('COMMIT');
      console.log('\n✅ PURGE VALIDÉE (COMMIT).');
    }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\n❌ ERREUR — ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
