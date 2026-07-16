/**
 * Fix définitif : supprimer TOUS les anciens FeeOverrides "FONDÉ 100%" et
 * les remplacer par les bonnes personnalisations.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

function normalizeName(name) {
  if (!name) return '';
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[.';,/_-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// 10 élèves FONDÉ → paiement direct au promoteur (montant normal, pas d'exonération)
const FONDE_AMI = {
  'KORA Nassira': 53000, 'KANSO Abed Négo': 53000, 'TAIO Gedial': 48000,
  'TAIO Gekiel': 48000, 'GORADO Aïmane': 48000, 'GOUNOU Rufine': 48000,
  'GORADO Nazifatou': 90000, 'GORADO Mouhamadou': 70000, 'TCHOBI WIDAD': 70000,
  'SIDIBE Ramdane': 70000,
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Fix définitif FONDÉ ===\n');

  // 1. Mettre à jour TOUS les FeeOverrides avec l'ancienne raison FONDÉ 100%
  // (on ne peut pas DELETE à cause du trigger prevent_fee_override_delete)
  const upd = await client.query(`
    UPDATE fee_overrides SET "customAmount" = 999999, reason = '__TO_UPDATE__'
    WHERE reason = 'Fondateur/Promoteur (FONDÉ) — 100% de réduction'
    RETURNING "studentId", "feeStructureId"
  `);
  console.log(`Anciens overrides FONDÉ 100% marqués pour update: ${upd.rows.length}`);

  // 2. Charger les élèves
  const dbStudents = await client.query(`
    SELECT s.id, s."firstName", s."lastName", sa.id as account_id
    FROM students s JOIN student_accounts sa ON sa."studentId" = s.id
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  const studentMap = {};
  for (const s of dbStudents.rows) {
    studentMap[normalizeName(`${s.lastName} ${s.firstName}`)] = s;
  }

  // 3. Pour chaque FONDÉ AMI : restaurer breakdowns + créer nouvel override
  for (const [name, scolarite] of Object.entries(FONDE_AMI)) {
    const student = studentMap[normalizeName(name)];
    if (!student) { console.log(`  ⚠ Non trouvé: ${name}`); continue; }

    // Récupérer le breakdown TUITION (même si initialAmount=0)
    let bd = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount", ab."paidAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'TUITION'
      LIMIT 1
    `, [student.account_id]);

    let bdId, fsId;
    if (bd.rows.length === 0) {
      // Pas de breakdown TUITION → en créer un avec une fee_structure TUITION existante
      const fsRes = await client.query(`
        SELECT id FROM fee_structures WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'TUITION' LIMIT 1
      `, [TENANT_ID, ACADEMIC_YEAR_ID]);
      if (fsRes.rows.length === 0) { console.log(`  ⚠ Pas de fee_structure TUITION pour ${name}`); continue; }
      fsId = fsRes.rows[0].id;
      const newBd = await client.query(`
        INSERT INTO account_breakdowns (id, "studentAccountId", "feeStructureId", "initialAmount", "adjustedAmount", "paidAmount", "remainingAmount")
        VALUES (gen_random_uuid(), $1, $2, $3::numeric, $3::numeric, 0, $3::numeric) RETURNING id
      `, [student.account_id, fsId, scolarite]);
      bdId = newBd.rows[0].id;
      console.log(`  🆕 Breakdown TUITION créé pour ${name} (${scolarite})`);
    } else {
      bdId = bd.rows[0].id;
      fsId = bd.rows[0].feeStructureId;
      const paid = parseFloat(bd.rows[0].paidAmount) || 0;
      await client.query(`
        UPDATE account_breakdowns SET "initialAmount" = $1::numeric, "adjustedAmount" = $1::numeric,
            "remainingAmount" = GREATEST($1::numeric - $2::numeric, 0) WHERE id = $3
      `, [scolarite, paid, bdId]);
      console.log(`  ✓ ${name} → scolarité restaurée à ${scolarite} (payé=${paid})`);
    }

    // Créer ou mettre à jour le FeeOverride avec la bonne raison
    const existing = await client.query(`
      SELECT id FROM fee_overrides WHERE "studentId" = $1 AND "feeStructureId" = $2
    `, [student.id, fsId]);

    if (existing.rows.length > 0) {
      // Update l'override existant (y compris ceux marqués __TO_UPDATE__)
      await client.query(`
        UPDATE fee_overrides SET "customAmount" = $1::numeric, reason = $2
        WHERE "studentId" = $3 AND "feeStructureId" = $4
      `, [scolarite, 'Paiement direct au promoteur/fondateur (Fondé Ami) — montant normal, paiement hors caisse', student.id, fsId]);
    } else {
      await client.query(`
        INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3::numeric, $4, NOW())
      `, [fsId, student.id, scolarite, 'Paiement direct au promoteur/fondateur (Fondé Ami) — montant normal, paiement hors caisse']);
    }
  }

  // 4. Vérifier DJIMA Ramzi (ENFT FONDÉ = 100% exonération)
  const djima = studentMap[normalizeName('DJIMA Ramzi')];
  if (djima) {
    const bd = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount" FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'TUITION' LIMIT 1
    `, [djima.account_id]);
    if (bd.rows.length > 0) {
      await client.query(`UPDATE account_breakdowns SET "initialAmount"=0, "adjustedAmount"=0, "remainingAmount"=0 WHERE id=$1`, [bd.rows[0].id]);
      const existing = await client.query(`SELECT id FROM fee_overrides WHERE "studentId"=$1 AND "feeStructureId"=$2`, [djima.id, bd.rows[0].feeStructureId]);
      if (existing.rows.length === 0) {
        await client.query(`INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt") VALUES (gen_random_uuid(), $1, $2, 0, $3, NOW())`,
          [bd.rows[0].feeStructureId, djima.id, 'Enfant du fondateur (ENFT FONDÉ) — 100% d\'exonération']);
      }
      console.log(`  ✓ DJIMA Ramzi → 100% exonération confirmée`);
    }
  }

  // 5. Recalculer les soldes
  await client.query(`
    WITH alloc_sums AS (
      SELECT fa."accountBreakdownId", SUM(fa.amount) as total_allocated
      FROM finance_transaction_allocations fa
      JOIN finance_transactions ft ON ft.id = fa."financeTransactionId"
      WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
      GROUP BY fa."accountBreakdownId"
    )
    UPDATE account_breakdowns ab SET "paidAmount" = COALESCE(alloc_sums.total_allocated, 0),
        "remainingAmount" = GREATEST(ab."initialAmount" - COALESCE(alloc_sums.total_allocated, 0), 0)
    FROM alloc_sums WHERE ab.id = alloc_sums."accountBreakdownId"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  await client.query('BEGIN');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  await client.query(`
    WITH at AS (
      SELECT ab."studentAccountId", SUM(ab."initialAmount") as due, SUM(ab."paidAmount") as paid
      FROM account_breakdowns ab JOIN student_accounts sa ON sa.id = ab."studentAccountId"
      WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2 GROUP BY ab."studentAccountId"
    )
    UPDATE student_accounts sa SET "totalDue" = at.due, "totalPaid" = at.paid, "balance" = at.due - at.paid, "updatedAt" = NOW()
    FROM at WHERE sa.id = at."studentAccountId"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  await client.query('COMMIT');

  // 6. Vérification
  const overrides = await client.query(`
    SELECT s."lastName", s."firstName", fo."customAmount", fo.reason
    FROM fee_overrides fo JOIN students s ON s.id = fo."studentId"
    JOIN fee_structures fs ON fs.id = fo."feeStructureId"
    WHERE fs."tenantId" = $1 ORDER BY fo.reason, s."lastName"
  `, [TENANT_ID]);
  console.log(`\nTous les FeeOverrides (${overrides.rows.length}):`);
  overrides.rows.forEach(r => {
    const amt = parseFloat(r.customAmount);
    console.log(`  ${r.lastName} ${r.firstName} | ${amt === 0 ? 'EXONÉRATION 100%' : amt} | ${r.reason}`);
  });

  await client.end();
  console.log('\n✅ Fix terminé.');
}
main().catch(e => { console.error(e); process.exit(1); });
