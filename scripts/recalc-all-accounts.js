/**
 * ============================================================================
 * RECALCUL GLOBAL ET DYNAMIQUE DE TOUS LES COMPTES ÉLÈVES (v2 — casing fixed)
 * ============================================================================
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== 1. Liste des comptes à recalculer ===');
  const accounts = await client.query(`
    SELECT id, "studentId", "academicYearId", "totalDue", "totalPaid", "balance", status
    FROM student_accounts
    WHERE EXISTS (SELECT 1 FROM account_breakdowns ab WHERE ab."studentAccountId" = student_accounts.id)
    ORDER BY "createdAt"
  `);
  console.log(`  ${accounts.rows.length} comptes à recalculer\n`);

  let updatedCount = 0;
  let overrideAppliedCount = 0;

  // Désactiver le trigger pour toute la durée
  await client.query('ALTER TABLE student_accounts DISABLE TRIGGER prevent_balance_update_trigger');
  console.log('  ✅ Trigger prevent_balance_update_trigger désactivé\n');

  try {
    for (const account of accounts.rows) {
      const accountId = account.id;
      const studentId = account.studentId;

      // 1. Récupérer tous les breakdowns du compte avec leur feeStructure
      const breakdowns = await client.query(`
        SELECT ab.id, ab."feeStructureId", ab."initialAmount", ab."paidAmount", ab."remainingAmount",
               fs."totalAmount", fs."feeType"
        FROM account_breakdowns ab
        JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ab."studentAccountId" = $1
      `, [accountId]);

      // 2. Récupérer tous les overrides pour cet élève
      const overrides = await client.query(`
        SELECT "feeStructureId", "customAmount"
        FROM fee_overrides
        WHERE "studentId" = $1
      `, [studentId]);

      const overrideMap = new Map();
      for (const ov of overrides.rows) {
        overrideMap.set(ov.feeStructureId, Number(ov.customAmount));
      }

      // 3. Mettre à jour chaque breakdown
      let newTotalDue = 0;
      let newTotalPaid = 0;

      for (const bd of breakdowns.rows) {
        const fsId = bd.feeStructureId;
        const originalAmount = Number(bd.totalAmount);
        const overrideAmount = overrideMap.get(fsId);
        const newInitialAmount = overrideAmount != null ? overrideAmount : originalAmount;
        const paidAmount = Number(bd.paidAmount);
        const newRemainingAmount = Math.max(0, newInitialAmount - paidAmount);

        // Mettre à jour le breakdown si le montant a changé
        if (Number(bd.initialAmount) !== newInitialAmount) {
          await client.query(`
            UPDATE account_breakdowns
            SET "initialAmount" = $1, "adjustedAmount" = $1, "remainingAmount" = $2
            WHERE id = $3
          `, [newInitialAmount, newRemainingAmount, bd.id]);
          overrideAppliedCount++;
          console.log(`  📝 ${studentId.substring(0, 8)} | ${bd.feeType} | ${bd.initialAmount} → ${newInitialAmount} ${overrideAmount != null ? '(override)' : ''}`);
        }

        newTotalDue += newInitialAmount;
        newTotalPaid += paidAmount;
      }

      // 4. Recalculer le compte
      const newBalance = newTotalDue - newTotalPaid;
      let newStatus = 'ACTIVE';
      if (newBalance <= 0) newStatus = 'PAID';
      else if (newTotalPaid > 0) newStatus = 'PARTIAL';

      await client.query(`
        UPDATE student_accounts
        SET "totalDue" = $1, "totalPaid" = $2, "balance" = $3, status = $4, "updatedAt" = NOW()
        WHERE id = $5
      `, [newTotalDue, newTotalPaid, newBalance, newStatus, accountId]);

      updatedCount++;

      const oldTotalDue = Number(account.totalDue);
      const oldBalance = Number(account.balance);
      if (oldTotalDue !== newTotalDue || oldBalance !== newBalance) {
        console.log(`  ✅ ${studentId.substring(0, 8)} | totalDue: ${oldTotalDue} → ${newTotalDue} | balance: ${oldBalance} → ${newBalance} | status: ${newStatus}`);
      }
    }
  } finally {
    await client.query('ALTER TABLE student_accounts ENABLE TRIGGER prevent_balance_update_trigger');
    console.log('\n  ✅ Trigger prevent_balance_update_trigger réactivé');
  }

  console.log(`\n=== Récapitulatif ===`);
  console.log(`  Comptes traités : ${updatedCount}`);
  console.log(`  Breakdowns mis à jour (override appliqué) : ${overrideAppliedCount}`);

  // Vérification AKPOVI
  console.log(`\n=== Vérification AKPOVI Béroukhyah ===`);
  const akpovi = await client.query(`
    SELECT "totalDue", "totalPaid", "balance", status
    FROM student_accounts
    WHERE "studentId" = 'c9a4b7d0-fadd-40a8-8ec0-c472772b5708'
  `);
  if (akpovi.rows.length > 0) {
    const r = akpovi.rows[0];
    console.log(`  totalDue: ${r.totalDue} (attendu: 31000)`);
    console.log(`  totalPaid: ${r.totalPaid}`);
    console.log(`  balance: ${r.balance}`);
    console.log(`  status: ${r.status}`);
  }

  // Vérification AGLOSSI
  console.log(`\n=== Vérification AGLOSSI Mariano ===`);
  const aglossi = await client.query(`
    SELECT sa."totalDue", sa."totalPaid", sa."balance", sa.status
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    WHERE s."lastName" ILIKE '%AGLOSSI%'
  `);
  if (aglossi.rows.length > 0) {
    const r = aglossi.rows[0];
    console.log(`  totalDue: ${r.totalDue} (attendu: 43000)`);
    console.log(`  totalPaid: ${r.totalPaid} (attendu: 10000)`);
    console.log(`  balance: ${r.balance} (attendu: 33000)`);
    console.log(`  status: ${r.status}`);
  }

  await client.end();
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
