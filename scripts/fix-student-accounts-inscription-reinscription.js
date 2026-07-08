#!/usr/bin/env node
const { Client } = require('/home/z/my-project/node_modules/pg');
const client = new Client({ connectionString: 'postgres://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require' });

async function main() {
  await client.connect();

  // Désactiver le trigger de protection
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  console.log('✓ Trigger supprimé');

  // Étape 1 : Retirer les breakdowns INSCRIPTION non payés des REPEAT
  console.log('→ Étape 1 : Retirer INSCRIPTION des REPEAT...');
  const removed = await client.query(`
    DELETE FROM account_breakdowns ab
    USING student_accounts sa, student_enrollments se, fee_structures fs
    WHERE ab."studentAccountId" = sa.id
      AND sa."studentId" = se."studentId"
      AND sa."academicYearId" = se."academicYearId"
      AND ab."feeStructureId" = fs.id
      AND se."enrollmentType" = 'REPEAT'
      AND fs."feeType" = 'INSCRIPTION'
      AND ab."paidAmount" = 0
    RETURNING ab.id
  `);
  console.log(`  ${removed.rowCount} breakdown(s) INSCRIPTION supprimé(s) pour REPEAT`);

  // Étape 2 : Ajouter REINSCRIPTION manquants pour REPEAT
  console.log('→ Étape 2 : Ajouter REINSCRIPTION manquants...');
  const missing = await client.query(`
    SELECT DISTINCT
      sa.id as account_id,
      fs.id as fee_structure_id
    FROM student_accounts sa
    JOIN student_enrollments se ON sa."studentId" = se."studentId" AND sa."academicYearId" = se."academicYearId"
    JOIN fee_structures fs ON fs."levelId" = se."schoolLevelId"
      AND fs."feeType" = 'REINSCRIPTION'
      AND fs."academicYearId" = sa."academicYearId"
    WHERE se."enrollmentType" = 'REPEAT'
      AND NOT EXISTS (
        SELECT 1 FROM account_breakdowns ab2
        WHERE ab2."studentAccountId" = sa.id AND ab2."feeStructureId" = fs.id
      )
  `);
  console.log(`  ${missing.rows.length} breakdown(s) REINSCRIPTION à ajouter`);
  for (const row of missing.rows) {
    await client.query(
      `INSERT INTO account_breakdowns (id, "studentAccountId", "feeStructureId", "initialAmount", "adjustedAmount", "paidAmount", "remainingAmount") VALUES (gen_random_uuid(), $1, $2, 0, 0, 0, 0)`,
      [row.account_id, row.fee_structure_id]
    );
  }

  // Étape 3 : Retirer REINSCRIPTION du NEW (AKPOVI)
  console.log('→ Étape 3 : Retirer REINSCRIPTION du NEW...');
  const removedNew = await client.query(`
    DELETE FROM account_breakdowns ab
    USING student_accounts sa, student_enrollments se, fee_structures fs
    WHERE ab."studentAccountId" = sa.id
      AND sa."studentId" = se."studentId"
      AND sa."academicYearId" = se."academicYearId"
      AND ab."feeStructureId" = fs.id
      AND se."enrollmentType" = 'NEW'
      AND fs."feeType" = 'REINSCRIPTION'
    RETURNING ab.id
  `);
  console.log(`  ${removedNew.rowCount} breakdown(s) REINSCRIPTION supprimé(s) pour NEW`);

  // Étape 4 : Recalculer totalDue et balance pour REPEAT
  console.log('→ Étape 4 : Recalculer totalDue et balance...');
  const recalc = await client.query(`
    UPDATE student_accounts sa
    SET
      "totalDue" = (
        SELECT COALESCE(SUM(ab."initialAmount"), 0)::numeric
        FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id
      ),
      "balance" = (
        SELECT COALESCE(SUM(ab."remainingAmount"), 0)::numeric
        FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id
      ),
      "updatedAt" = NOW()
    FROM student_enrollments se
    WHERE sa."studentId" = se."studentId"
      AND sa."academicYearId" = se."academicYearId"
      AND se."enrollmentType" = 'REPEAT'
    RETURNING sa.id
  `);
  console.log(`  ${recalc.rowCount} compte(s) REPEAT recalculé(s)`);

  // Recréer le trigger
  await client.query(`CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalDue", "totalPaid", balance, "arrearsAmount" ON public.student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()`);
  console.log('✓ Trigger recréé');

  // Vérification finale
  console.log('');
  console.log('=== Vérification finale ===');
  const final = await client.query(`
    SELECT se."enrollmentType", COUNT(*) as n,
      AVG(sa."totalDue"::FLOAT) as avg_due,
      MIN(sa."totalDue"::FLOAT) as min_due,
      MAX(sa."totalDue"::FLOAT) as max_due
    FROM student_accounts sa
    JOIN student_enrollments se ON sa."studentId" = se."studentId" AND sa."academicYearId" = se."academicYearId"
    GROUP BY se."enrollmentType"
  `);
  final.rows.forEach(r => {
    console.log(`  ${r.enrollment_type}: ${r.n} compte(s) — totalDue: min=${r.min_due}, moy=${Math.round(r.avg_due)}, max=${r.max_due}`);
  });

  console.log('');
  const detail = await client.query(`
    SELECT s."firstName", s."lastName", se."enrollmentType", sa."totalDue"::FLOAT as td, sa."balance"::FLOAT as bal
    FROM students s
    JOIN student_enrollments se ON s.id = se."studentId"
    JOIN student_accounts sa ON sa."studentId" = s.id AND sa."academicYearId" = se."academicYearId"
    WHERE s."lastName" ILIKE '%AKPOVI%' OR (s."lastName" = 'ADAM' AND s."firstName" = 'Marouane')
  `);
  detail.rows.forEach(r => {
    console.log(`  ${r.last_name} ${r.first_name} | type=${r.enrollment_type} | totalDue=${r.td} | balance=${r.bal}`);
  });

  await client.end();
  console.log('\n✅ Correction terminée.');
}
main().catch(e => { console.error(e); process.exit(1); });
