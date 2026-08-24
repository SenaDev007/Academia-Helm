/**
 * VÉRIFICATION FINALE — Compare DB avec Excel avec la BONNE interprétation
 *
 *   Excel "Total des payements" (col 16) = DB totalPaid
 *   Excel "Reste" (col 15) = DB balance
 *   DB totalDue = Excel "Total des payements" + Excel "Reste"
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

  const r = await client.query(`
    SELECT s.id, s."lastName", s."firstName",
           sa."totalDue", sa."totalPaid", sa."balance"
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
      AND s.status != 'WITHDRAWN'
  `, [TENANT_ID, YEAR_ID]);

  const byFullName = new Map();
  const byLastName = new Map();
  for (const s of r.rows) {
    const full = `${s.lastName || ''} ${s.firstName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
    byFullName.set(full, s);
    const ln = (s.lastName || '').trim().toLowerCase().split(' ')[0];
    if (ln && ln.length > 2) {
      if (!byLastName.has(ln)) byLastName.set(ln, []);
      byLastName.get(ln).push(s);
    }
  }

  let matchPaid = 0, mismatchPaid = 0;
  let matchBal = 0, mismatchBal = 0;
  let matchDue = 0, mismatchDue = 0;
  let notFound = 0;
  const mismatches = [];

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
        const excelExpectedDue = excelTotalPay + excelReste;

        const nm = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
        let st = byFullName.get(nm);
        if (!st) {
          const parts = nm.split(' ').filter(p => p.length > 2);
          const ln = parts[0];
          const candidates = byLastName.get(ln) || [];
          for (const c of candidates) {
            const dbFirst = (c.firstName || '').toLowerCase();
            const excelFirst = parts.slice(1).join(' ');
            if (dbFirst.includes(parts[1] || '') || excelFirst.includes(dbFirst) || parts.length === 1) {
              st = c;
              break;
            }
          }
        }

        if (!st) {
          notFound++;
          continue;
        }

        const dbDue = Number(st.totalDue);
        const dbPaid = Number(st.totalPaid);
        const dbBal = Number(st.balance);

        if (Math.abs(dbPaid - excelTotalPay) < 1) matchPaid++; else mismatchPaid++;
        if (Math.abs(dbBal - excelReste) < 1) matchBal++; else mismatchBal++;
        if (Math.abs(dbDue - excelExpectedDue) < 1) matchDue++; else mismatchDue++;

        if (Math.abs(dbPaid - excelTotalPay) > 1 || Math.abs(dbBal - excelReste) > 1 || Math.abs(dbDue - excelExpectedDue) > 1) {
          mismatches.push({
            sheet: sn, name: rawName,
            dbDue, excelExpectedDue,
            dbPaid, excelTotalPay,
            dbBal, excelReste,
          });
        }
      }
    }
  }

  console.log('=== VÉRIFICATION FINALE (BONNE INTERPRÉTATION) ===\n');
  console.log(`📊 Excel "Total des payements" vs DB totalPaid :`);
  console.log(`   ✅ Match: ${matchPaid}`);
  console.log(`   ❌ Mismatch: ${mismatchPaid}`);
  console.log(`\n📊 Excel "Reste" vs DB balance :`);
  console.log(`   ✅ Match: ${matchBal}`);
  console.log(`   ❌ Mismatch: ${mismatchBal}`);
  console.log(`\n📊 Excel (Total des payements + Reste) vs DB totalDue :`);
  console.log(`   ✅ Match: ${matchDue}`);
  console.log(`   ❌ Mismatch: ${mismatchDue}`);
  console.log(`\n⚠️ Élèves non trouvés dans DB: ${notFound}`);

  if (mismatches.length > 0) {
    console.log('\n=== MISMATCHES RESTANTS (30 premiers) ===');
    console.log('Sheet | Name | DB_due | Excel_expDue | DB_paid | XLS_totalPay | DB_bal | XLS_reste');
    for (const m of mismatches.slice(0, 30)) {
      console.log(
        `${m.sheet}`.padEnd(10),
        `${m.name}`.substring(0, 30).padEnd(30),
        `due=${String(m.dbDue).padStart(7)}/${String(m.excelExpectedDue).padStart(7)}`,
        `paid=${String(m.dbPaid).padStart(7)}/${String(m.excelTotalPay).padStart(7)}`,
        `bal=${String(m.dbBal).padStart(7)}/${String(m.excelReste).padStart(6)}`
      );
    }
    if (mismatches.length > 30) {
      console.log(`\n... et ${mismatches.length - 30} autres`);
    }
  }

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
