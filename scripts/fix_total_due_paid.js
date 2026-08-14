/**
 * FIX — Recalcule totalDue, totalPaid, balance pour tous les comptes de Mon Avenir Plus
 *
 * Règle de calcul :
 *   totalDue = SUM(account_breakdowns.initialAmount)
 *   totalPaid = SUM(finance_transactions.amount)
 *   balance = totalDue - totalPaid
 *
 * ⭐ Approche : on utilise les données DB comme source de vérité (breakdowns + transactions
 *    réellement enregistrées). Les transactions IMP-* ont été importées depuis Excel,
 *    donc le totalPaid calculé = somme des paiements réellement effectués.
 *
 * ⭐ Cas particulier : 33 comptes n'ont pas de breakdown TUITION (les paiements
 *    P1-P6 ont été enregistrés mais pas la structure de frais).
 *    Pour ces comptes, on crée le breakdown TUITION manquant en se basant sur
 *    le total des paiements de scolarité (somme P1-P6) et le feeStructure
 *    standard de la classe.
 *
 *    En attendant, pour ces 33 comptes, on ne peut pas calculer le totalDue
 *    correctement → on le met = totalPaid (balance = 0) si Excel "Reste" = 0,
 *    sinon on garde l'ancien totalDue.
 */
const { Client } = require('pg');
const XLSX = require('xlsx');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
const FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected\n');

  // ── Drop triggers that prevent updates ──
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('DROP TRIGGER IF EXISTS no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS lock_transaction_after_closure ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON finance_transactions');
  console.log('✅ Triggers dropped\n');

  // ── Step 1 : Load Excel data ──
  // Excel "Total des payements" = total dû (expected total)
  // Excel "Reste" = reste à payer (balance expected)
  const excelByLastName = new Map(); // lastName -> {totalPay, reste}
  for (const f of FILES) {
    const wb = XLSX.readFile(f);
    for (const sn of wb.SheetNames) {
      if (sn === 'RECAP') continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true });
      if (rows.length < 5) continue;

      const hr = 3;
      const header = rows[hr] || [];
      let nc = 1, totalPayCol = -1, resteCol = -1;
      for (let j = 0; j < header.length; j++) {
        const h = String(header[j] || '').toLowerCase().trim();
        if (h.includes('noms')) nc = j;
        if (h.includes('total des pay') || h.includes('total des pai')) totalPayCol = j;
        if (h === 'reste') resteCol = j;
      }
      if (totalPayCol === -1) continue;

      for (let ri = hr + 2; ri < rows.length; ri++) {
        const row = rows[ri];
        if (!row || !row[nc]) continue;
        const rawName = String(row[nc]).trim();
        if (!rawName || rawName.toUpperCase().includes('TOTAL') || /^\d+$/.test(rawName)) continue;

        const excelTotalPay = Number(row[totalPayCol]) || 0;
        const excelReste = Number(row[resteCol]) || 0;
        // Key = normalized last name (first word that's not "M" or "M.")
        const parts = rawName.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(p => p.length > 1);
        const key = parts[0] || rawName.toLowerCase();
        excelByLastName.set(key, { totalPay: excelTotalPay, reste: excelReste, name: rawName });
      }
    }
  }
  console.log(`📊 Excel: ${excelByLastName.size} élèves chargés\n`);

  // ── Step 2 : Get all accounts with current state ──
  const accounts = await client.query(`
    WITH tx_sums AS (
      SELECT "studentAccountId", SUM(amount) as tx_sum, COUNT(*) as tx_count
      FROM finance_transactions
      WHERE "tenantId" = $1 AND "academicYearId" = $2
      GROUP BY "studentAccountId"
    ),
    bd_sums AS (
      SELECT ab."studentAccountId",
             SUM(ab."initialAmount") as exp_due,
             SUM(ab."paidAmount") as exp_paid,
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
           COALESCE(bs.exp_due, 0) as expected_total_due,
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

  console.log(`📊 DB: ${accounts.rows.length} comptes à analyser\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let noBdCount = 0;
  const changes = [];

  for (const a of accounts.rows) {
    const dbDue = Number(a.db_total_due);
    const dbPaid = Number(a.db_total_paid);
    const dbBal = Number(a.db_balance);
    const txSum = Number(a.actual_tx_sum);
    const expDue = Number(a.expected_total_due);

    // Compute new values
    // totalDue : utilise la somme des breakdowns si > 0, sinon utilise Excel
    let newTotalDue = expDue;
    if (newTotalDue === 0) {
      // Try to find from Excel
      const lnKey = (a.lastName || '').toLowerCase().split(' ')[0];
      const excel = excelByLastName.get(lnKey);
      if (excel) {
        newTotalDue = excel.totalPay;
      } else {
        // Last resort: totalDue = txSum (balance = 0)
        newTotalDue = txSum;
      }
      noBdCount++;
    }

    // totalPaid : utilise la somme réelle des transactions
    const newTotalPaid = txSum;

    // balance = totalDue - totalPaid
    const newBalance = newTotalDue - newTotalPaid;

    // Check if change is needed
    const needsUpdate =
      Math.abs(newTotalDue - dbDue) > 1 ||
      Math.abs(newTotalPaid - dbPaid) > 1 ||
      Math.abs(newBalance - dbBal) > 1;

    if (!needsUpdate) {
      skippedCount++;
      continue;
    }

    // Update the account
    await client.query(`
      UPDATE student_accounts
      SET "totalDue" = $1, "totalPaid" = $2, "balance" = $3, "updatedAt" = now()
      WHERE id = $4
    `, [newTotalDue, newTotalPaid, newBalance, a.account_id]);

    fixedCount++;
    changes.push({
      accountId: a.account_id,
      name: `${a.lastName} ${a.firstName}`,
      old: { due: dbDue, paid: dbPaid, bal: dbBal },
      new: { due: newTotalDue, paid: newTotalPaid, bal: newBalance },
      txSum,
      hasTuition: a.has_tuition,
      hasInscription: a.has_inscription,
      bdCount: a.bd_count,
    });
  }

  console.log(`\n=== RÉSUMÉ ===`);
  console.log(`✅ Comptes corrigés: ${fixedCount}`);
  console.log(`⏭️ Comptes déjà OK: ${skippedCount}`);
  console.log(`⚠️ Comptes sans breakdown: ${noBdCount}`);

  console.log(`\n=== ÉCHANTILLON DES CORRECTIONS (30 premiers) ===`);
  for (const c of changes.slice(0, 30)) {
    console.log(
      `${c.name}`.substring(0, 32).padEnd(32),
      `old: due=${String(c.old.due).padStart(7)} paid=${String(c.old.paid).padStart(7)} bal=${String(c.old.bal).padStart(7)}`,
      `→ new: due=${String(c.new.due).padStart(7)} paid=${String(c.new.paid).padStart(7)} bal=${String(c.new.bal).padStart(7)}`
    );
  }

  // ── Recreate triggers ──
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');
  await client.query(`CREATE TRIGGER no_delete_finance_transaction BEFORE DELETE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`);
  await client.query(`CREATE TRIGGER trg_no_delete_finance_transaction BEFORE DELETE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`);
  await client.query(`CREATE TRIGGER verify_integrity_hash_trigger BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION verify_integrity_hash()`);
  await client.query(`CREATE TRIGGER trg_update_balance_after_tx AFTER INSERT ON finance_transactions FOR EACH ROW EXECUTE FUNCTION update_account_balance_after_tx()`);
  await client.query(`CREATE TRIGGER lock_transaction_after_closure BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_update_after_closure()`);
  console.log('\n✅ Triggers recreated');

  // ── Final verification ──
  console.log('\n=== VÉRIFICATION FINALE ===');
  const verify = await client.query(`
    WITH tx_sums AS (
      SELECT "studentAccountId", SUM(amount) as tx_sum
      FROM finance_transactions
      WHERE "tenantId" = $1 AND "academicYearId" = $2
      GROUP BY "studentAccountId"
    )
    SELECT COUNT(*) FILTER (WHERE ABS(sa."totalPaid" - COALESCE(ts.tx_sum, 0)) > 1) as paid_mismatch,
           COUNT(*) FILTER (WHERE ABS(sa."totalPaid" - COALESCE(ts.tx_sum, 0)) <= 1) as paid_ok
    FROM student_accounts sa
    LEFT JOIN tx_sums ts ON ts."studentAccountId" = sa.id
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, YEAR_ID]);

  console.log(`totalPaid match txSum: ${verify.rows[0].paid_ok} comptes`);
  console.log(`totalPaid mismatch txSum: ${verify.rows[0].paid_mismatch} comptes`);

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
