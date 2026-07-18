/**
 * Correction finale des 24 écarts restants.
 *
 * Utilise les données Excel comme source de vérité pour ajuster
 * directement les paidAmount des account_breakdowns.
 *
 * Pour chaque élève avec écart :
 *   1. Lire le montant INSCRIPTION et TUITION (P1+P2+P3+P4+P5+P6) depuis Excel
 *   2. Comparer avec DB (account_breakdowns.paidAmount)
 *   3. Si DB INSCRIPTION ≠ Excel INSCRIPTION :
 *      - Calculer la différence
 *      - Ajuster les allocations pour que la somme corresponde
 *   4. Recalculer student_accounts.totalPaid et balance
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
        // Store with multiple normalizations
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
          if (!result.has(n)) {
            result.set(n, { name, inscript, tuition });
          }
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

  // Charger données DB avec breakdowns
  const loadClient = await getClient();
  const dbData = await loadClient.query(`
    SELECT
      s.id as student_id,
      s."firstName",
      s."lastName",
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
      WHERE ab."studentAccountId" = sa.id AND fs."feeType" = 'INSCRIPTION'
      LIMIT 1
    ) ab_ins ON true
    LEFT JOIN LATERAL (
      SELECT ab.* FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = sa.id AND fs."feeType" = 'TUITION'
      LIMIT 1
    ) ab_tui ON true
    WHERE s."tenantId" = $1
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${dbData.rows.length} élèves en DB\n`);
  await loadClient.end();

  // Trouver les élèves avec écart
  const fixes = [];
  for (const r of dbData.rows) {
    // Construire le nom normalisé
    const fullName = r.firstName + ' ' + r.lastName;
    const norm = fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    // Essayer aussi le format inversé
    const reversed = r.lastName + ' ' + r.firstName;
    const normRev = reversed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const excel = excelStudents.get(norm) || excelStudents.get(normRev);
    if (!excel) continue;

    const dbInscript = Number(r.inscription_paid) || 0;
    const dbTuition = Number(r.tuition_paid) || 0;
    const excelInscript = excel.inscript;
    const excelTuition = excel.tuition;

    const inscriptDiff = excelInscript - dbInscript; // positive = need to add to INSCRIPTION
    const tuitionDiff = excelTuition - dbTuition; // positive = need to add to TUITION

    if (Math.abs(inscriptDiff) > 1 || Math.abs(tuitionDiff) > 1) {
      fixes.push({
        studentId: r.student_id,
        accountId: r.account_id,
        studentName: fullName,
        className: r.class_name,
        inscriptionBdId: r.inscription_bd_id,
        tuitionBdId: r.tuition_bd_id,
        dbInscript,
        dbTuition,
        excelInscript,
        excelTuition,
        inscriptDiff,
        tuitionDiff,
      });
    }
  }

  console.log(`=== ${fixes.length} élèves avec écart à corriger ===\n`);
  fixes.slice(0, 30).forEach((f, i) => {
    console.log(`${i + 1}. ${f.studentName} (${f.className})`);
    if (Math.abs(f.inscriptDiff) > 1) {
      console.log(`   INSCRIPTION: Excel=${f.excelInscript} | DB=${f.dbInscript} | Δ=${f.inscriptDiff}`);
    }
    if (Math.abs(f.tuitionDiff) > 1) {
      console.log(`   TUITION: Excel=${f.excelTuition} | DB=${f.dbTuition} | Δ=${f.tuitionDiff}`);
    }
  });

  if (fixes.length === 0) {
    console.log('✅ Aucune correction nécessaire.');
    return;
  }

  // Appliquer les corrections
  console.log(`\n=== Application des corrections ===`);
  let applied = 0;
  let errors = 0;
  const fs = require('fs');
  fs.writeFileSync('/tmp/fix-final-progress.log', `Starting ${fixes.length} fixes\n`);

  for (const f of fixes) {
    let client = null;
    try {
      client = await getClient();
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.allow_balance_update = 'true'`);

      // Stratégie : ajuster les paidAmount directement + ajuster les allocations
      // pour que la somme corresponde.

      // 1. Ajuster INSCRIPTION
      if (Math.abs(f.inscriptDiff) > 1 && f.inscriptionBdId) {
        // Trouver une allocation sur INSCRIPTION et ajuster son montant
        // Ou créer/supprimer des allocations pour atteindre le bon montant
        const insAllocs = await client.query(`
          SELECT id, amount, "financeTransactionId"
          FROM finance_transaction_allocations
          WHERE "accountBreakdownId" = $1
          ORDER BY amount DESC
        `, [f.inscriptionBdId]);

        if (f.inscriptDiff > 0) {
          // Besoin d'ajouter de l'argent à INSCRIPTION
          // Prendre une allocation TUITION et la déplacer vers INSCRIPTION
          if (f.tuitionBdId) {
            const tuiAllocs = await client.query(`
              SELECT id, amount, "financeTransactionId"
              FROM finance_transaction_allocations
              WHERE "accountBreakdownId" = $1
              ORDER BY amount DESC
              LIMIT 1
            `, [f.tuitionBdId]);

            if (tuiAllocs.rows.length > 0) {
              const tuiAlloc = tuiAllocs.rows[0];
              const moveAmount = Math.min(f.inscriptDiff, Number(tuiAlloc.amount));
              const newTuiAmount = Number(tuiAlloc.amount) - moveAmount;

              if (newTuiAmount <= 0) {
                // Déplacer toute l'allocation vers INSCRIPTION
                // D'abord vérifier s'il existe déjà une allocation INSCRIPTION pour cette tx
                const existingIns = await client.query(`
                  SELECT id, amount FROM finance_transaction_allocations
                  WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
                `, [tuiAlloc.financeTransactionId, f.inscriptionBdId]);

                if (existingIns.rows.length > 0) {
                  // Fusionner
                  await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                    [Number(existingIns.rows[0].amount) + Number(tuiAlloc.amount), existingIns.rows[0].id]);
                  await client.query(`DELETE FROM finance_transaction_allocations WHERE id = $1`, [tuiAlloc.id]);
                } else {
                  // Re-tag
                  await client.query(`UPDATE finance_transaction_allocations SET "accountBreakdownId" = $1 WHERE id = $2`,
                    [f.inscriptionBdId, tuiAlloc.id]);
                }
              } else {
                // Réduire l'allocation TUITION
                await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                  [newTuiAmount, tuiAlloc.id]);
                // Créer ou fusionner une allocation INSCRIPTION
                const existingIns = await client.query(`
                  SELECT id, amount FROM finance_transaction_allocations
                  WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
                `, [tuiAlloc.financeTransactionId, f.inscriptionBdId]);

                if (existingIns.rows.length > 0) {
                  await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                    [Number(existingIns.rows[0].amount) + moveAmount, existingIns.rows[0].id]);
                } else {
                  await client.query(`INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount) VALUES (gen_random_uuid(), $1, $2, $3)`,
                    [tuiAlloc.financeTransactionId, f.inscriptionBdId, moveAmount]);
                }
              }
            }
          }
        } else {
          // Besoin de retirer de l'argent d'INSCRIPTION (inscriptDiff < 0)
          // Déplacer vers TUITION
          if (f.tuitionBdId && insAllocs.rows.length > 0) {
            const insAlloc = insAllocs.rows[0];
            const moveAmount = Math.min(-f.inscriptDiff, Number(insAlloc.amount));
            const newInsAmount = Number(insAlloc.amount) - moveAmount;

            if (newInsAmount <= 0) {
              const existingTui = await client.query(`
                SELECT id, amount FROM finance_transaction_allocations
                WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
              `, [insAlloc.financeTransactionId, f.tuitionBdId]);

              if (existingTui.rows.length > 0) {
                await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                  [Number(existingTui.rows[0].amount) + Number(insAlloc.amount), existingTui.rows[0].id]);
                await client.query(`DELETE FROM finance_transaction_allocations WHERE id = $1`, [insAlloc.id]);
              } else {
                await client.query(`UPDATE finance_transaction_allocations SET "accountBreakdownId" = $1 WHERE id = $2`,
                  [f.tuitionBdId, insAlloc.id]);
              }
            } else {
              await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                [newInsAmount, insAlloc.id]);
              const existingTui = await client.query(`
                SELECT id, amount FROM finance_transaction_allocations
                WHERE "financeTransactionId" = $1 AND "accountBreakdownId" = $2
              `, [insAlloc.financeTransactionId, f.tuitionBdId]);

              if (existingTui.rows.length > 0) {
                await client.query(`UPDATE finance_transaction_allocations SET amount = $1 WHERE id = $2`,
                  [Number(existingTui.rows[0].amount) + moveAmount, existingTui.rows[0].id]);
              } else {
                await client.query(`INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount) VALUES (gen_random_uuid(), $1, $2, $3)`,
                  [insAlloc.financeTransactionId, f.tuitionBdId, moveAmount]);
              }
            }
          }
        }
      }

      // 2. Recalculer les paidAmount des breakdowns depuis les allocations
      for (const bdId of [f.inscriptionBdId, f.tuitionBdId]) {
        if (!bdId) continue;
        const paidRes = await client.query(`
          SELECT COALESCE(SUM(fta.amount), 0) as total
          FROM finance_transaction_allocations fta
          WHERE fta."accountBreakdownId" = $1
        `, [bdId]);
        const newPaid = Number(paidRes.rows[0].total);
        const bdRes = await client.query(`SELECT "initialAmount" FROM account_breakdowns WHERE id = $1`, [bdId]);
        const initial = Number(bdRes.rows[0]?.initialAmount || 0);
        const remaining = Math.max(0, initial - newPaid);
        await client.query(`UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = $2 WHERE id = $3`,
          [newPaid, remaining, bdId]);
      }

      // 3. Recalculer student_accounts
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
      const msg = `[${applied}/${fixes.length}] ${f.studentName} (${f.className}) OK`;
      console.log(`   ${msg}`);
      fs.appendFileSync('/tmp/fix-final-progress.log', msg + '\n');
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      errors++;
      const errMsg = `❌ ${f.studentName}: ${err.message}`;
      console.error(errMsg);
      fs.appendFileSync('/tmp/fix-final-progress.log', errMsg + '\n');
    } finally {
      if (client) {
        try { await client.end(); } catch {}
      }
    }
    await sleep(50);
  }

  console.log(`\n=== Statistiques finales ===`);
  console.log(`  Corrections appliquées: ${applied}/${fixes.length}`);
  console.log(`  Erreurs: ${errors}`);
  console.log('\n✅ Terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
