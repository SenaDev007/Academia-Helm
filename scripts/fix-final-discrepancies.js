/**
 * Correction finale des 22 écarts restants (approche directe).
 *
 * Problème : les scripts de correction précédents ont ajouté 8000 (ou 5000)
 * en trop sur certaines allocations TUITION, et l'INSCRIPTION est à 0 au lieu
 * du montant attendu.
 *
 * Solution : pour chaque élève avec écart :
 *   1. Calculer l'excès TUITION = DB TUITION - Excel TUITION
 *   2. Trouver la première allocation TUITION et la réduire de l'excès
 *   3. Si INSCRIPTION paid < Excel INSCRIPTION :
 *      - Créer/augmenter une allocation INSCRIPTION du même montant
 *   4. Recalculer les breakdowns et student_accounts
 */
const XLSX = require('xlsx');
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

const EXCEL_FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

function readExcelStudents() {
  const result = new Map();
  for (const f of EXCEL_FILES) {
    const wb = XLSX.readFile(f);
    for (const sheetName of wb.SheetNames) {
      if (sheetName === 'RECAP') continue;
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      for (let i = 5; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1]) continue;
        const name = String(row[1]).trim();
        if (!name || name.toUpperCase().includes('TOTAL')) continue;
        const num = (v) => {
          if (v === null || v === undefined || v === '') return 0;
          if (typeof v === 'number') return v;
          return Number(String(v).replace(/[\s,]/g, '')) || 0;
        };
        const inscript = num(row[4]);
        const tuition = num(row[8]) + num(row[9]) + num(row[10]) + num(row[11]) + num(row[12]) + num(row[13]);
        const norms = new Set();
        const norm1 = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        norms.add(norm1);
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
          const norm2 = (parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' '))
            .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
          norms.add(norm2);
        }
        for (const n of norms) {
          if (!result.has(n)) result.set(n, { name, inscript, tuition });
        }
      }
    }
  }
  return result;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getClient() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
  });
  await client.connect();
  return client;
}

