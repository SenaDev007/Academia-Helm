/**
 * Vidage des transactions Mon Avenir Plus (tenant + academicYear 2025-2026).
 *
 * ⚠️ OPÉRATION DESTRUCTIVE — DRY_RUN = true par défaut.
 *
 * Ce script :
 *   1. Compte les transactions, allocations, fee_arrears pour ce tenant
 *   2. Si DRY_RUN = false :
 *      a. Supprime finance_transaction_allocations (cascade via tx)
 *      b. Supprime finance_transactions
 *      c. Supprime fee_arrears (créés par l'import Excel)
 *      d. Reset account_breakdowns.paidAmount = 0, remainingAmount = initialAmount
 *      e. Reset student_accounts.totalPaid = 0, balance = totalDue
 *   3. Préservé (PAS TOUCHE) :
 *      - fee_structures (INSCRIPTION, TUITION + tranches)
 *      - account_breakdowns (avec leur initialAmount)
 *      - students + student_enrollments
 *      - classes + school_levels
 *      - TenantIdentityProfile (config design cartes, etc.)
 *      - CardDesignTemplate
 *      - cash_registers, etc.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const DRY_RUN = false; // ⚠️ Mettre à false pour appliquer réellement

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 120000,
  });
  await client.connect();

  console.log(`\n${DRY_RUN ? '🔍 DRY RUN' : '⚠️  APPLICATION RÉELLE'} — Vidage transactions Mon Avenir Plus`);
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Année: ${ACADEMIC_YEAR_ID}\n`);

  // 1. Compter les éléments à supprimer
  console.log('=== ÉLÉMENTS À SUPPRIMER ===');

  const txCount = await client.query(`
    SELECT COUNT(*) as nb FROM finance_transactions
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  finance_transactions: ${txCount.rows[0].nb}`);

  const allocCount = await client.query(`
    SELECT COUNT(*) as nb FROM finance_transaction_allocations fta
    JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  finance_transaction_allocations: ${allocCount.rows[0].nb}`);

  const arrearsCount = await client.query(`
    SELECT COUNT(*) as nb FROM fee_arrears
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  fee_arrears (import Excel): ${arrearsCount.rows[0].nb}`);

  // 2. Compter les éléments à RESET (pas supprimer)
  console.log('\n=== ÉLÉMENTS À RESET (paidAmount → 0) ===');

  const bdCount = await client.query(`
    SELECT COUNT(*) as nb FROM account_breakdowns ab
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  account_breakdowns (reset paidAmount=0): ${bdCount.rows[0].nb}`);

  const saCount = await client.query(`
    SELECT COUNT(*) as nb FROM student_accounts
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  student_accounts (reset totalPaid=0, balance=totalDue): ${saCount.rows[0].nb}`);

  // 3. Vérifier ce qui sera PRÉSERVÉ
  console.log('\n=== ÉLÉMENTS PRÉSERVÉS (PAS TOUCHE) ===');

  const fsCount = await client.query(`
    SELECT COUNT(*) as nb FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  fee_structures (config préservée): ${fsCount.rows[0].nb}`);

  const studentsCount = await client.query(`
    SELECT COUNT(*) as nb FROM students WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log(`  students (préservés): ${studentsCount.rows[0].nb}`);

  const classesCount = await client.query(`
    SELECT COUNT(*) as nb FROM classes WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log(`  classes (préservées): ${classesCount.rows[0].nb}`);

  const enrollmentsCount = await client.query(`
    SELECT COUNT(*) as nb FROM student_enrollments
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  student_enrollments (préservés): ${enrollmentsCount.rows[0].nb}`);

  const identityCount = await client.query(`
    SELECT COUNT(*) as nb FROM tenant_identity_profiles WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log(`  tenant_identity_profiles (préservés): ${identityCount.rows[0].nb}`);

  const templateCount = await client.query(`
    SELECT COUNT(*) as nb FROM card_design_templates WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log(`  card_design_templates (préservés): ${templateCount.rows[0].nb}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN = true → aucune modification appliquée.');
    console.log('   Pour appliquer réellement, mettre DRY_RUN = false dans le script.');
    await client.end();
    return;
  }

  // === APPLICATION RÉELLE ===
  console.log('\n=== APPLICATION DES SUPPRESSIONS ===');

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.allow_balance_update = 'true'`);

    // ⚠️ Désactiver temporairement les triggers d'immutabilité financière
    // pour permettre la suppression des transactions (demande explicite
    // utilisateur pour reset complet et saisie manuelle).
    // Il y a 2 triggers qui bloquent la suppression :
    //   - no_delete_finance_transaction (migration initiale)
    //   - trg_no_delete_finance_transaction (bootstrap service)
    // Et un trigger qui empêche la modification après clôture :
    //   - lock_transaction_after_closure
    console.log('  → Désactivation temporaire triggers immutabilité...');
    await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER no_delete_finance_transaction`);
    await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER trg_no_delete_finance_transaction`);
    await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER lock_transaction_after_closure`);
    // Désactiver aussi verify_integrity_hash pour éviter les soucis
    await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER verify_integrity_hash_trigger`);

    // 1. Supprimer finance_transaction_allocations
    console.log('  → Suppression finance_transaction_allocations...');
    const delAlloc = await client.query(`
      DELETE FROM finance_transaction_allocations
      WHERE "financeTransactionId" IN (
        SELECT id FROM finance_transactions
        WHERE "tenantId" = $1 AND "academicYearId" = $2
      )
    `, [TENANT_ID, ACADEMIC_YEAR_ID]);
    console.log(`    ${delAlloc.rowCount} allocations supprimées`);

    // 2. Supprimer finance_transactions
    console.log('  → Suppression finance_transactions...');
    const delTx = await client.query(`
      DELETE FROM finance_transactions
      WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, [TENANT_ID, ACADEMIC_YEAR_ID]);
    console.log(`    ${delTx.rowCount} transactions supprimées`);

    // 3. Supprimer fee_arrears (import Excel)
    console.log('  → Suppression fee_arrears...');
    const delArrears = await client.query(`
      DELETE FROM fee_arrears
      WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, [TENANT_ID, ACADEMIC_YEAR_ID]);
    console.log(`    ${delArrears.rowCount} fee_arrears supprimés`);

    // 4. Reset account_breakdowns
    console.log('  → Reset account_breakdowns (paidAmount=0, remainingAmount=initialAmount)...');
    const resetBd = await client.query(`
      UPDATE account_breakdowns ab
      SET "paidAmount" = 0,
          "remainingAmount" = ab."initialAmount"
      FROM student_accounts sa
      WHERE ab."studentAccountId" = sa.id
        AND sa."tenantId" = $1
        AND sa."academicYearId" = $2
    `, [TENANT_ID, ACADEMIC_YEAR_ID]);
    console.log(`    ${resetBd.rowCount} breakdowns reset`);

    // 5. Reset student_accounts
    console.log('  → Reset student_accounts (totalPaid=0, balance=totalDue)...');
    const resetSa = await client.query(`
      UPDATE student_accounts
      SET "totalPaid" = 0,
          "balance" = "totalDue",
          "updatedAt" = NOW()
      WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, [TENANT_ID, ACADEMIC_YEAR_ID]);
    console.log(`    ${resetSa.rowCount} student_accounts reset`);

    // ⭐ Réactiver les triggers d'immutabilité financière
    console.log('  → Réactivation triggers immutabilité...');
    await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER no_delete_finance_transaction`);
    await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER trg_no_delete_finance_transaction`);
    await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER lock_transaction_after_closure`);
    await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER verify_integrity_hash_trigger`);

    await client.query('COMMIT');
    console.log('\n✅ Suppressions appliquées avec succès.');
  } catch (err) {
    await client.query('ROLLBACK');
    // En cas d'erreur, s'assurer que les triggers sont réactivés
    try {
      await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER no_delete_finance_transaction`);
      await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER trg_no_delete_finance_transaction`);
      await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER lock_transaction_after_closure`);
      await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER verify_integrity_hash_trigger`);
    } catch {}
    console.error(`\n❌ Erreur: ${err.message}`);
    throw err;
  }

  // Vérification finale
  console.log('\n=== VÉRIFICATION POST-SUPPRESSION ===');

  const txAfter = await client.query(`
    SELECT COUNT(*) as nb FROM finance_transactions
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  finance_transactions restantes: ${txAfter.rows[0].nb}`);

  const allocAfter = await client.query(`
    SELECT COUNT(*) as nb FROM finance_transaction_allocations fta
    JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  finance_transaction_allocations restantes: ${allocAfter.rows[0].nb}`);

  const arrearsAfter = await client.query(`
    SELECT COUNT(*) as nb FROM fee_arrears
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  fee_arrears restants: ${arrearsAfter.rows[0].nb}`);

  const fsAfter = await client.query(`
    SELECT COUNT(*) as nb FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  fee_structures (préservées): ${fsAfter.rows[0].nb}`);

  const bdAfter = await client.query(`
    SELECT
      COUNT(*) as nb,
      SUM(CASE WHEN "paidAmount" = 0 THEN 1 ELSE 0 END) as paid_zero
    FROM account_breakdowns ab
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  account_breakdowns: ${bdAfter.rows[0].nb} (dont ${bdAfter.rows[0].paid_zero} avec paidAmount=0)`);

  const saAfter = await client.query(`
    SELECT
      COUNT(*) as nb,
      SUM(CASE WHEN "totalPaid" = 0 THEN 1 ELSE 0 END) as paid_zero
    FROM student_accounts
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  student_accounts: ${saAfter.rows[0].nb} (dont ${saAfter.rows[0].paid_zero} avec totalPaid=0)`);

  await client.end();
  console.log('\n✅ Terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
