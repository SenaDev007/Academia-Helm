/**
 * Script pour créer les breakdowns TUITION manquants et recalculer les soldes.
 *
 * Certains élèves ont des transactions "Import Excel - Scolarité P*" mais pas
 * de breakdown TUITION. Il faut créer ces breakdowns avec le bon montant
 * (total_scolarite de l'Excel) pour que les soldes soient corrects.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
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

  console.log('=== Création breakdowns TUITION manquants ===\n');

  // 1. Charger le JSON pour avoir les montants scolarité par élève
  const jsonData = JSON.parse(fs.readFileSync('/home/z/my-project/scripts/students-data.json', 'utf8'));
  const scolariteMap = {}; // normalizedName → total_scolarite
  for (const sheet of jsonData.sheets || []) {
    for (const s of sheet.students || []) {
      if (s.total_scolarite && s.total_scolarite > 0) {
        scolariteMap[s.normalizedName] = s.total_scolarite;
      }
    }
  }
  console.log(`Montants scolarité chargés: ${Object.keys(scolariteMap).length}`);

  // 2. Trouver les élèves qui ont des transactions Scolarité mais pas de breakdown TUITION
  const needTuition = await client.query(`
    SELECT DISTINCT sa.id as account_id, sa."studentId", s."firstName", s."lastName"
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    JOIN finance_transactions ft ON ft."studentAccountId" = sa.id
    WHERE sa."tenantId" = $1
      AND sa."academicYearId" = $2
      AND ft.reference LIKE 'Import Excel - Scolarit%'
      AND NOT EXISTS (
        SELECT 1 FROM account_breakdowns ab
        JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ab."studentAccountId" = sa.id AND fs."feeType" = 'TUITION'
      )
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Élèves sans breakdown TUITION mais avec transactions scolarité: ${needTuition.rows.length}`);

  // 3. Récupérer une fee_structure TUITION générique (ou créer si aucune)
  // On va utiliser une fee_structure TUITION existante pour ce tenant
  let tuitionFs = await client.query(`
    SELECT id FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'TUITION'
    LIMIT 1
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  let tuitionFsId;
  if (tuitionFs.rows.length === 0) {
    // Créer une fee_structure TUITION générique
    const newFs = await client.query(`
      INSERT INTO fee_structures (id, "tenantId", "academicYearId", name, "feeType", "totalAmount", "isInstallment", "isMandatory", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'Frais de scolarité — Import Excel', 'TUITION', 0, false, true, NOW(), NOW())
      RETURNING id
    `, [TENANT_ID, ACADEMIC_YEAR_ID]);
    tuitionFsId = newFs.rows[0].id;
    console.log(`Fee structure TUITION générique créée: ${tuitionFsId}`);
  } else {
    tuitionFsId = tuitionFs.rows[0].id;
    console.log(`Fee structure TUITION existante utilisée: ${tuitionFsId}`);
  }

  // 4. Pour chaque élève, créer le breakdown TUITION avec le bon montant
  let created = 0;
  let notFound = 0;
  for (const r of needTuition.rows) {
    const key = normalizeName(`${r.lastName} ${r.firstName}`);
    const scolarite = scolariteMap[key];

    if (!scolarite || scolarite <= 0) {
      // Si pas trouvé dans le JSON, utiliser la somme des transactions scolarité
      const sumTx = await client.query(`
        SELECT SUM(amount) as total FROM finance_transactions
        WHERE "studentAccountId" = $1 AND reference LIKE 'Import Excel - Scolarit%'
      `, [r.account_id]);
      const totalPaid = parseFloat(sumTx.rows[0].total || 0);
      if (totalPaid > 0) {
        // Le totalDue = totalPaid + reste (si reste > 0 dans l'Excel)
        // Si pas de reste, on suppose que totalDue = totalPaid (entièrement payé)
        const initialAmount = totalPaid; // fallback
        await client.query(`
          INSERT INTO account_breakdowns (id, "studentAccountId", "feeStructureId", "initialAmount", "adjustedAmount", "paidAmount", "remainingAmount")
          VALUES (gen_random_uuid(), $1, $2, $3, $3, 0, $3)
        `, [r.account_id, tuitionFsId, initialAmount]);
        created++;
      } else {
        notFound++;
      }
    } else {
      await client.query(`
        INSERT INTO account_breakdowns (id, "studentAccountId", "feeStructureId", "initialAmount", "adjustedAmount", "paidAmount", "remainingAmount")
        VALUES (gen_random_uuid(), $1, $2, $3, $3, 0, $3)
      `, [r.account_id, tuitionFsId, scolarite]);
      created++;
    }
  }
  console.log(`Breakdowns TUITION créés: ${created}`);
  console.log(`Élèves sans montant scolarité trouvé: ${notFound}`);

  // 5. Recalculer les paidAmount/remainingAmount des breakdowns à partir des allocations
  console.log('\nRecalcul des breakdowns...');
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

  // 6. Recalculer les soldes student_accounts
  console.log('\nRecalcul des soldes student_accounts...');
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

  // 7. Vérification finale
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

  // Échantillon
  console.log('\nÉchantillon comptes corrigés:');
  const sample = await client.query(`
    SELECT s."lastName", s."firstName", sa."totalDue", sa."totalPaid", sa.balance
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    ORDER BY s."lastName"
    LIMIT 10
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  sample.rows.forEach(r => console.log(`  ${r.lastName} ${r.firstName} | due=${r.totalDue} paid=${r.totalPaid} bal=${r.balance}`));

  await client.end();
  console.log('\n✅ Correction terminée.');
}

main().catch(e => { console.error(e); process.exit(1); });
