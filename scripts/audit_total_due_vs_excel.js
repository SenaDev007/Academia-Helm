/**
 * Audit complet Excel vs DB pour Mon Avenir Plus
 * Compare :
 *   - Excel "Total des payements" (col 16) vs DB totalDue
 *   - Excel "Reste" (col 15) vs DB balance
 *   - Excel "Total Scolarité" (col 14) vs DB totalDue - totalPaid (expected remaining)
 */
const { Client } = require('pg');
const XLSX = require('xlsx');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected\n');

  // ── 1. Récupérer tous les élèves de Mon Avenir Plus avec leurs comptes ──
  const students = await client.query(`
    SELECT s.id, s."firstName", s."lastName",
           sa.id as "accountId", sa."totalDue", sa."totalPaid", sa."balance", sa."arrearsAmount"
    FROM students s
    LEFT JOIN student_accounts sa ON sa."studentId" = s.id
      AND sa."academicYearId" = $2
      AND sa."tenantId" = $1
    WHERE s."tenantId" = $1 AND s.status != 'WITHDRAWN'
    ORDER BY s."lastName", s."firstName"
  `, [TENANT_ID, YEAR_ID]);

  // Map by normalized name (last + first, lowercase, single-spaced)
  const byName = new Map();
  const byLastName = new Map();
  for (const s of students.rows) {
    const fullName = `${s.lastName || ''} ${s.firstName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
    byName.set(fullName, s);
    const ln = (s.lastName || '').trim().toLowerCase();
    if (ln) byLastName.set(ln, s);
  }
  console.log(`📊 ${students.rows.length} élèves dans la DB\n`);

  // ── 2. Pour chaque fichier Excel, parser les lignes et comparer ──
  const mismatches = [];
  const matches = [];
  const notFoundInDb = [];

  for (const f of FILES) {
    console.log('\n' + '='.repeat(80));
    console.log('📄', f.split('/').pop());
    console.log('='.repeat(80));

    const wb = XLSX.readFile(f);

    for (const sn of wb.SheetNames) {
      if (sn === 'RECAP') continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true });
      if (rows.length < 5) continue;

      // Header row 3 (index 3) has the column names
      const hr = 3;
      const header = rows[hr] || [];
      let nc = 1;   // Noms col
      // Total des payements is col 16 (index 16)
      // Reste is col 15
      // Total Scolarité is col 14
      let totalPayCol = -1, resteCol = -1, totalScolCol = -1;
      for (let j = 0; j < header.length; j++) {
        const h = String(header[j] || '').toLowerCase().trim();
        if (h.includes('noms')) nc = j;
        if (h.includes('total des pay') || h.includes('total des pai')) totalPayCol = j;
        if (h === 'reste') resteCol = j;
        if (h.includes('total scolar')) totalScolCol = j;
      }
      if (totalPayCol === -1) {
        console.log(`  ⚠️ ${sn}: pas de colonne 'Total des payements' trouvée`);
        continue;
      }

      console.log(`\n📋 Feuille: ${sn} | cols: name=${nc}, totalScol=${totalScolCol}, reste=${resteCol}, totalPay=${totalPayCol}`);

      let sheetCount = 0, sheetMatch = 0, sheetMismatch = 0, sheetNotFound = 0;

      // Data starts at row hr+2 (row 5)
      for (let ri = hr + 2; ri < rows.length; ri++) {
        const row = rows[ri];
        if (!row || !row[nc]) continue;
        const rawName = String(row[nc]).trim();
        if (!rawName || rawName.toUpperCase().includes('TOTAL') || /^\d+$/.test(rawName)) continue;

        const excelTotalPay = Number(row[totalPayCol]) || 0;
        const excelReste = Number(row[resteCol]) || 0;
        const excelTotalScol = Number(row[totalScolCol]) || 0;

        // Match student in DB
        const nm = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
        let st = byName.get(nm);
        if (!st) {
          // Try matching by last name only
          const ps = nm.split(' ').filter(p => p.length > 2);
          for (const p of ps) {
            if (byLastName.has(p)) { st = byLastName.get(p); break; }
          }
        }
        if (!st) {
          // Try fuzzy: match by key parts
          for (const [dbName, s] of byName.entries()) {
            const dbParts = dbName.split(' ').filter(p => p.length > 2);
            const excelParts = nm.split(' ').filter(p => p.length > 2);
            const common = dbParts.filter(p => excelParts.includes(p));
            if (common.length >= 2) { st = s; break; }
            if (common.length === 1 && dbParts.length <= 2 && excelParts.length <= 2) { st = s; break; }
          }
        }

        if (!st) {
          notFoundInDb.push({ sheet: sn, name: rawName, excelTotalPay });
          sheetNotFound++;
          continue;
        }

        if (!st.accountId) {
          notFoundInDb.push({ sheet: sn, name: rawName, excelTotalPay, reason: 'no account' });
          sheetNotFound++;
          continue;
        }

        sheetCount++;
        const dbTotalDue = Number(st.totalDue) || 0;
        const dbBalance = Number(st.balance) || 0;
        const dbTotalPaid = Number(st.totalPaid) || 0;

        // ⭐ Excel "Total des payements" = ce que l'élève DOIT payer au total (expected total)
        //    DB "totalDue" = expected total amount (matches Excel "Total des payements")
        const totalDueMatch = Math.abs(dbTotalDue - excelTotalPay) < 1;
        // ⭐ Excel "Reste" = reste à payer (remaining)
        //    DB "balance" = remaining amount
        const balanceMatch = Math.abs(dbBalance - excelReste) < 1;

        if (totalDueMatch && balanceMatch) {
          sheetMatch++;
          matches.push({ sheet: sn, name: rawName, dbTotalDue, excelTotalPay, dbBalance, excelReste });
        } else {
          sheetMismatch++;
          mismatches.push({
            sheet: sn,
            name: rawName,
            studentId: st.id,
            accountId: st.accountId,
            dbTotalDue,
            excelTotalPay,
            dbBalance,
            excelReste,
            dbTotalPaid,
            excelTotalScol,
            totalDueDiff: excelTotalPay - dbTotalDue,
            balanceDiff: excelReste - dbBalance,
          });
        }
      }

      console.log(`  → ${sheetCount} élèves comparés | ✅ ${sheetMatch} OK | ❌ ${sheetMismatch} mismatch | ⚠️ ${sheetNotFound} non trouvés`);
    }
  }

  // ── 3. Rapport final ──
  console.log('\n\n' + '='.repeat(80));
  console.log('RAPPORT FINAL');
  console.log('='.repeat(80));
  console.log(`\nTotal élèves matchés OK : ${matches.length}`);
  console.log(`Total élèves mismatch  : ${mismatches.length}`);
  console.log(`Total élèves non trouvés dans DB : ${notFoundInDb.length}`);

  if (mismatches.length > 0) {
    console.log('\n--- DÉTAILS DES MISMATCHES (50 premiers) ---');
    console.log('Name | DB totalDue | Excel totalPay | Diff | DB balance | Excel reste | Diff | DB totalPaid');
    for (const m of mismatches.slice(0, 50)) {
      console.log(
        `${m.sheet} | ${m.name}`.padEnd(40),
        `| DB_due=${String(m.dbTotalDue).padStart(7)}`,
        `XLS_pay=${String(m.excelTotalPay).padStart(7)}`,
        `diff=${String(m.totalDueDiff).padStart(6)}`,
        `| DB_bal=${String(m.dbBalance).padStart(7)}`,
        `XLS_reste=${String(m.excelReste).padStart(6)}`,
        `diff=${String(m.balanceDiff).padStart(6)}`,
        `| DB_paid=${String(m.dbTotalPaid).padStart(7)}`
      );
    }
    if (mismatches.length > 50) {
      console.log(`\n... et ${mismatches.length - 50} autres mismatches`);
    }

    // Stats
    const dueTooLow = mismatches.filter(m => m.totalDueDiff > 0).length;
    const dueTooHigh = mismatches.filter(m => m.totalDueDiff < 0).length;
    const balTooLow = mismatches.filter(m => m.balanceDiff > 0).length;
    const balTooHigh = mismatches.filter(m => m.balanceDiff < 0).length;
    console.log('\n--- STATISTIQUES ---');
    console.log(`totalDue trop bas dans DB (Excel > DB): ${dueTooLow}`);
    console.log(`totalDue trop haut dans DB (Excel < DB): ${dueTooHigh}`);
    console.log(`balance trop basse dans DB (Excel > DB): ${balTooLow}`);
    console.log(`balance trop haute dans DB (Excel < DB): ${balTooHigh}`);
  }

  if (notFoundInDb.length > 0) {
    console.log('\n--- ÉLÈVES NON TROUVÉS DANS DB ---');
    for (const n of notFoundInDb.slice(0, 30)) {
      console.log(`  ${n.sheet} | ${n.name} | excelTotalPay=${n.excelTotalPay} | ${n.reason || ''}`);
    }
    if (notFoundInDb.length > 30) {
      console.log(`\n... et ${notFoundInDb.length - 30} autres`);
    }
  }

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
