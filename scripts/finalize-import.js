/**
 * Script de finalisation RAPIDE : crée les allocations manquantes en batch
 * et recalcule tous les soldes en une seule requête SQL.
 *
 * Stratégie optimisée :
 * 1. INSERT INTO finance_transaction_allocations en une seule requête (batch)
 * 2. UPDATE account_breakdowns en une seule requête (CTE)
 * 3. UPDATE student_accounts en une seule requête (CTE + allow_balance_update)
 * 4. INSERT fee_arrears pour les élèves avec arriéré
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Finalisation rapide import ===\n');

  // 1. Créer les allocations manquantes en batch
  console.log('1. Création des allocations manquantes...');
  const allocRes = await client.query(`
    INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
    SELECT
      gen_random_uuid(),
      ft.id,
      COALESCE(
        -- Trouver le breakdown correspondant au type de frais
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
          WHEN ft.reference LIKE '%Uniforme%' OR ft.reference LIKE '%Tenue%' THEN (
            SELECT ab.id FROM account_breakdowns ab
            JOIN fee_structures fs ON fs.id = ab."feeStructureId"
            WHERE ab."studentAccountId" = ft."studentAccountId" AND fs."feeType" = 'OTHER'
            LIMIT 1
          )
          ELSE NULL
        END,
        -- Fallback : premier breakdown disponible (TUITION prioritaire)
        (
          SELECT ab.id FROM account_breakdowns ab
          JOIN fee_structures fs ON fs.id = ab."feeStructureId"
          WHERE ab."studentAccountId" = ft."studentAccountId"
          ORDER BY CASE fs."feeType" WHEN 'TUITION' THEN 1 WHEN 'INSCRIPTION' THEN 2 ELSE 3 END
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
  console.log(`   ${allocRes.rowCount} allocations créées.`);

  // 2. Mettre à jour les breakdowns (paidAmount/remainingAmount) en batch
  console.log('\n2. Mise à jour des breakdowns...');
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
  console.log(`   ${bdRes.rowCount} breakdowns mis à jour.`);

  // 3. Recalculer les soldes des student_accounts en batch
  console.log('\n3. Recalcul des soldes student_accounts...');
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
  console.log(`   ${saRes.rowCount} comptes recalculés.`);

  // 4. Vérifier le résultat
  console.log('\n4. Vérification...');
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
  console.log('   Stats comptes:', check.rows[0]);

  const txCount = await client.query(`SELECT COUNT(*) as n FROM finance_transactions WHERE "tenantId" = $1 AND "academicYearId" = $2 AND reference LIKE 'Import Excel%'`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   Total transactions Import Excel: ${txCount.rows[0].n}`);

  const allocCount = await client.query(`
    SELECT COUNT(*) as n FROM finance_transaction_allocations fa
    JOIN finance_transactions ft ON ft.id = fa."financeTransactionId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`   Total allocations: ${allocCount.rows[0].n}`);

  // 5. Échantillon de comptes corrigés
  console.log('\n5. Échantillon comptes corrigés:');
  const sample = await client.query(`
    SELECT s."lastName", s."firstName", sa."totalDue", sa."totalPaid", sa.balance,
           (SELECT COUNT(*) FROM finance_transactions ft WHERE ft."studentAccountId" = sa.id AND ft.reference LIKE 'Import Excel%') as nb_tx
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2 AND sa."totalPaid" > 0
    ORDER BY s."lastName"
    LIMIT 10
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  sample.rows.forEach(r => console.log(`   ${r.lastName} ${r.firstName} | due=${r.totalDue} paid=${r.totalPaid} bal=${r.balance} | ${r.nb_tx} tx`));

  await client.end();
  console.log('\n✅ Finalisation terminée.');
}

main().catch(e => { console.error(e); process.exit(1); });
