/**
 * Script d'import OPTIMISÉ pour les 443 élèves restants.
 * Crée toutes les transactions manquantes en batch (très rapide).
 *
 * Stratégie :
 * 1. Charger le JSON des données Excel
 * 2. Pour chaque élève SANS transactions existantes, créer toutes ses transactions
 *    en UNE SEULE requête INSERT multi-values
 * 3. Créer les allocations en batch
 * 4. Mettre à jour les breakdowns en batch
 * 5. Recalculer les soldes en batch
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const crypto = require('crypto');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

function normalizeName(name) {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.';,/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Import batch pour élèves restants ===\n');

  // 1. Charger le JSON
  const jsonData = JSON.parse(fs.readFileSync('/home/z/my-project/scripts/students-data.json', 'utf8'));
  console.log(`Élèves dans le JSON: ${jsonData.totalStudentsParsed}`);

  // Aplatir toutes les feuilles en un seul tableau d'élèves
  const data = [];
  for (const sheet of jsonData.sheets || []) {
    for (const s of sheet.students || []) {
      data.push({
        name: s.raw_name,
        normalizedName: s.normalizedName,
        inscript: s.inscript || 0,
        uniforme: s.uniform || 0,
        tenue: s.tenue_sport || 0,
        tranches: [s.p1 || 0, s.p2 || 0, s.p3 || 0, s.p4 || 0, s.p5 || 0, s.p6 || 0],
        arrears: s.arrears || 0,
        total_scolarite: s.total_scolarite || 0,
      });
    }
  }
  console.log(`Élèves aplatit: ${data.length}`);

  // 2. Charger tous les élèves de la DB avec leurs accounts
  const dbRes = await client.query(`
    SELECT s.id, s."firstName", s."lastName", sa.id as account_id
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  // Map normalisé → { studentId, accountId }
  const dbMap = {};
  for (const r of dbRes.rows) {
    const key = normalizeName(`${r.lastName} ${r.firstName}`);
    if (!dbMap[key]) dbMap[key] = { studentId: r.id, accountId: r.account_id };
  }
  console.log(`Élèves en DB: ${dbRes.rows.length}`);

  // 3. Identifier les comptes qui ont DÉJÀ des transactions
  const existingTx = await client.query(`
    SELECT DISTINCT "studentAccountId" FROM finance_transactions
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND reference LIKE 'Import Excel%'
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  const accountsWithTx = new Set(existingTx.rows.map(r => r.studentAccountId));
  console.log(`Comptes avec transactions existantes: ${accountsWithTx.size}`);

  // 4. Pour chaque élève du JSON, vérifier s'il a des transactions
  let toImport = [];
  let skipped = 0;
  for (const student of data) {
    const key = normalizeName(student.name);
    const dbMatch = dbMap[key];
    if (!dbMatch) { skipped++; continue; }
    if (accountsWithTx.has(dbMatch.accountId)) { skipped++; continue; }

    // Collecter tous les paiements de cet élève
    const payments = [];
    // Inscription
    if (student.inscript && student.inscript > 0) {
      payments.push({ type: 'Inscription', amount: student.inscript });
    }
    // Tranches P1-P6
    for (let i = 0; i < 6; i++) {
      const p = student.tranches[i];
      if (p && p > 0) {
        payments.push({ type: `Scolarité P${i+1}`, amount: p });
      }
    }
    // Uniforme
    if (student.uniforme && student.uniforme > 0) {
      payments.push({ type: 'Uniforme', amount: student.uniforme });
    }
    // Tenue de sport
    if (student.tenue && student.tenue > 0) {
      payments.push({ type: 'Tenue Sport', amount: student.tenue });
    }

    if (payments.length === 0) { skipped++; continue; }

    toImport.push({ accountId: dbMatch.accountId, payments, studentName: student.name });
  }
  console.log(`Élèves à importer: ${toImport.length}`);
  console.log(`Élèves skippés (déjà importés ou sans paiement): ${skipped}`);

  // 5. Créer les transactions en batch (INSERT multi-values)
  console.log('\nCréation des transactions...');
  const receiptPrefix = `IMP-EXCEL-${Date.now()}`;
  let receiptCounter = 0;
  const allTxIds = [];

  // Construire les valeurs pour l'INSERT batch
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const { accountId, payments } of toImport) {
    for (const p of payments) {
      const txId = crypto.randomUUID();
      allTxIds.push({ id: txId, accountId, type: p.type, amount: p.amount });
      // 10 valeurs par ligne : id, tenantId, academicYearId, accountId, type, paymentMethod, amount, reference, receiptNumber, cashierId, NOW()
      values.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, 'PAYMENT', 'CASH', $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, NOW())`);
      params.push(
        txId,                          // $1 id
        TENANT_ID,                     // $2 tenantId
        ACADEMIC_YEAR_ID,              // $3 academicYearId
        accountId,                     // $4 studentAccountId
        p.amount,                      // $5 amount
        `Import Excel - ${p.type}`,   // $6 reference
        `${receiptPrefix}-${receiptCounter++}`, // $7 receiptNumber
        '00000000-0000-0000-0000-000000000001' // $8 cashierId
      );
      paramIdx += 8;
    }
  }

  if (values.length > 0) {
    // Insertion par chunks de 100 (8 params par ligne = 800 params max par chunk)
    const CHUNK_SIZE = 100;
    let totalInserted = 0;
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunkValues = values.slice(i, i + CHUNK_SIZE);
      const chunkParams = params.slice(i * 8, (i + CHUNK_SIZE) * 8);
      // Réinitialiser les placeholders pour commencer à $1 dans chaque chunk
      const chunkValuesReset = chunkValues.map((v, idx) => {
        const base = idx * 8 + 1;
        return `($${base}, $${base+1}, $${base+2}, $${base+3}, 'PAYMENT', 'CASH', $${base+4}, $${base+5}, $${base+6}, $${base+7}, NOW())`;
      });
      const query = `
        INSERT INTO finance_transactions
          (id, "tenantId", "academicYearId", "studentAccountId", type, "paymentMethod", amount, reference, "receiptNumber", "cashierId", "createdAt")
        VALUES ${chunkValuesReset.join(', ')}
      `;
      const res = await client.query(query, chunkParams);
      totalInserted += res.rowCount;
      process.stdout.write(`  ${totalInserted}/${values.length} transactions créées\r`);
    }
    console.log(`\n  ${totalInserted} transactions créées au total.`);
  }

  // 6. Créer les allocations en batch
  console.log('\nCréation des allocations...');
  const allocRes = await client.query(`
    INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
    SELECT
      gen_random_uuid(),
      ft.id,
      COALESCE(
        CASE
          WHEN ft.reference LIKE '%Inscription%' THEN (
            SELECT ab.id FROM account_breakdowns ab
            JOIN fee_structures fs ON fs.id = ab."feeStructureId"
            WHERE ab."studentAccountId" = ft."studentAccountId" AND fs."feeType" = 'INSCRIPTION'
            LIMIT 1
          )
          WHEN ft.reference LIKE '%Scolarit%' THEN (
            SELECT ab.id FROM account_breakdowns ab
            JOIN fee_structures fs ON fs.id = ab."feeStructureId"
            WHERE ab."studentAccountId" = ft."studentAccountId" AND fs."feeType" = 'TUITION'
            LIMIT 1
          )
          ELSE (
            SELECT ab.id FROM account_breakdowns ab
            JOIN fee_structures fs ON fs.id = ab."feeStructureId"
            WHERE ab."studentAccountId" = ft."studentAccountId"
            ORDER BY CASE fs."feeType" WHEN 'TUITION' THEN 1 WHEN 'INSCRIPTION' THEN 2 ELSE 3 END
            LIMIT 1
          )
        END,
        (
          SELECT ab.id FROM account_breakdowns ab
          WHERE ab."studentAccountId" = ft."studentAccountId"
          LIMIT 1
        )
      ),
      ft.amount
    FROM finance_transactions ft
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND ft.reference LIKE 'Import Excel%'
      AND NOT EXISTS (
        SELECT 1 FROM finance_transaction_allocations fa
        WHERE fa."financeTransactionId" = ft.id
      )
    ON CONFLICT ("financeTransactionId", "accountBreakdownId") DO NOTHING
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${allocRes.rowCount} allocations créées.`);

  // 7. Mettre à jour les breakdowns
  console.log('\nMise à jour des breakdowns...');
  const bdRes = await client.query(`
    WITH alloc_sums AS (
      SELECT
        fa."accountBreakdownId",
        SUM(fa.amount) as total_allocated
      FROM finance_transaction_allocations fa
      JOIN finance_transactions ft ON ft.id = fa."financeTransactionId"
      WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
      GROUP BY fa."accountBreakdownId"
    )
    UPDATE account_breakdowns ab
    SET "paidAmount" = COALESCE(alloc_sums.total_allocated, 0),
        "remainingAmount" = GREATEST(ab."initialAmount" - COALESCE(alloc_sums.total_allocated, 0), 0)
    FROM alloc_sums
    WHERE ab.id = alloc_sums."accountBreakdownId"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${bdRes.rowCount} breakdowns mis à jour.`);

  // 8. Recalculer les soldes
  console.log('\nRecalcul des soldes...');
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  const saRes = await client.query(`
    WITH account_totals AS (
      SELECT
        ab."studentAccountId",
        SUM(ab."initialAmount") as new_total_due,
        SUM(ab."paidAmount") as new_total_paid
      FROM account_breakdowns ab
      JOIN student_accounts sa ON sa.id = ab."studentAccountId"
      WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
      GROUP BY ab."studentAccountId"
    )
    UPDATE student_accounts sa
    SET
      "totalDue" = at.new_total_due,
      "totalPaid" = at.new_total_paid,
      "balance" = at.new_total_due - at.new_total_paid,
      "updatedAt" = NOW()
    FROM account_totals at
    WHERE sa.id = at."studentAccountId"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  await client.query('COMMIT');
  console.log(`  ${saRes.rowCount} comptes recalculés.`);

  // 9. Vérification finale
  console.log('\n=== Vérification finale ===');
  const check = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE sa.balance = 0) as soldes_zero,
      COUNT(*) FILTER (WHERE sa.balance > 0) as soldes_positifs,
      COUNT(*) FILTER (WHERE sa.balance < 0) as soldes_negatifs,
      COUNT(*) FILTER (WHERE sa."totalPaid" > 0) as comptes_avec_paiements,
      COUNT(*) as total
    FROM student_accounts sa
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log('Stats comptes:', check.rows[0]);

  const txCount = await client.query(`SELECT COUNT(*) as n FROM finance_transactions WHERE "tenantId" = $1 AND "academicYearId" = $2 AND reference LIKE 'Import Excel%'`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Total transactions Import Excel: ${txCount.rows[0].n}`);

  await client.end();
  console.log('\n✅ Import terminé.');
}

main().catch(e => { console.error(e); process.exit(1); });
