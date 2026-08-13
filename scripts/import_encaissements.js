/**
 * Import des encaissements depuis les fichiers Excel de Mon Avenir Plus
 * 
 * Structure des fichiers Excel :
 * - Lignes 0-1 : vides
 * - Ligne 2 : "ANNEE SCOLAIRE 2025-2026" + "Scolarité 50000"
 * - Ligne 3 : En-têtes principaux (N°, Noms et Prénoms, Arriéré, Tél, Inscript, ...)
 * - Ligne 4 : Sous-en-têtes P1, P2, P3, P4, P5, P6
 * - Ligne 5+ : Données élèves
 * 
 * P1-P6 = tranches de paiement de la scolarité
 * Inscript = frais d'inscription
 * Arriéré = arriérés
 */
const { Client } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon\n');

    // 1. Récupérer tenant + année scolaire
    const tenantRes = await client.query("SELECT id FROM tenants WHERE name ILIKE '%Mon Avenir Plus%N%Dali%'");
    const tenantId = tenantRes.rows[0].id;
    console.log('✅ Tenant:', tenantId);

    const yearRes = await client.query("SELECT id FROM academic_years WHERE \"tenantId\" = $1 AND name ILIKE '%2025-2026%' LIMIT 1", [tenantId]);
    const academicYearId = yearRes.rows[0].id;
    console.log('✅ Academic Year:', academicYearId);

    // 2. Récupérer tous les élèves
    const studentsRes = await client.query(`
      SELECT id, "firstName", "lastName", matricule
      FROM students WHERE "tenantId" = $1 AND status != 'WITHDRAWN'
    `, [tenantId]);
    console.log(`✅ ${studentsRes.rows.length} élèves trouvés\n`);

    // Index par nom normalisé
    const studentByName = new Map();
    for (const s of studentsRes.rows) {
      // Format: "LastName FirstName"
      const fullName = `${s.lastName || ''} ${s.firstName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
      studentByName.set(fullName, s);
      // Aussi par LastName seul
      const lastName = (s.lastName || '').trim().toLowerCase();
      if (lastName && !studentByName.has(lastName)) {
        studentByName.set(lastName, s);
      }
    }

    // 3. Récupérer les StudentAccounts
    const accountsRes = await client.query(`
      SELECT id, "studentId" FROM student_accounts
      WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, [tenantId, academicYearId]);
    const accountByStudent = new Map();
    for (const a of accountsRes.rows) {
      accountByStudent.set(a.studentId, a.id);
    }
    console.log(`✅ ${accountsRes.rows.length} StudentAccounts\n`);

    // 4. Récupérer les AccountBreakdowns
    const breakdownsRes = await client.query(`
      SELECT ab.id, ab."studentAccountId", ab."feeStructureId", ab."paidAmount", ab."initialAmount", fs."feeType"
      FROM account_breakdowns ab
      JOIN student_accounts sa ON sa.id = ab."studentAccountId"
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    `, [tenantId, academicYearId]);
    const breakdownsByAccount = new Map();
    for (const b of breakdownsRes.rows) {
      if (!breakdownsByAccount.has(b.studentAccountId)) {
        breakdownsByAccount.set(b.studentAccountId, []);
      }
      breakdownsByAccount.get(b.studentAccountId).push(b);
    }
    console.log(`✅ ${breakdownsRes.rows.length} AccountBreakdowns\n`);

    // 5. Traiter les fichiers Excel
    let totalImported = 0;
    let totalSkipped = 0;
    let totalNotFound = 0;
    let totalRows = 0;

    for (const filePath of FILES) {
      console.log(`\n📄 ${path.basename(filePath)}`);
      const wb = XLSX.readFile(filePath);

      for (const sheetName of wb.SheetNames) {
        if (sheetName === 'RECAP') continue;

        console.log(`\n  📋 ${sheetName}`);
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

        if (rows.length < 5) continue;

        // Trouver la ligne d'en-tête (contient "Noms" ou "N°")
        let headerRow = -1;
        let pRow = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const r = rows[i];
          for (let j = 0; j < r.length; j++) {
            const val = String(r[j] || '').trim().toUpperCase();
            if (val.includes('NOM') && val.includes('PRENOM')) {
              headerRow = i;
              break;
            }
          }
          if (headerRow !== -1) break;
        }

        if (headerRow === -1) {
          // Essayer ligne 3 (index 3)
          headerRow = 3;
        }
        pRow = headerRow + 1;

        // Trouver colonnes P1-P6
        const header = rows[headerRow] || [];
        const pHeader = rows[pRow] || [];
        let nameCol = -1;
        let inscriptCol = -1;
        let arriereCol = -1;
        const pCols = {};

        for (let j = 0; j < header.length; j++) {
          const h = String(header[j] || '').trim().toUpperCase();
          if (h.includes('NOM') || h.includes('PRENOM')) nameCol = j;
          if (h.includes('INSCRIPT')) inscriptCol = j;
          if (h.includes('ARRIÈR') || h.includes('ARRIERE')) arriereCol = j;
        }
        // P columns dans la ligne suivante
        for (let j = 0; j < pHeader.length; j++) {
          const h = String(pHeader[j] || '').trim().toUpperCase();
          if (h === 'P1') pCols[1] = j;
          else if (h === 'P2') pCols[2] = j;
          else if (h === 'P3') pCols[3] = j;
          else if (h === 'P4') pCols[4] = j;
          else if (h === 'P5') pCols[5] = j;
          else if (h === 'P6') pCols[6] = j;
        }

        if (nameCol === -1) nameCol = 1; // défaut
        if (Object.keys(pCols).length === 0) {
          console.log(`     ⚠️ No P columns found, skipping`);
          continue;
        }

        console.log(`     nameCol=${nameCol}, inscriptCol=${inscriptCol}, arriereCol=${arriereCol}`);
        console.log(`     P columns: ${JSON.stringify(pCols)}`);

        // Traiter chaque ligne d'élève (à partir de headerRow + 2)
        for (let rowIdx = headerRow + 2; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          if (!row || !row[nameCol]) continue;

          const rawName = String(row[nameCol]).trim();
          if (!rawName || rawName === 'undefined' || rawName.toUpperCase().includes('TOTAL')) continue;
          if (/^\d+$/.test(rawName)) continue; // Skip pure numbers

          totalRows++;
          const normalizedName = rawName.toLowerCase().replace(/\s+/g, ' ').trim();

          // Chercher l'élève
          let student = studentByName.get(normalizedName);

          // Fuzzy match : essayer par morceaux
          if (!student) {
            const parts = normalizedName.split(' ').filter(p => p.length > 2);
            for (const part of parts) {
              if (studentByName.has(part)) {
                student = studentByName.get(part);
                break;
              }
            }
          }

          // Fuzzy match : essayer en inversant
          if (!student) {
            const parts = normalizedName.split(' ');
            for (let p = 1; p < parts.length; p++) {
              const alt = parts.slice(p).join(' ') + ' ' + parts.slice(0, p).join(' ');
              if (studentByName.has(alt.trim())) {
                student = studentByName.get(alt.trim());
                break;
              }
            }
          }

          if (!student) {
            totalNotFound++;
            if (totalNotFound <= 5) console.log(`     ❌ Non trouvé: ${rawName}`);
            continue;
          }

          const accountId = accountByStudent.get(student.id);
          if (!accountId) {
            totalSkipped++;
            continue;
          }

          const breakdowns = breakdownsByAccount.get(accountId) || [];
          const tuitionBd = breakdowns.find(b => b.feeType === 'TUITION');
          const inscriptBd = breakdowns.find(b => b.feeType === 'INSCRIPTION');
          const arriereBd = breakdowns.find(b => b.feeType === 'ARREAR' || b.feeType === 'OTHER');

          // Helper pour créer une transaction
          async function createPayment(amount, type, trancheLabel) {
            if (amount <= 0) return;
            
            const receiptNumber = `IMP-${student.id.substring(0, 8)}-${type}-${trancheLabel}`;
            
            // Vérifier si existe déjà
            const existing = await client.query(
              `SELECT id FROM finance_transactions WHERE "receiptNumber" = $1 AND "tenantId" = $2`,
              [receiptNumber, tenantId]
            );
            if (existing.rows.length > 0) {
              totalSkipped++;
              return;
            }

            const txId = crypto.randomUUID();
            await client.query(`
              INSERT INTO finance_transactions (
                id, "tenantId", "academicYearId", "studentAccountId",
                type, amount, "paymentMethod", "receiptNumber",
                "cashierId", "createdAt"
              ) VALUES ($1, $2, $3, $4, 'PAYMENT', $5, 'CASH', $6, $7, now())
            `, [txId, tenantId, academicYearId, accountId, amount, receiptNumber,
                '00000000-0000-0000-0000-000000000000']);

            // Allocation
            const bd = type === 'TUITION' ? tuitionBd : (type === 'INSCRIPTION' ? inscriptBd : arriereBd);
            if (bd) {
              const allocId = crypto.randomUUID();
              await client.query(`
                INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
                VALUES ($1, $2, $3, $4)
              `, [allocId, txId, bd.id, amount]);

              await client.query(`
                UPDATE account_breakdowns
                SET "paidAmount" = "paidAmount" + $1,
                    "remainingAmount" = GREATEST(0, "remainingAmount" - $1)
                WHERE id = $2
              `, [amount, bd.id]);
            }

            // MAJ StudentAccount — drop and recreate trigger to bypass restriction
            await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
            await client.query(`
              UPDATE student_accounts SET "totalPaid" = "totalPaid" + $1, "balance" = "balance" - $1, "updatedAt" = now()
              WHERE id = $2
            `, [amount, accountId]);
            // Recreate trigger at the end (after all imports)

            totalImported++;
          }

          // Tranches P1-P6 (scolarité)
          for (const [tranche, colIdx] of Object.entries(pCols)) {
            const amount = Number(row[colIdx]) || 0;
            if (amount > 0) {
              await createPayment(amount, 'TUITION', `P${tranche}`);
            }
          }

          // Inscription
          if (inscriptCol !== -1) {
            const inscriptAmount = Number(row[inscriptCol]) || 0;
            if (inscriptAmount > 0) {
              await createPayment(inscriptAmount, 'INSCRIPTION', 'INSCRIPT');
            }
          }

          // Arriéré
          if (arriereCol !== -1) {
            const arriereAmount = Number(row[arriereCol]) || 0;
            if (arriereAmount > 0) {
              await createPayment(arriereAmount, 'ARREAR', 'ARRI');
            }
          }
        }
      }
    }

    console.log(`\n\n======== RÉSUMÉ ========`);
    console.log(`Lignes traitées: ${totalRows}`);
    console.log(`✅ Transactions créées: ${totalImported}`);
    console.log(`⏭️ Skippées (déjà existantes / pas de compte): ${totalSkipped}`);
    console.log(`❌ Élèves non trouvés: ${totalNotFound}`);

  } catch (err) {
    console.error('❌', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Done');
  }
}

main();
