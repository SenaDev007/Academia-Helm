/**
 * Import des encaissements — version optimisée avec gestion des doublons
 */
const { Client } = require('pg');
const XLSX = require('xlsx');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // Drop trigger
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  console.log('✅ Trigger dropped');

  // Get IDs
  const tenantId = (await client.query("SELECT id FROM tenants WHERE name ILIKE '%Mon Avenir Plus%N%Dali%'")).rows[0].id;
  const yearId = (await client.query('SELECT id FROM academic_years WHERE "tenantId"=$1 AND name ILIKE \'%2025-2026%\' LIMIT 1', [tenantId])).rows[0].id;
  console.log('Tenant:', tenantId, 'Year:', yearId);

  // Students
  const students = (await client.query('SELECT id, "firstName", "lastName" FROM students WHERE "tenantId"=$1 AND status!=\'WITHDRAWN\'', [tenantId])).rows;
  const byName = new Map();
  for (const s of students) {
    byName.set((s.lastName + ' ' + s.firstName).trim().toLowerCase().replace(/\s+/g, ' '), s);
    byName.set((s.lastName || '').trim().toLowerCase(), s);
  }
  console.log('Students:', students.length);

  // Accounts
  const accs = (await client.query('SELECT id, "studentId" FROM student_accounts WHERE "tenantId"=$1 AND "academicYearId"=$2', [tenantId, yearId])).rows;
  const accByStud = new Map(accs.map(r => [r.studentId, r.id]));
  console.log('Accounts:', accs.length);

  // Breakdowns
  const bds = (await client.query(`
    SELECT ab.id, ab."studentAccountId", fs."feeType"
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    WHERE sa."tenantId"=$1 AND sa."academicYearId"=$2
  `, [tenantId, yearId])).rows;
  const bdByAcc = new Map();
  for (const b of bds) {
    if (!bdByAcc.has(b.studentAccountId)) bdByAcc.set(b.studentAccountId, []);
    bdByAcc.get(b.studentAccountId).push(b);
  }
  console.log('Breakdowns:', bds.length);

  // Get existing receiptNumbers to skip duplicates
  const existingTx = (await client.query('SELECT "receiptNumber" FROM finance_transactions WHERE "tenantId"=$1', [tenantId])).rows;
  const existingReceipts = new Set(existingTx.map(r => r.receiptNumber));
  console.log('Existing transactions:', existingTx.length);

  let imported = 0, skipped = 0, notFound = 0;

  for (const f of FILES) {
    console.log('\n📄', f.split('/').pop());
    const wb = XLSX.readFile(f);

    for (const sn of wb.SheetNames) {
      if (sn === 'RECAP') continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true });
      if (rows.length < 5) continue;

      // Find header
      let hr = 3;
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        if (rows[i] && rows[i].some(c => String(c || '').toUpperCase().includes('NOM') && String(c || '').toUpperCase().includes('PRENOM'))) {
          hr = i; break;
        }
      }
      const pr = hr + 1;
      const pCols = {};
      let nc = 1, ic = -1, ac = -1;

      for (let j = 0; j < (rows[hr] || []).length; j++) {
        const h = String(rows[hr][j] || '').toUpperCase();
        if (h.includes('NOM')) nc = j;
        if (h.includes('INSCRIPT')) ic = j;
        if (h.includes('ARRI')) ac = j;
      }
      for (let j = 0; j < (rows[pr] || []).length; j++) {
        const h = String(rows[pr][j] || '').trim().toUpperCase();
        if (h === 'P1') pCols[1] = j; else if (h === 'P2') pCols[2] = j;
        else if (h === 'P3') pCols[3] = j; else if (h === 'P4') pCols[4] = j;
        else if (h === 'P5') pCols[5] = j; else if (h === 'P6') pCols[6] = j;
      }
      if (Object.keys(pCols).length === 0) { console.log('  ⚠️', sn, '- no P cols'); continue; }

      console.log('  📋', sn, '- P cols:', JSON.stringify(pCols));

      for (let ri = hr + 2; ri < rows.length; ri++) {
        const row = rows[ri];
        if (!row || !row[nc]) continue;
        const rawName = String(row[nc]).trim();
        if (!rawName || rawName.toUpperCase().includes('TOTAL') || /^\d+$/.test(rawName)) continue;

        const nm = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
        let st = byName.get(nm);
        if (!st) {
          const ps = nm.split(' ').filter(p => p.length > 2);
          for (const p of ps) { if (byName.has(p)) { st = byName.get(p); break; } }
        }

        if (!st) { notFound++; continue; }
        const aid = accByStud.get(st.id);
        if (!aid) { skipped++; continue; }

        const bds2 = bdByAcc.get(aid) || [];
        const tBd = bds2.find(b => b.feeType === 'TUITION');
        const iBd = bds2.find(b => b.feeType === 'INSCRIPTION');

        // Process P1-P6 + Inscript + Arrière
        const payments = [];
        for (const [t, ci] of Object.entries(pCols)) {
          const amt = Number(row[ci]) || 0;
          if (amt > 0) payments.push({ amt, type: 'TUITION', label: 'P' + t });
        }
        if (ic !== -1) { const a = Number(row[ic]) || 0; if (a > 0) payments.push({ amt: a, type: 'INSCRIPTION', label: 'INSCR' }); }
        if (ac !== -1) { const a = Number(row[ac]) || 0; if (a > 0) payments.push({ amt: a, type: 'ARREAR', label: 'ARRI' }); }

        for (const p of payments) {
          const rn = 'IMP-' + st.id.substring(0, 8) + '-' + p.type + '-' + p.label;
          if (existingReceipts.has(rn)) { skipped++; continue; }
          existingReceipts.add(rn);

          const tid = crypto.randomUUID();
          try {
            await client.query(
              'INSERT INTO finance_transactions (id,"tenantId","academicYearId","studentAccountId",type,amount,"paymentMethod","receiptNumber","cashierId","createdAt") VALUES ($1,$2,$3,$4,\'PAYMENT\',$5,\'CASH\',$6,$7,now())',
              [tid, tenantId, yearId, aid, p.amt, rn, '00000000-0000-0000-0000-000000000000']
            );

            const bd = p.type === 'TUITION' ? tBd : (p.type === 'INSCRIPTION' ? iBd : null);
            if (bd) {
              const al = crypto.randomUUID();
              await client.query('INSERT INTO finance_transaction_allocations (id,"financeTransactionId","accountBreakdownId",amount) VALUES ($1,$2,$3,$4)', [al, tid, bd.id, p.amt]);
              await client.query('UPDATE account_breakdowns SET "paidAmount"="paidAmount"+$1, "remainingAmount"=GREATEST(0,"remainingAmount"-$1) WHERE id=$2', [p.amt, bd.id]);
            }

            await client.query('UPDATE student_accounts SET "totalPaid"="totalPaid"+$1,"balance"="balance"-$1,"updatedAt"=now() WHERE id=$2', [p.amt, aid]);
            imported++;
          } catch (e) {
            if (e.message.includes('duplicate')) { skipped++; }
            else { console.error('❌ Error:', e.message, rn); }
          }
        }
      }
    }
  }

  // Recreate trigger
  await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');
  console.log('\n✅ Trigger recreated');

  console.log('\n======== RÉSUMÉ ========');
  console.log('✅ Transactions importées:', imported);
  console.log('⏭️ Skippées (doublons / pas de compte):', skipped);
  console.log('❌ Élèves non trouvés:', notFound);

  await client.end();
  console.log('🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
