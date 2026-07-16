/**
 * Correction des personnalisations FONDÉ :
 *
 * ERREUR CORRIGÉE : Les 10 élèves FONDÉ avaient reçu une exonération à 100% (customAmount=0)
 * alors qu'ils doivent payer la scolarité normale — ils paient directement au promoteur,
 * ils ne sont pas exonérés.
 *
 * Corrections à apporter :
 * 1. FONDÉ (10 élèves) : Supprimer l'exonération 100%, restaurer le montant normal,
 *    créer FeeOverride avec raison "Paiement direct au promoteur (Fondé Ami)" sans réduction
 * 2. AMI (1 élève : KOTCHONI Miracle) : FeeOverride avec raison "Ami du fondateur — paiement direct au promoteur"
 * 3. Enft Fondé (1 élève : DJIMA Ramzi) : CONSERVER 100% d'exonération (enfant du fondateur = correct)
 * 4. en fin d'année (1 élève : ASSOUMA FAI) : FeeOverride avec raison "Paiement prévu en fin d'année"
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

// === 10 élèves FONDÉ : paiement direct au promoteur (PAS d'exonération) ===
// Montant scolarité par classe (depuis l'Excel)
const ELEVES_FONDE_AMI = {
  'KORA Nassira': 53000,        // CM1 B
  'KANSO Abed Négo': 53000,     // CM1 A (a aussi un arriéré de 59000)
  'TAIO Gedial': 48000,         // CE2 A (a aussi un arriéré de 208000)
  'TAIO Gekiel': 48000,         // CE2 A (a aussi un arriéré de 48000)
  'GORADO Aïmane': 48000,       // CE2 B
  'GOUNOU Rufine': 48000,       // CE2 B
  'GORADO Nazifatou': 90000,    // 3e
  'GORADO Mouhamadou': 70000,   // 4e
  'TCHOBI WIDAD': 70000,        // 4e
  'SIDIBE Ramdane': 70000,      // 5e (a déjà payé 70000)
};

// === 1 élève AMI : ami du fondateur ===
const ELEVES_AMI = {
  'KOTCHONI Miracle': 90000, // 3e — a déjà payé 90000
};

// === 1 élève EN FIN D'ANNÉE ===
const ELEVES_EN_FIN_ANNEE = {
  'ASSOUMA FAI': 50000, // Maternelle 2 — a payé 10000, reste 40000
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Correction personnalisations FONDÉ / AMI / EN FIN D\'ANNÉE ===\n');

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

  // ============================================================
  // ÉTAPE 1 : Corriger les 10 élèves FONDÉ (supprimer exonération 100%)
  // ============================================================
  console.log('--- Étape 1 : Correction FONDÉ (paiement direct au promoteur) ---');

  for (const [fondeName, scolariteAmount] of Object.entries(ELEVES_FONDE_AMI)) {
    const key = normalizeName(fondeName);
    const student = studentMap[key];
    if (!student) {
      console.log(`  ⚠ Non trouvé: ${fondeName}`);
      continue;
    }

    // Récupérer le breakdown TUITION
    const tuitionBd = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount", ab."paidAmount", ab."remainingAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'TUITION'
      LIMIT 1
    `, [student.account_id]);

    if (tuitionBd.rows.length === 0) {
      console.log(`  ⚠ Pas de breakdown TUITION pour ${fondeName}`);
      continue;
    }

    const bd = tuitionBd.rows[0];
    const paidAmount = parseFloat(bd.paidAmount) || 0;

    // Restaurer le montant normal de la scolarité
    await client.query(`
      UPDATE account_breakdowns
      SET "initialAmount" = $1::numeric, "adjustedAmount" = $1::numeric,
          "remainingAmount" = GREATEST($1::numeric - $2::numeric, 0)
      WHERE id = $3
    `, [scolariteAmount, paidAmount, bd.id]);

    // Mettre à jour le FeeOverride (supprimer 100%, mettre raison "paiement direct")
    const existing = await client.query(`
      SELECT id FROM fee_overrides WHERE "studentId" = $1 AND "feeStructureId" = $2
    `, [student.id, bd.feeStructureId]);

    if (existing.rows.length > 0) {
      await client.query(`
        UPDATE fee_overrides SET "customAmount" = $1, reason = $2
        WHERE "studentId" = $3 AND "feeStructureId" = $4
      `, [scolariteAmount, 'Paiement direct au promoteur/fondateur (Fondé Ami) — montant normal, paiement hors caisse', student.id, bd.feeStructureId]);
    } else {
      await client.query(`
        INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [bd.feeStructureId, student.id, scolariteAmount, 'Paiement direct au promoteur/fondateur (Fondé Ami) — montant normal, paiement hors caisse']);
    }

    console.log(`  ✓ ${fondeName} → scolarité restaurée à ${scolariteAmount} (payé=${paidAmount}, reste=${scolariteAmount - paidAmount})`);
  }

  // ============================================================
  // ÉTAPE 2 : Créer FeeOverride pour AMI (KOTCHONI Miracle)
  // ============================================================
  console.log('\n--- Étape 2 : AMI du fondateur ---');

  for (const [amiName, scolariteAmount] of Object.entries(ELEVES_AMI)) {
    const key = normalizeName(amiName);
    const student = studentMap[key];
    if (!student) {
      console.log(`  ⚠ Non trouvé: ${amiName}`);
      continue;
    }

    const tuitionBd = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount", ab."paidAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'TUITION'
      LIMIT 1
    `, [student.account_id]);

    if (tuitionBd.rows.length === 0) {
      console.log(`  ⚠ Pas de breakdown TUITION pour ${amiName}`);
      continue;
    }

    const bd = tuitionBd.rows[0];
    const existing = await client.query(`
      SELECT id FROM fee_overrides WHERE "studentId" = $1 AND "feeStructureId" = $2
    `, [student.id, bd.feeStructureId]);

    if (existing.rows.length > 0) {
      await client.query(`
        UPDATE fee_overrides SET "customAmount" = $1, reason = $2
        WHERE "studentId" = $3 AND "feeStructureId" = $4
      `, [scolariteAmount, 'Ami du fondateur — paiement direct au promoteur (montant normal)', student.id, bd.feeStructureId]);
    } else {
      await client.query(`
        INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [bd.feeStructureId, student.id, scolariteAmount, 'Ami du fondateur — paiement direct au promoteur (montant normal)']);
    }

    console.log(`  ✓ ${amiName} → override créé (montant normal ${scolariteAmount}, raison: Ami du fondateur)`);
  }

  // ============================================================
  // ÉTAPE 3 : Créer FeeOverride pour EN FIN D'ANNÉE (ASSOUMA FAI)
  // ============================================================
  console.log('\n--- Étape 3 : Paiement en fin d\'année ---');

  for (const [finName, scolariteAmount] of Object.entries(ELEVES_EN_FIN_ANNEE)) {
    const key = normalizeName(finName);
    const student = studentMap[key];
    if (!student) {
      console.log(`  ⚠ Non trouvé: ${finName}`);
      continue;
    }

    const tuitionBd = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount", ab."paidAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'TUITION'
      LIMIT 1
    `, [student.account_id]);

    if (tuitionBd.rows.length === 0) {
      console.log(`  ⚠ Pas de breakdown TUITION pour ${finName}`);
      continue;
    }

    const bd = tuitionBd.rows[0];
    const existing = await client.query(`
      SELECT id FROM fee_overrides WHERE "studentId" = $1 AND "feeStructureId" = $2
    `, [student.id, bd.feeStructureId]);

    if (existing.rows.length > 0) {
      await client.query(`
        UPDATE fee_overrides SET "customAmount" = $1, reason = $2
        WHERE "studentId" = $3 AND "feeStructureId" = $4
      `, [scolariteAmount, 'Paiement prévu en fin d\'année scolaire', student.id, bd.feeStructureId]);
    } else {
      await client.query(`
        INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [bd.feeStructureId, student.id, scolariteAmount, 'Paiement prévu en fin d\'année scolaire']);
    }

    console.log(`  ✓ ${finName} → override créé (montant ${scolariteAmount}, raison: Paiement en fin d'année)`);
  }

  // ============================================================
  // ÉTAPE 4 : Vérifier que DJIMA Ramzi (ENFT FONDÉ) conserve bien 100%
  // ============================================================
  console.log('\n--- Étape 4 : Vérification ENFT FONDÉ (DJIMA Ramzi) ---');
  const djima = studentMap[normalizeName('DJIMA Ramzi')];
  if (djima) {
    const djimaBd = await client.query(`
      SELECT ab.id, ab."initialAmount", fo."customAmount", fo.reason
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      LEFT JOIN fee_overrides fo ON fo."feeStructureId" = fs.id AND fo."studentId" = $1
      WHERE ab."studentAccountId" = $2 AND fs."feeType" = 'TUITION'
    `, [djima.id, djima.account_id]);

    if (djimaBd.rows.length > 0) {
      const bd = djimaBd.rows[0];
      console.log(`  ✓ DJIMA Ramzi: initial=${bd.initialAmount}, custom=${bd.customAmount}, reason=${bd.reason}`);
      if (parseFloat(bd.initialAmount) !== 0 || parseFloat(bd.customAmount) !== 0) {
        console.log(`  ⚠ DJIMA Ramzi n'a pas l'exonération 100% ! Correction...`);
        await client.query(`
          UPDATE account_breakdowns SET "initialAmount" = 0, "adjustedAmount" = 0, "remainingAmount" = 0 WHERE id = $1
        `, [bd.id]);
        await client.query(`
          UPDATE fee_overrides SET "customAmount" = 0, reason = 'Enfant du fondateur (ENFT FONDÉ) — 100% d\'exonération'
          WHERE "studentId" = $1 AND "feeStructureId" = $2
        `, [djima.id, djimaBd.rows[0].feeStructureId]);
        console.log(`  ✓ DJIMA Ramzi: exonération 100% restaurée`);
      }
    }
  }

  // ============================================================
  // ÉTAPE 5 : Recalculer les soldes
  // ============================================================
  console.log('\n--- Étape 5 : Recalcul des soldes ---');
  await client.query(`
    WITH alloc_sums AS (
      SELECT fa."accountBreakdownId", SUM(fa.amount) as total_allocated
      FROM finance_transaction_allocations fa
      JOIN finance_transactions ft ON ft.id = fa."financeTransactionId"
      WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
      GROUP BY fa."accountBreakdownId"
    )
    UPDATE account_breakdowns ab
    SET "paidAmount" = COALESCE(alloc_sums.total_allocated, 0),
        "remainingAmount" = GREATEST(ab."initialAmount" - COALESCE(alloc_sums.total_allocated, 0), 0)
    FROM alloc_sums WHERE ab.id = alloc_sums."accountBreakdownId"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

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

  // ============================================================
  // VÉRIFICATION FINALE
  // ============================================================
  console.log('\n=== Vérification finale ===');

  const overrides = await client.query(`
    SELECT s."lastName", s."firstName", fo."customAmount", fo.reason
    FROM fee_overrides fo
    JOIN students s ON s.id = fo."studentId"
    JOIN fee_structures fs ON fs.id = fo."feeStructureId"
    WHERE fs."tenantId" = $1
    ORDER BY fo.reason, s."lastName"
  `, [TENANT_ID]);

  console.log(`\nTous les FeeOverrides (${overrides.rows.length}):`);
  overrides.rows.forEach(r => {
    const amount = parseFloat(r.customAmount);
    const type = amount === 0 ? 'EXONÉRATION 100%' : `Montant: ${amount}`;
    console.log(`  ${r.lastName} ${r.firstName} | ${type} | ${r.reason}`);
  });

  await client.end();
  console.log('\n✅ Corrections terminées.');
}

main().catch(e => { console.error(e); process.exit(1); });
