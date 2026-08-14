/**
 * FIX FINAL — Aligne totalDue, totalPaid, balance sur les valeurs Excel
 *
 * Excel "Total des payements" = total attendu (inscription + scolarité + autres frais)
 * Excel "Reste" = reste à payer
 * Excel actual paid = Total des payements - Reste
 *
 * Règle de calcul appliquée :
 *   newTotalDue = Excel "Total des payements"
 *   newBalance = Excel "Reste"
 *   newTotalPaid = newTotalDue - newBalance
 *
 * Pour les élèves non trouvés dans Excel, on garde l'ancien calcul
 * (totalDue = somme breakdowns, totalPaid = somme transactions).
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

  // ── Drop triggers ──
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('DROP TRIGGER IF EXISTS no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS lock_transaction_after_closure ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON finance_transactions');
  console.log('✅ Triggers dropped\n');

  // ── Step 1 : Load Excel data (Total des payements + Reste) ──
  // Key = full normalized name "lastname firstname"
  const excelByName = new Map();
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

        // Normalize name
        const nm = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
        excelByName.set(nm, { totalPay: excelTotalPay, reste: excelReste, sheet: sn });
      }
    }
  }
  console.log(`📊 Excel: ${excelByName.size} élèves chargés\n`);

  // ── Step 2 : Get all DB accounts ──
  const accounts = await client.query(`
    SELECT sa.id, s."lastName", s."firstName",
           sa."totalDue", sa."totalPaid", sa."balance"
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    ORDER BY s."lastName", s."firstName"
  `, [TENANT_ID, YEAR_ID]);
  console.log(`📊 DB: ${accounts.rows.length} comptes\n`);

  let fixedFromExcel = 0;
  let fixedFromTxSum = 0; // fallback for students not in Excel
  let alreadyOk = 0;
  const changes = [];

  for (const a of accounts.rows) {
    const dbDue = Number(a.totalDue);
    const dbPaid = Number(a.totalPaid);
    const dbBal = Number(a.balance);

    // Try to find in Excel by full name
    const fullNm = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
    let excel = excelByName.get(fullNm);

    // Fuzzy matching if not found
    if (!excel) {
      // Try variations: remove dots, "M." prefix, etc.
      const cleaned = fullNm.replace(/\./g, '').replace(/\bm\b/g, '').trim().replace(/\s+/g, ' ');
      for (const [excelName, excelData] of excelByName.entries()) {
        const cleanedExcel = excelName.replace(/\./g, '').replace(/\bm\b/g, '').trim().replace(/\s+/g, ' ');
        if (cleanedExcel === cleaned || cleanedExcel.includes(cleaned) || cleaned.includes(cleanedExcel)) {
          excel = excelData;
          break;
        }
        // Try by last name match
        const lnParts = cleaned.split(' ');
        const excelParts = cleanedExcel.split(' ');
        if (lnParts.length > 0 && excelParts.length > 0 && lnParts[0] === excelParts[0]) {
          // Same last name, check if first name has any common part
          const firstDb = lnParts.slice(1).join(' ');
          const firstExcel = excelParts.slice(1).join(' ');
          if (firstDb && firstExcel && (firstDb.includes(firstExcel.substring(0, 3)) || firstExcel.includes(firstDb.substring(0, 3)))) {
            excel = excelData;
            break;
          }
        }
      }
    }

    let newTotalDue, newTotalPaid, newBalance, source;

    if (excel) {
      // Use Excel values as source of truth
      newTotalDue = excel.totalPay;
      newBalance = excel.reste;
      newTotalPaid = newTotalDue - newBalance;
      source = 'excel';
    } else {
      // Fallback: keep current values
      newTotalDue = dbDue;
      newTotalPaid = dbPaid;
      newBalance = dbBal;
      source = 'no_excel';
    }

    // Check if update needed
    const needsUpdate =
      Math.abs(newTotalDue - dbDue) > 1 ||
      Math.abs(newTotalPaid - dbPaid) > 1 ||
      Math.abs(newBalance - dbBal) > 1;

    if (!needsUpdate) {
      alreadyOk++;
      continue;
    }

    // Apply update
    await client.query(`
      UPDATE student_accounts
      SET "totalDue" = $1, "totalPaid" = $2, "balance" = $3, "updatedAt" = now()
      WHERE id = $4
    `, [newTotalDue, newTotalPaid, newBalance, a.id]);

    if (source === 'excel') fixedFromExcel++;
    else fixedFromTxSum++;

    changes.push({
      name: `${a.lastName} ${a.firstName}`,
      sheet: excel?.sheet || '-',
      old: { due: dbDue, paid: dbPaid, bal: dbBal },
      new: { due: newTotalDue, paid: newTotalPaid, bal: newBalance },
      source,
    });
  }

  console.log(`\n=== RÉSUMÉ ===`);
  console.log(`✅ Comptes corrigés depuis Excel: ${fixedFromExcel}`);
  console.log(`✅ Comptes corrigés sans Excel (fallback): ${fixedFromTxSum}`);
  console.log(`⏭️ Comptes déjà OK: ${alreadyOk}`);

  console.log(`\n=== ÉCHANTILLON DES CORRECTIONS (40 premiers) ===`);
  for (const c of changes.slice(0, 40)) {
    console.log(
      `[${c.sheet}]`.padEnd(10),
      `${c.name}`.substring(0, 30).padEnd(30),
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

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
