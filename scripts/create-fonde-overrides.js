/**
 * Crée les FeeOverride 100% pour les élèves FONDÉ (lien avec le promoteur/fondateur).
 * Ces élèves ne paient ni inscription ni scolarité (100% de réduction).
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

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

// Élèves FONDÉ (lien avec le fondateur/promoteur) — 100% de réduction
const ELEVES_FONDE = [
  'KORA Nassira',
  'KANSO Abed Négo',
  'TAIO Gedial',
  'TAIO Gekiel',
  'GORADO Aïmane',
  'GOUNOU Rufine',
  'DJIMA Ramzi',
  'GORADO Nazifatou',
  'GORADO Mouhamadou',
  'TCHOBI WIDAD',
  'SIDIBE Ramdane',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Personnalisations FONDÉ (100% de réduction) ===\n');

  // Charger les élèves
  const dbStudents = await client.query(`
    SELECT s.id, s."firstName", s."lastName", sa.id as account_id
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  const studentMap = {};
  for (const s of dbStudents.rows) {
    const key = normalizeName(`${s.lastName} ${s.firstName}`);
    if (!studentMap[key]) studentMap[key] = s;
  }

  let created = 0, skipped = 0;

  for (const fondeName of ELEVES_FONDE) {
    const key = normalizeName(fondeName);
    const student = studentMap[key];
    if (!student) {
      console.log(`  ⚠ Élève FONDÉ non trouvé: ${fondeName}`);
      skipped++;
      continue;
    }

    // Trouver tous les breakdowns de cet élève (INSCRIPTION + TUITION)
    const breakdowns = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount", fs."feeType", fs."totalAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1
    `, [student.account_id]);

    for (const bd of breakdowns.rows) {
      const reducedAmount = 0; // 100% de réduction

      // Vérifier si un FeeOverride existe déjà
      const existing = await client.query(`
        SELECT id FROM fee_overrides WHERE "studentId" = $1 AND "feeStructureId" = $2
      `, [student.id, bd.feeStructureId]);

      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE fee_overrides SET "customAmount" = 0, reason = $1
          WHERE "studentId" = $2 AND "feeStructureId" = $3
        `, ['Fondateur/Promoteur (FONDÉ) — 100% de réduction', student.id, bd.feeStructureId]);
      } else {
        await client.query(`
          INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt")
          VALUES (gen_random_uuid(), $1, $2, 0, $3, NOW())
        `, [bd.feeStructureId, student.id, 'Fondateur/Promoteur (FONDÉ) — 100% de réduction']);
      }

      // Mettre à jour le breakdown avec le montant réduit (0)
      await client.query(`
        UPDATE account_breakdowns
        SET "initialAmount" = 0, "adjustedAmount" = 0, "remainingAmount" = 0
        WHERE id = $1
      `, [bd.id]);
    }

    console.log(`  ✓ FONDÉ: ${fondeName} → 0 FCFA (100% sur ${breakdowns.rows.length} breakdowns)`);
    created++;
  }

  console.log(`\nTotal: ${created} personnalisations FONDÉ créées, ${skipped} non trouvés.`);

  // Recalculer les soldes
  console.log('\nRecalcul des soldes...');
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  await client.query(`
    WITH account_totals AS (
      SELECT ab."studentAccountId",
        SUM(ab."initialAmount") as new_total_due,
        SUM(ab."paidAmount") as new_total_paid
      FROM account_breakdowns ab
      JOIN student_accounts sa ON sa.id = ab."studentAccountId"
      WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
      GROUP BY ab."studentAccountId"
    )
    UPDATE student_accounts sa
    SET "totalDue" = at.new_total_due, "totalPaid" = at.new_total_paid,
        "balance" = at.new_total_due - at.new_total_paid, "updatedAt" = NOW()
    FROM account_totals at WHERE sa.id = at."studentAccountId"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  await client.query('COMMIT');

  // Vérification
  const cnt = await client.query(`SELECT COUNT(*) as n FROM fee_overrides fo JOIN fee_structures fs ON fs.id = fo."feeStructureId" WHERE fs."tenantId" = $1`, [TENANT_ID]);
  console.log(`Total FeeOverrides: ${cnt.rows[0].n}`);

  await client.end();
  console.log('\n✅ Personnalisations FONDé terminées.');
}

main().catch(e => { console.error(e); process.exit(1); });
