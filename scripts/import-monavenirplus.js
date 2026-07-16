/**
 * ============================================================================
 * IMPORT EXCEL — Mon Avenir Plus / N'Dali (CSP) vers DB Neon
 * ----------------------------------------------------------------------------
 * Task ID: 11-a
 *
 * Lit scripts/students-data.json (généré par parse-excel.py),
 * matche chaque élève Excel avec un élève DB existant (par nom normalisé),
 * puis crée / met à jour :
 *   1. fee_structures TUITION manquantes (CE1, CE2, CM1, CM2, 6e, 5e, 4e, 3e, 2nde)
 *   2. account_breakdowns TUITION manquants
 *   3. UPDATE account_breakdowns (TUITION + INSCRIPTION) avec montants Excel
 *   4. UPDATE student_accounts.totalDue (recalculé depuis breakdowns)
 *   5. INSERT finance_transactions (P1..P6 + Inscript + Unif + Tenue)
 *      → trigger trg_update_balance_after_tx met à jour totalPaid/balance
 *   6. INSERT fee_arrears si arriéré > 0
 *
 * ⚠️ Mode DRY_RUN (true par défaut) : n'écrit rien, simule et affiche stats.
 *    Passer DRY_RUN = false pour exécuter réellement.
 *
 * ⚠️ Idempotence : si des transactions "Import Excel%" existent déjà pour ce
 *    tenant+year, le script ABORTE (impossible de supprimer via trigger).
 *
 * Usage :
 *   node scripts/import-monavenirplus.js            # dry-run
 *   DRY_RUN=0 node scripts/import-monavenirplus.js  # exécution réelle
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('/home/z/my-project/node_modules/pg');

// ============================================================================
// CONFIG
// ============================================================================
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
const DATA_FILE = path.join(__dirname, 'students-data.json');

// DRY_RUN : true = simulation seulement (aucune écriture DB)
const DRY_RUN = process.env.DRY_RUN === '0' || process.env.DRY_RUN === 'false' ? false : true;

// Cashier : le seul user du tenant est un PROMOTER — on l'utilise
const CASHIER_ID_FALLBACK = 'e8873cbe-3035-42fb-837f-f575a02e6373';

// ============================================================================
// HELPERS
// ============================================================================
function normalizeName(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // retire accents
    .replace(/[.,;:'`"’\-_()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uuid() {
  return crypto.randomUUID();
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

// Map Excel sheet name → DB class name (normalisé)
// (chaque feuille Excel = 1 classe physique dans la DB)
const SHEET_TO_DB_CLASS = {
  'maternelle 1': 'Maternelle 1',
  'maternelle 2': 'Maternelle 2',
  'ci a': 'CI A',
  'ci b': 'CI B',
  'cp a': 'CP A',
  'cp b': 'CP B',
  'ce1 a': 'CE1 A',
  'ce1 b': 'CE1 B',
  'ce2 a': 'CE2 A',
  'ce2 b': 'CE2 B',
  'cm1 a': 'CM1 A',
  'cm1 b': 'CM1 B',
  'cm2 a': 'CM2 A',
  'cm2 b': 'CM2 B',
  '6e': '6ème',
  '5e': '5ème',
  '4e': '4ème',
  '3e': '3ème',
  '2nde': '2nde D',
};

function resolveDbClassName(sheetName) {
  const norm = sheetName.trim().toLowerCase();
  if (SHEET_TO_DB_CLASS[norm]) return SHEET_TO_DB_CLASS[norm];
  // Fuzzy fallback : retirer les espaces et chercher
  const noSpace = norm.replace(/\s+/g, '');
  for (const k of Object.keys(SHEET_TO_DB_CLASS)) {
    if (k.replace(/\s+/g, '') === noSpace) return SHEET_TO_DB_CLASS[k];
  }
  return null;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('='.repeat(72));
  console.log(`IMPORT EXCEL — Mon Avenir Plus / N'Dali  (DRY_RUN = ${DRY_RUN})`);
  console.log('='.repeat(72));

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Fichier introuvable : ${DATA_FILE}`);
    console.error(`   Lancez d'abord : python3 scripts/parse-excel.py`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // --------------------------------------------------------------
  // 1. Idempotence : si transactions "Import Excel%" existent → ABORT
  // --------------------------------------------------------------
  const existingTx = await client.query(`
    SELECT COUNT(*)::int as n FROM finance_transactions
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND reference LIKE 'Import Excel%'
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  const existingCount = existingTx.rows[0].n;
  if (existingCount > 0) {
    console.error(`\n❌ ABORT : ${existingCount} transactions "Import Excel%" existent déjà.`);
    console.error(`   Le trigger no_delete_finance_transaction empêche toute suppression.`);
    console.error(`   Pour réimporter, supprimez-les manuellement via SQL admin (DISABLE TRIGGER).`);
    if (DRY_RUN) {
      console.error(`   (DRY_RUN=true : on continue pour le rapport, mais aucune nouvelle écriture ne sera faite.)`);
    } else {
      process.exit(1);
    }
  }

  // --------------------------------------------------------------
  // 2. Charger classes du tenant (name → {id, schoolLevelId})
  // --------------------------------------------------------------
  console.log('\n📦 Chargement classes du tenant...');
  const classesRes = await client.query(`
    SELECT id, name, "schoolLevelId" FROM classes WHERE "tenantId" = $1
  `, [TENANT_ID]);
  const classesByName = new Map();
  for (const c of classesRes.rows) {
    classesByName.set(c.name, c);
    classesByName.set(c.name.toLowerCase(), c);
  }
  console.log(`   ${classesRes.rows.length} classes chargées`);

  // --------------------------------------------------------------
  // 3. Charger students du tenant (normalized_name → student)
  // --------------------------------------------------------------
  console.log('📦 Chargement students du tenant...');
  const studentsRes = await client.query(`
    SELECT id, "firstName", "lastName", matricule
    FROM students WHERE "tenantId" = $1
  `, [TENANT_ID]);
  const studentsByNormName = new Map();
  for (const s of studentsRes.rows) {
    const full = `${s.lastName || ''} ${s.firstName || ''}`.trim();
    const norm = normalizeName(full);
    if (!studentsByNormName.has(norm)) {
      studentsByNormName.set(norm, s);
    } else {
      // Collision — on garde le premier, log
    }
  }
  console.log(`   ${studentsRes.rows.length} students chargés, ${studentsByNormName.size} noms uniques`);

  // --------------------------------------------------------------
  // 4. Charger student_accounts (studentId → account)
  // --------------------------------------------------------------
  console.log('📦 Chargement student_accounts...');
  const accountsRes = await client.query(`
    SELECT id, "studentId", "totalDue", "totalPaid", balance
    FROM student_accounts
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  const accountByStudentId = new Map();
  for (const a of accountsRes.rows) accountByStudentId.set(a.studentId, a);
  console.log(`   ${accountsRes.rows.length} comptes chargés`);

  // --------------------------------------------------------------
  // 5. Charger account_breakdowns par compte (accountId → breakdowns[])
  // --------------------------------------------------------------
  console.log('📦 Chargement account_breakdowns...');
  const bdRes = await client.query(`
    SELECT ab.id, ab."studentAccountId", ab."feeStructureId",
           ab."initialAmount", ab."paidAmount", ab."remainingAmount",
           fs."feeType", fs."totalAmount" as fs_total, fs."classId" as fs_class_id,
           fs."levelId" as fs_level_id
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  const breakdownsByAccount = new Map();
  for (const b of bdRes.rows) {
    if (!breakdownsByAccount.has(b.studentAccountId)) {
      breakdownsByAccount.set(b.studentAccountId, []);
    }
    breakdownsByAccount.get(b.studentAccountId).push(b);
  }
  console.log(`   ${bdRes.rows.length} breakdowns chargés`);

  // --------------------------------------------------------------
  // 6. Charger fee_structures du tenant (pour réutilisation / création)
  // --------------------------------------------------------------
  console.log('📦 Chargement fee_structures...');
  const fsRes = await client.query(`
    SELECT id, name, "feeType", "totalAmount", "classId", "levelId", "academicClassId"
    FROM fee_structures WHERE "tenantId" = $1
  `, [TENANT_ID]);
  // Map (feeType + classId) → feeStructure
  const fsByClassAndType = new Map();
  const fsByLevelAndType = new Map();
  for (const f of fsRes.rows) {
    if (f.classId) {
      fsByClassAndType.set(`${f.classId}|${f.feeType}`, f);
    } else if (f.levelId) {
      fsByLevelAndType.set(`${f.levelId}|${f.feeType}`, f);
    }
  }
  console.log(`   ${fsRes.rows.length} fee_structures chargées`);

  // --------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------
  const stats = {
    sheetsProcessed: 0,
    studentsParsed: 0,
    studentsMatched: 0,
    studentsNotFound: 0,
    notFoundList: [],
    breakdownsTuitionUpdated: 0,
    breakdownsTuitionCreated: 0,
    breakdownsInscriptionUpdated: 0,
    feeStructuresCreated: 0,
    accountsTotalDueUpdated: 0,
    transactionsCreated: 0,
    arrearsCreated: 0,
    txByType: { INSCRIPT: 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, UNIF: 0, TENUE: 0 },
    txByClass: {},
  };

  // ==============================================================
  // BOUCLE PRINCIPALE : pour chaque feuille → chaque élève
  // ==============================================================
  const cashierId = CASHIER_ID_FALLBACK;
  let receiptCounter = 0;
  const receiptPrefix = `IMP-EXCEL-${Date.now()}`;

  for (const sheet of data.sheets) {
    stats.sheetsProcessed++;
    const dbClassName = resolveDbClassName(sheet.sheetName);
    if (!dbClassName) {
      console.log(`\n⚠️ Feuille "${sheet.sheetName}" : pas de mapping classe DB — SKIP`);
      continue;
    }
    const cls = classesByName.get(dbClassName);
    if (!cls) {
      console.log(`\n⚠️ Classe DB "${dbClassName}" introuvable pour feuille "${sheet.sheetName}" — SKIP`);
      continue;
    }
    console.log(`\n📚 Feuille "${sheet.sheetName}" → classe DB "${dbClassName}" (${sheet.studentCount} élèves)`);

    if (!stats.txByClass[dbClassName]) stats.txByClass[dbClassName] = 0;

    for (const stu of sheet.students) {
      stats.studentsParsed++;

      // Match par nom normalisé
      const normName = stu.normalizedName || normalizeName(stu.raw_name);
      const dbStudent = studentsByNormName.get(normName);
      if (!dbStudent) {
        stats.studentsNotFound++;
        stats.notFoundList.push({ sheet: sheet.sheetName, name: stu.raw_name });
        continue;
      }
      stats.studentsMatched++;

      const account = accountByStudentId.get(dbStudent.id);
      if (!account) {
        console.log(`   ⚠️ Pas de student_account pour ${dbStudent.lastName} ${dbStudent.firstName} (${dbStudent.matricule}) — SKIP`);
        stats.studentsNotFound++;
        continue;
      }

      const breakdowns = breakdownsByAccount.get(account.id) || [];
      const tuitionBd = breakdowns.find(b => b.feeType === 'TUITION');
      const inscriptBd = breakdowns.find(b => b.feeType === 'INSCRIPTION');

      // Calcul montants depuis Excel
      const excelTotalScol = Number(stu.total_scolarite) || 0;
      const sumP = (stu.p1 || 0) + (stu.p2 || 0) + (stu.p3 || 0) + (stu.p4 || 0) + (stu.p5 || 0) + (stu.p6 || 0);
      const excelInscript = Number(stu.inscript) || 0;
      const excelArrears = Number(stu.arrears) || 0;
      const excelUnif = Number(stu.uniform) || 0;
      const excelTenue = Number(stu.tenue_sport) || 0;

      // ========================================================
      // TRANSACTION DB (pour écrire breakdowns + account + tx)
      // ========================================================
      if (!DRY_RUN) {
        await client.query('BEGIN');
        // Autoriser modification des champs balance protégés
        await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
      }

      try {
        // ----------------------------------------------------
        // A. Garantir l'existence d'une fee_structure TUITION pour la classe
        // ----------------------------------------------------
        let tuitionFs = fsByClassAndType.get(`${cls.id}|TUITION`)
                     || fsByLevelAndType.get(`${cls.schoolLevelId}|TUITION`);

        if (!tuitionFs && excelTotalScol > 0) {
          // Créer la fee_structure TUITION manquante
          tuitionFs = {
            id: uuid(),
            name: `Frais de scolarité — ${dbClassName}`,
            feeType: 'TUITION',
            totalAmount: excelTotalScol,
            classId: cls.id,
            levelId: cls.schoolLevelId,
          };
          if (!DRY_RUN) {
            await client.query(`
              INSERT INTO fee_structures (id, "tenantId", "academicYearId", "levelId", "classId",
                                          name, "feeType", "totalAmount", "isInstallment",
                                          "isMandatory", "isActive", "createdById", "createdAt", "updatedAt")
              VALUES ($1,$2,$3,$4,$5,$6,$7::\"FeeType\",$8,true,true,true,$9,NOW(),NOW())
            `, [
              tuitionFs.id, TENANT_ID, ACADEMIC_YEAR_ID,
              cls.schoolLevelId, cls.id,
              tuitionFs.name, tuitionFs.feeType, tuitionFs.totalAmount,
              cashierId,
            ]);
          }
          fsByClassAndType.set(`${cls.id}|TUITION`, tuitionFs);
          stats.feeStructuresCreated++;
          if (DRY_RUN) console.log(`   🆕 fee_structure TUITION créée pour ${dbClassName} (${excelTotalScol})`);
        }

        // ----------------------------------------------------
        // B. TUITION breakdown : UPDATE ou CREATE
        // ----------------------------------------------------
        const newTuitionPaid = sumP;
        const newTuitionRemain = Math.max(0, excelTotalScol - sumP);

        if (tuitionBd) {
          // UPDATE
          if (!DRY_RUN) {
            await client.query(`
              UPDATE account_breakdowns
              SET "initialAmount" = $1, "adjustedAmount" = $1,
                  "paidAmount" = $2, "remainingAmount" = $3
              WHERE id = $4
            `, [excelTotalScol, newTuitionPaid, newTuitionRemain, tuitionBd.id]);
          }
          stats.breakdownsTuitionUpdated++;
        } else if (tuitionFs && excelTotalScol > 0) {
          // CREATE
          if (!DRY_RUN) {
            await client.query(`
              INSERT INTO account_breakdowns (id, "studentAccountId", "feeStructureId",
                                              "initialAmount", "adjustedAmount",
                                              "paidAmount", "remainingAmount", "createdAt")
              VALUES ($1,$2,$3,$4,$4,$5,$6,NOW())
            `, [uuid(), account.id, tuitionFs.id, excelTotalScol, newTuitionPaid, newTuitionRemain]);
          }
          stats.breakdownsTuitionCreated++;
        }

        // ----------------------------------------------------
        // C. INSCRIPTION breakdown : UPDATE (toujours existe)
        // ----------------------------------------------------
        if (inscriptBd) {
          const initInsc = Number(inscriptBd.initialAmount) || 0;
          const newInscPaid = excelInscript;
          const newInscRemain = Math.max(0, initInsc - excelInscript);
          if (!DRY_RUN) {
            await client.query(`
              UPDATE account_breakdowns
              SET "paidAmount" = $1, "remainingAmount" = $2
              WHERE id = $3
            `, [newInscPaid, newInscRemain, inscriptBd.id]);
          }
          stats.breakdownsInscriptionUpdated++;
        }

        // ----------------------------------------------------
        // D. Recalculer student_accounts.totalDue
        //    (somme des initialAmount de tous les breakdowns)
        // ----------------------------------------------------
        const expectedTotalDue = (tuitionBd || !tuitionFs ? 0 : 0) +
                                 (excelTotalScol > 0 ? excelTotalScol : Number(tuitionBd?.initialAmount || 0)) +
                                 (Number(inscriptBd?.initialAmount || 0));
        if (!DRY_RUN) {
          await client.query(`
            UPDATE student_accounts
            SET "totalDue" = $1, "updatedAt" = NOW()
            WHERE id = $2
          `, [expectedTotalDue, account.id]);
        }
        stats.accountsTotalDueUpdated++;

        // ----------------------------------------------------
        // E. Création finance_transactions
        //    Le trigger trg_update_balance_after_tx met à jour
        //    totalPaid et balance automatiquement.
        // ----------------------------------------------------
        const txToCreate = [];
        if (excelInscript > 0) txToCreate.push({ type: 'INSCRIPT', amount: excelInscript, ref: 'Import Excel - Inscription' });
        if (stu.p1 > 0) txToCreate.push({ type: 'P1', amount: stu.p1, ref: 'Import Excel - Scolarité P1' });
        if (stu.p2 > 0) txToCreate.push({ type: 'P2', amount: stu.p2, ref: 'Import Excel - Scolarité P2' });
        if (stu.p3 > 0) txToCreate.push({ type: 'P3', amount: stu.p3, ref: 'Import Excel - Scolarité P3' });
        if (stu.p4 > 0) txToCreate.push({ type: 'P4', amount: stu.p4, ref: 'Import Excel - Scolarité P4' });
        if (stu.p5 > 0) txToCreate.push({ type: 'P5', amount: stu.p5, ref: 'Import Excel - Scolarité P5' });
        if (stu.p6 > 0) txToCreate.push({ type: 'P6', amount: stu.p6, ref: 'Import Excel - Scolarité P6' });
        if (excelUnif > 0) txToCreate.push({ type: 'UNIF', amount: excelUnif, ref: 'Import Excel - Uniforme' });
        if (excelTenue > 0) txToCreate.push({ type: 'TENUE', amount: excelTenue, ref: 'Import Excel - Tenue Sport' });

        for (const tx of txToCreate) {
          receiptCounter++;
          const receiptNumber = `${receiptPrefix}-${receiptCounter}`;
          if (!DRY_RUN) {
            await client.query(`
              INSERT INTO finance_transactions
                (id, "tenantId", "academicYearId", "studentAccountId", type,
                 amount, "paymentMethod", reference, "cashierId",
                 "receiptNumber", "createdAt", "cashRegisterId")
              VALUES ($1,$2,$3,$4,$5::\"TransactionType\",$6,$7::\"PaymentMethod\",$8,$9,$10,NOW(),NULL)
            `, [
              uuid(), TENANT_ID, ACADEMIC_YEAR_ID, account.id,
              'PAYMENT', tx.amount, 'CASH', tx.ref,
              cashierId, receiptNumber,
            ]);
          }
          stats.transactionsCreated++;
          stats.txByType[tx.type] = (stats.txByType[tx.type] || 0) + 1;
          stats.txByClass[dbClassName]++;
        }

        // ----------------------------------------------------
        // F. Création fee_arrears si arriéré > 0
        // ----------------------------------------------------
        if (excelArrears > 0) {
          const arrearsLevel = excelArrears > 50000 ? 'CRITICAL' : 'WARNING';
          if (!DRY_RUN) {
            await client.query(`
              INSERT INTO fee_arrears
                (id, "tenantId", "academicYearId", "studentId",
                 "totalDue", "totalPaid", "balanceDue",
                 "arrearsLevel", "status", "notes", "createdAt", "updatedAt")
              VALUES ($1,$2,$3,$4,$5,0,$5,$6,'OPEN',$7,NOW(),NOW())
            `, [
              uuid(), TENANT_ID, ACADEMIC_YEAR_ID, dbStudent.id,
              excelArrears, arrearsLevel,
              'Arriéré importé depuis fichier Excel point 2025-2026',
            ]);
          }
          stats.arrearsCreated++;
        }

        if (!DRY_RUN) await client.query('COMMIT');
      } catch (err) {
        if (!DRY_RUN) await client.query('ROLLBACK');
        console.error(`   ❌ Erreur pour ${dbStudent.lastName} ${dbStudent.firstName} (${dbStudent.matricule}): ${err.message}`);
        // Continue next student
      }
    }
  }

  // ==============================================================
  // RAPPORT FINAL
  // ==============================================================
  console.log('\n' + '='.repeat(72));
  console.log(`RAPPORT ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : '(EXÉCUTION RÉELLE)'}`);
  console.log('='.repeat(72));
  console.log(`Feuilles traitées            : ${stats.sheetsProcessed}`);
  console.log(`Élèves parsés (Excel)        : ${stats.studentsParsed}`);
  console.log(`Élèves matchés (DB)          : ${stats.studentsMatched}`);
  console.log(`Élèves non trouvés           : ${stats.studentsNotFound}`);
  console.log('');
  console.log(`fee_structures TUITION créées       : ${stats.feeStructuresCreated}`);
  console.log(`account_breakdowns TUITION créés    : ${stats.breakdownsTuitionCreated}`);
  console.log(`account_breakdowns TUITION maj      : ${stats.breakdownsTuitionUpdated}`);
  console.log(`account_breakdowns INSCRIPTION maj  : ${stats.breakdownsInscriptionUpdated}`);
  console.log(`student_accounts.totalDue recalculés: ${stats.accountsTotalDueUpdated}`);
  console.log('');
  console.log(`finance_transactions créées  : ${stats.transactionsCreated}`);
  console.log(`  Détail par type :`);
  for (const [t, n] of Object.entries(stats.txByType)) {
    if (n > 0) console.log(`    ${t.padEnd(10)} : ${n}`);
  }
  console.log(`  Détail par classe :`);
  for (const [c, n] of Object.entries(stats.txByClass)) {
    if (n > 0) console.log(`    ${c.padEnd(14)} : ${n}`);
  }
  console.log('');
  console.log(`fee_arrears créés            : ${stats.arrearsCreated}`);

  if (stats.notFoundList.length > 0) {
    console.log('\n' + '-'.repeat(72));
    console.log(`Élèves non matchés (${stats.notFoundList.length}) :`);
    stats.notFoundList.slice(0, 50).forEach(n => {
      console.log(`  [${n.sheet}] ${n.name}`);
    });
    if (stats.notFoundList.length > 50) {
      console.log(`  ... et ${stats.notFoundList.length - 50} autres (voir ${path.join(__dirname, 'import-not-found.json')})`);
      fs.writeFileSync(
        path.join(__dirname, 'import-not-found.json'),
        JSON.stringify(stats.notFoundList, null, 2)
      );
    }
  }

  console.log('\n' + '='.repeat(72));
  if (DRY_RUN) {
    console.log('✅ DRY-RUN terminé. Pour exécuter réellement :');
    console.log('   DRY_RUN=0 node scripts/import-monavenirplus.js');
  } else {
    console.log('✅ IMPORT TERMINÉ — vérifiez les soldes en DB.');
  }
  console.log('='.repeat(72));

  await client.end();
}

main().catch(e => {
  console.error('❌ Erreur fatale :', e);
  process.exit(1);
});