async function main() {
  console.log('=== Lecture Excel ===');
  const excelStudents = readExcelStudents();
  console.log(`  ${excelStudents.size} entrées Excel\n`);

  const loadClient = await getClient();
  const dbData = await loadClient.query(`
    SELECT
      s.id as student_id, s."firstName", s."lastName",
      c.name as class_name,
      sa.id as account_id,
      ab_ins.id as inscription_bd_id,
      ab_ins."paidAmount" as inscription_paid,
      ab_ins."initialAmount" as inscription_initial,
      ab_tui.id as tuition_bd_id,
      ab_tui."paidAmount" as tuition_paid,
      ab_tui."initialAmount" as tuition_initial
    FROM students s
    JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = $2
    LEFT JOIN classes c ON c.id = se."classId"
    JOIN student_accounts sa ON sa."studentId" = s.id AND sa."academicYearId" = $2
    LEFT JOIN LATERAL (
      SELECT ab.* FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = sa.id AND fs."feeType" = 'INSCRIPTION' LIMIT 1
    ) ab_ins ON true
    LEFT JOIN LATERAL (
      SELECT ab.* FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = sa.id AND fs."feeType" = 'TUITION' LIMIT 1
    ) ab_tui ON true
    WHERE s."tenantId" = $1
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${dbData.rows.length} élèves en DB\n`);
  await loadClient.end();

  // Identifier les élèves avec écart
  const fixes = [];
  for (const r of dbData.rows) {
    const fullName = r.firstName + ' ' + r.lastName;
    const norm = fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const reversed = r.lastName + ' ' + r.firstName;
    const normRev = reversed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const excel = excelStudents.get(norm) || excelStudents.get(normRev);
    if (!excel) continue;

    const dbInscript = Number(r.inscription_paid) || 0;
    const dbTuition = Number(r.tuition_paid) || 0;
    const excelInscript = excel.inscript;
    const excelTuition = excel.tuition;

    if (Math.abs(dbInscript - excelInscript) > 1 || Math.abs(dbTuition - excelTuition) > 1) {
      fixes.push({
        studentId: r.student_id,
        accountId: r.account_id,
        studentName: fullName,
        className: r.class_name,
        inscriptionBdId: r.inscription_bd_id,
        tuitionBdId: r.tuition_bd_id,
        dbInscript, dbTuition, excelInscript, excelTuition,
      });
    }
  }

  console.log(`=== ${fixes.length} élèves avec écart ===\n`);

  let applied = 0, errors = 0;
  for (const f of fixes) {
    let client = null;
    try {
      client = await getClient();
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.allow_balance_update = 'true'`);

      const tuitionExcess = f.dbTuition - f.excelTuition; // positive = need to remove from TUITION
      const inscriptDeficit = f.excelInscript - f.dbInscript; // positive = need to add to INSCRIPTION

      console.log(`  ${f.studentName} (${f.className}): tuitionExcess=${tuitionExcess}, inscriptDeficit=${inscriptDeficit}`);

      // 1. Réduire une allocation TUITION de l'excès
      if (tuitionExcess > 1 && f.tuitionBdId) {
        const tuiAllocs = await client.query(`
          SELECT id, amount, "financeTransactionId"
          FROM finance_transaction_allocations
          WHERE "accountBreakdownId" = $1
          ORDER BY amount DESC LIMIT 1
        `, [f.tuitionBdId]);

        if (tuiAllocs.rows.length > 0) {
          const alloc = tuiAllocs.rows[0];
          const reduceAmount = Math.min(tuitionExcess, Number(alloc.amount));
          const newAmount = Number(alloc.amount) - reduceAmount;

          if (newAmount <= 0) {
            await client.query(`DELETE FROM finance_transaction_allocations WHERE id = $1`, [alloc.id]);
          } else {
            await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`, [newAmount, alloc.id]);
          }

          // 2. Si INSCRIPTION a un déficit, créer/augmenter une allocation INSCRIPTION
          if (inscriptDeficit > 1 && f.inscriptionBdId) {
            const moveAmount = Math.min(reduceAmount, inscriptDeficit);
            const existingIns = await client.query(`
              SELECT id, amount FROM finance_transaction_allocations
              WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
            `, [alloc.financeTransactionId, f.inscriptionBdId]);

            if (existingIns.rows.length > 0) {
              await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                [Number(existingIns.rows[0].amount) + moveAmount, existingIns.rows[0].id]);
            } else {
              await client.query(`INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount) VALUES (gen_random_uuid(), $1, $2, $3)`,
                [alloc.financeTransactionId, f.inscriptionBdId, moveAmount]);
            }
          }
        }
      }

      // 3. Si INSCRIPTION a encore un déficit (et TUITION n'avait pas d'excès)
      if (inscriptDeficit > 1 && f.inscriptionBdId && f.tuitionBdId) {
        const currentIns = await client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM finance_transaction_allocations WHERE "accountBreakdownId" = $1`, [f.inscriptionBdId]);
        const currentInsPaid = Number(currentIns.rows[0].total);
        const remainingDeficit = f.excelInscript - currentInsPaid;

        if (remainingDeficit > 1) {
          // Prendre une allocation TUITION et la déplacer vers INSCRIPTION
          const tuiAllocs2 = await client.query(`
            SELECT id, amount, "financeTransactionId"
            FROM finance_transaction_allocations
            WHERE "accountBreakdownId" = $1
            ORDER BY amount DESC LIMIT 1
          `, [f.tuitionBdId]);

          if (tuiAllocs2.rows.length > 0) {
            const alloc = tuiAllocs2.rows[0];
            const moveAmount = Math.min(remainingDeficit, Number(alloc.amount));
            const newTuiAmount = Number(alloc.amount) - moveAmount;

            if (newTuiAmount <= 0) {
              const existingIns = await client.query(`
                SELECT id, amount FROM finance_transaction_allocations
                WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
              `, [alloc.financeTransactionId, f.inscriptionBdId]);
              if (existingIns.rows.length > 0) {
                await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                  [Number(existingIns.rows[0].amount) + Number(alloc.amount), existingIns.rows[0].id]);
                await client.query(`DELETE FROM finance_transaction_allocations WHERE id = $1`, [alloc.id]);
              } else {
                await client.query(`UPDATE finance_transaction_allocations SET "accountBreakdownId" = $1 WHERE id = $2`,
                  [f.inscriptionBdId, alloc.id]);
              }
            } else {
              await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`, [newTuiAmount, alloc.id]);
              const existingIns = await client.query(`
                SELECT id, amount FROM finance_transaction_allocations
                WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
              `, [alloc.financeTransactionId, f.inscriptionBdId]);
              if (existingIns.rows.length > 0) {
                await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                  [Number(existingIns.rows[0].amount) + moveAmount, existingIns.rows[0].id]);
              } else {
                await client.query(`INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount) VALUES (gen_random_uuid(), $1, $2, $3)`,
                  [alloc.financeTransactionId, f.inscriptionBdId, moveAmount]);
              }
            }
          }
        }
      }

      // 4. Recalculer paidAmount des breakdowns
      for (const bdId of [f.inscriptionBdId, f.tuitionBdId]) {
        if (!bdId) continue;
        const paidRes = await client.query(`SELECT COALESCE(SUM(fta.amount), 0) as total FROM finance_transaction_allocations fta WHERE fta."accountBreakdownId" = $1`, [bdId]);
        const newPaid = Number(paidRes.rows[0].total);
        const bdRes = await client.query(`SELECT "initialAmount" FROM account_breakdowns WHERE id = $1`, [bdId]);
        const initial = Number(bdRes.rows[0]?.initialAmount || 0);
        await client.query(`UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = $2 WHERE id = $3`,
          [newPaid, Math.max(0, initial - newPaid), bdId]);
      }

      // 5. Recalculer student_accounts
      const totalsRes = await client.query(`
        SELECT
          (SELECT COALESCE(SUM(fta.amount), 0) FROM finance_transaction_allocations fta
           JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
           WHERE ft."studentAccountId" = $1 AND ft."academicYearId" = $2) as total_paid,
          (SELECT COALESCE(SUM(ab."initialAmount"), 0) FROM account_breakdowns ab
           WHERE ab."studentAccountId" = $1) as total_due
      `, [f.accountId, ACADEMIC_YEAR_ID]);
      const totalPaid = Number(totalsRes.rows[0].total_paid);
      const totalDue = Number(totalsRes.rows[0].total_due);
      await client.query(`UPDATE student_accounts SET "totalPaid" = $1, "balance" = $2, "totalDue" = $3, "updatedAt" = NOW() WHERE id = $4`,
        [totalPaid, Math.max(0, totalDue - totalPaid), totalDue, f.accountId]);

      await client.query('COMMIT');
      applied++;
      console.log(`    ✅ Corrigé`);
    } catch (err) {
      if (client) { try { await client.query('ROLLBACK'); } catch {} }
      errors++;
      console.error(`    ❌ ${f.studentName}: ${err.message}`);
    } finally {
      if (client) { try { await client.end(); } catch {} }
    }
    await sleep(50);
  }

  console.log(`\n=== Résultat ===`);
  console.log(`  Appliquées: ${applied}/${fixes.length}`);
  console.log(`  Erreurs: ${errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
