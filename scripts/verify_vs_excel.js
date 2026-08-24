/**
 * VÉRIFICATION FINALE — Compare les valeurs DB (après fix) avec Excel
 * "Total des payements" et "Reste à payer"
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

  // Get all DB accounts
  const r = await client.query(`
    SELECT s.id, s."lastName", s."firstName",
           sa."totalDue", sa."totalPaid", sa."balance"
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
      AND s.status != 'WITHDRAWN'
  `, [TENANT_ID, YEAR_ID]);

  // Build maps by full name and by last name
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

  // Compare against Excel
  let matchDue = 0, mismatchDue = 0;
  let matchBal = 0, mismatchBal = 0;
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

        // Match student in DB
        const nm = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
        let st = byFullName.get(nm);
        if (!st) {
          // Try by last name + firstName match
          const parts = nm.split(' ').filter(p => p.length > 2);
          const ln = parts[0];
          const candidates = byLastName.get(ln) || [];
          for (const c of candidates) {
            // Check if first name parts overlap
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
        const dbBal = Number(st.balance);
        const dueMatch = Math.abs(dbDue - excelTotalPay) < 1;
        const balMatch = Math.abs(dbBal - excelReste) < 1;

        if (dueMatch) matchDue++; else mismatchDue++;
        if (balMatch) matchBal++; else mismatchBal++;

        if (!dueMatch || !balMatch) {
          mismatches.push({
            sheet: sn, name: rawName,
            dbDue, excelTotalPay,
            dbBal, excelReste,
            dbPaid: Number(st.totalPaid),
          });
        }
      }
    }
  }

  console.log('=== COMPARAISON DB vs EXCEL APRÈS FIX ===\n');
  console.log(`totalDue match Excel "Total des payements": ${matchDue}`);
  console.log(`totalDue mismatch: ${mismatchDue}`);
  console.log(`balance match Excel "Reste à payer": ${matchBal}`);
  console.log(`balance mismatch: ${mismatchBal}`);
  console.log(`Élèves non trouvés: ${notFound}`);

  if (mismatches.length > 0) {
    console.log('\n=== MISMATCHES (60 premiers) ===');
    console.log('Sheet | Name | DB_due | XLS_totalPay | DB_bal | XLS_reste | DB_paid');
    for (const m of mismatches.slice(0, 60)) {
      console.log(
        `${m.sheet}`.padEnd(10),
        `${m.name}`.substring(0, 32).padEnd(32),
        `due=${String(m.dbDue).padStart(7)}`,
        `pay=${String(m.excelTotalPay).padStart(7)}`,
        `bal=${String(m.dbBal).padStart(7)}`,
        `rst=${String(m.excelReste).padStart(6)}`,
        `pd=${String(m.dbPaid).padStart(7)}`
      );
    }
    if (mismatches.length > 60) {
      console.log(`\n... et ${mismatches.length - 60} autres`);
    }
  }

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
