/**
 * Script complet : configure fee structures + FeeOverride (FE 30%) + abandons (ABD)
 * pour le tenant CSP Mon Avenir Plus N'Dali — année 2025-2026
 *
 * 1. Fee structures TUITION par classe officielle (AcademicClass) avec tranches
 * 2. FeeOverride 30% pour élèves FE (fils/fille d'enseignant)
 * 3. Marquer élèves ABD comme WITHDRAWN
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const crypto = require('crypto');

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

// === DONNÉES EXTRACT DES FICHIERS EXCEL ===

// Scolarité par classe officielle (nom AcademicClass → montant)
const SCOLARITE_PAR_CLASSE = {
  'Maternelle 1': 50000,
  'Maternelle 2': 50000,
  'CI': 43000,
  'CP': 43000,
  'CE1': 48000,
  'CE2': 48000,
  'CM1': 53000,
  'CM2': 53000,
  '6ème': 70000,
  '5ème': 70000,
  '4ème': 70000,
  '3ème': 90000,
  '2nde D': 110000, // seule section de 2nde dans le fichier
};

// Inscription par niveau
const INSCRIPTION_PAR_NIVEAU = {
  'Maternelle': 5000,
  'Primaire': 5000,
  'Secondaire': 8000,
};

// Élèves FE (Fils/Fille d'Enseignant) — 30% de réduction sur la scolarité
const ELEVES_FE = [
  'CHABI Yorouba Jean de la croix.',
  'OROU G  M  E  Exaucee',
  'CHALLA Charle',
  'CHALLA Charlotte',
  'TOKO Nazirou',
  'TOKO Rouchdiath',
  'YACOUBOU Fadoul',
  'SINNA-HONNON Marcus',
  'SAKA Sidi Moudjibou',
  'SAKA Sidi IMAEL',
  'ADAM Zaida',
  'AGOSSAVI S  G  Benediction',
  'TABE Manou Alimatou Sadia',
  'KOGUI S  A  Halimou',
  'LAWANI Aïcha',
];

// Élèves ABD (Abandon) — à marquer WITHDRAWN
const ELEVES_ABD = [
  'DAGA Merveille',
  'HAMADOU Irfane',
  'SEIDOU Maifack',
  'N\u2019BESSA Audrey', // N'BESSA
  'GARBA Badyath',
  'IMOURANA A  Maboubatou',
  'MOUSTAPHA  Alia',
  'GARBA Affoussa',
  'PADONOU Enice',
  'TCHAKPONTER Sylas',
  'SANNI Zaraou',
  'RAZAKI Sayidi',
  'ALLOUNKOUN Ariane',
  'GOUNOU G. Siradjatou',
  'KPOVIWANOU    Ramziatou',
  'MIKPON AI    Faridath',
  'PADONOU Aimee',
  'TITILOKPE            Ibrahim',
  'IDRISSOU Rizidine',
  '0ROU Y  Raphael',
  'SAKA NOE Prisca',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Configuration fee structures + personnalisations + abandons ===\n');

  // ============================================================
  // ÉTAPE 1 : Créer/mettre à jour les FeeStructure TUITION par classe
  // ============================================================
  console.log('--- Étape 1 : Fee structures TUITION par classe ---');

  // Récupérer toutes les classes officielles
  const classes = await client.query(`
    SELECT id, name, code, "levelId" FROM pedagogy_academic_classes
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isActive" = true
    ORDER BY name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  // Récupérer les school_levels
  const levels = await client.query(`
    SELECT id, name, code FROM school_levels WHERE "tenantId" = $1
  `, [TENANT_ID]);
  const levelMap = {};
  levels.rows.forEach(l => levelMap[l.name] = l.id);

  let fsCreated = 0, fsUpdated = 0;

  for (const [className, scolariteAmount] of Object.entries(SCOLARITE_PAR_CLASSE)) {
    // Trouver l'AcademicClass correspondante
    const ac = classes.rows.find(c =>
      c.name.toLowerCase().trim() === className.toLowerCase().trim() ||
      c.name.toLowerCase().startsWith(className.toLowerCase())
    );
    if (!ac) {
      console.log(`  ⚠ Classe non trouvée: ${className}`);
      continue;
    }

    // Déterminer le levelId (SchoolLevel) pour cette classe
    let schoolLevelId = null;
    if (className.startsWith('Maternelle')) schoolLevelId = levelMap['Maternelle'];
    else if (['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].some(p => className.startsWith(p))) schoolLevelId = levelMap['Primaire'];
    else schoolLevelId = levelMap['Secondaire'];

    // Vérifier si une fee_structure TUITION existe déjà pour cette classe
    const existing = await client.query(`
      SELECT id, "totalAmount" FROM fee_structures
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "academicClassId" = $3 AND "feeType" = 'TUITION'
    `, [TENANT_ID, ACADEMIC_YEAR_ID, ac.id]);

    if (existing.rows.length > 0) {
      // Mettre à jour le montant si différent
      if (parseFloat(existing.rows[0].totalAmount) !== scolariteAmount) {
        await client.query(`
          UPDATE fee_structures SET "totalAmount" = $1, "updatedAt" = NOW()
          WHERE id = $2
        `, [scolariteAmount, existing.rows[0].id]);
        fsUpdated++;
        console.log(`  ✓ MAJ: ${className} → ${scolariteAmount} (was ${existing.rows[0].totalAmount})`);
      }
    } else {
      // Créer la fee_structure
      await client.query(`
        INSERT INTO fee_structures
          (id, "tenantId", "academicYearId", "academicClassId", "levelId", name, "feeType",
           "totalAmount", "isInstallment", "isMandatory", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'TUITION', $6, true, true, NOW(), NOW())
      `, [TENANT_ID, ACADEMIC_YEAR_ID, ac.id, schoolLevelId,
          `Frais de scolarité — ${className}`, scolariteAmount]);
      fsCreated++;
      console.log(`  🆕 Créé: ${className} → ${scolariteAmount}`);
    }
  }
  console.log(`  Total: ${fsCreated} créés, ${fsUpdated} mis à jour.`);

  // ============================================================
  // ÉTAPE 2 : Créer les FeeOverride pour les élèves FE (30%)
  // ============================================================
  console.log('\n--- Étape 2 : Personnalisations FE (30% de réduction) ---');

  // Charger tous les élèves pour le matching
  const dbStudents = await client.query(`
    SELECT s.id, s."firstName", s."lastName", sa.id as account_id,
           se."academicClassId"
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = $2
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  const studentMap = {};
  for (const s of dbStudents.rows) {
    const key = normalizeName(`${s.lastName} ${s.firstName}`);
    if (!studentMap[key]) studentMap[key] = s;
  }

  let feCreated = 0, feSkipped = 0;

  for (const feName of ELEVES_FE) {
    const key = normalizeName(feName);
    const student = studentMap[key];
    if (!student) {
      console.log(`  ⚠ Élève FE non trouvé: ${feName}`);
      feSkipped++;
      continue;
    }

    // Trouver le breakdown TUITION de cet élève
    const tuitionBd = await client.query(`
      SELECT ab.id, ab."feeStructureId", ab."initialAmount", fs."totalAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'TUITION'
      LIMIT 1
    `, [student.account_id]);

    if (tuitionBd.rows.length === 0) {
      console.log(`  ⚠ Pas de breakdown TUITION pour ${feName}`);
      feSkipped++;
      continue;
    }

    const bd = tuitionBd.rows[0];
    const originalAmount = parseFloat(bd.totalAmount);
    const reducedAmount = Math.round(originalAmount * 0.7 * 100) / 100; // 30% de réduction

    // Vérifier si un FeeOverride existe déjà
    const existingOverride = await client.query(`
      SELECT id FROM fee_overrides WHERE "studentId" = $1 AND "feeStructureId" = $2
    `, [student.id, bd.feeStructureId]);

    if (existingOverride.rows.length > 0) {
      // Mettre à jour
      await client.query(`
        UPDATE fee_overrides SET "customAmount" = $1, reason = $2
        WHERE "studentId" = $3 AND "feeStructureId" = $4
      `, [reducedAmount, 'Fils/Fille d\'enseignant (FE) — 30% de réduction', student.id, bd.feeStructureId]);
      console.log(`  ✓ MAJ override: ${feName} → ${reducedAmount} (30% sur ${originalAmount})`);
    } else {
      // Créer le FeeOverride
      await client.query(`
        INSERT INTO fee_overrides (id, "feeStructureId", "studentId", "customAmount", reason, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [bd.feeStructureId, student.id, reducedAmount,
          'Fils/Fille d\'enseignant (FE) — 30% de réduction']);
      console.log(`  🆕 Override créé: ${feName} → ${reducedAmount} (30% sur ${originalAmount})`);
    }

    // Mettre à jour le breakdown avec le nouveau montant
    await client.query(`
      UPDATE account_breakdowns
      SET "initialAmount" = $1, "adjustedAmount" = $1,
          "remainingAmount" = GREATEST($1 - "paidAmount", 0)
      WHERE id = $2
    `, [reducedAmount, bd.id]);

    feCreated++;
  }
  console.log(`  Total: ${feCreated} personnalisations FE créées/mises à jour, ${feSkipped} skippés.`);

  // ============================================================
  // ÉTAPE 3 : Marquer les élèves ABD comme WITHDRAWN
  // ============================================================
  console.log('\n--- Étape 3 : Abandons (ABD) ---');

  let abdCount = 0, abdSkipped = 0;

  for (const abdName of ELEVES_ABD) {
    const key = normalizeName(abdName);
    const student = studentMap[key];
    if (!student) {
      console.log(`  ⚠ Élève ABD non trouvé: ${abdName}`);
      abdSkipped++;
      continue;
    }

    // Mettre à jour le statut de l'élève
    await client.query(`
      UPDATE students SET status = 'WITHDRAWN', "isActive" = false, "updatedAt" = NOW()
      WHERE id = $1
    `, [student.id]);

    // Mettre à jour l'enrollment
    await client.query(`
      UPDATE student_enrollments
      SET status = 'WITHDRAWN', "exitDate" = NOW(), "exitReason" = 'Abandon (ABD)'
      WHERE "studentId" = $1 AND "academicYearId" = $2
    `, [student.id, ACADEMIC_YEAR_ID]);

    console.log(`  ✓ ABD: ${abdName}`);
    abdCount++;
  }
  console.log(`  Total: ${abdCount} abandons marqués, ${abdSkipped} non trouvés.`);

  // ============================================================
  // ÉTAPE 4 : Recalculer tous les soldes
  // ============================================================
  console.log('\n--- Étape 4 : Recalcul des soldes ---');

  // Mettre à jour les breakdowns paidAmount/remainingAmount depuis les allocations
  await client.query(`
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

  // Recalculer les student_accounts
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  await client.query(`
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
  console.log('  Soldes recalculés.');

  // ============================================================
  // VÉRIFICATION FINALE
  // ============================================================
  console.log('\n=== Vérification finale ===');

  const stats = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE sa.balance = 0) as soldes_zero,
      COUNT(*) FILTER (WHERE sa.balance > 0) as soldes_positifs,
      COUNT(*) FILTER (WHERE sa.balance < 0) as soldes_negatifs,
      COUNT(*) as total
    FROM student_accounts sa
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log('Comptes:', stats.rows[0]);

  const feCount = await client.query(`SELECT COUNT(*) as n FROM fee_overrides fo JOIN fee_structures fs ON fs.id = fo."feeStructureId" WHERE fs."tenantId" = $1`, [TENANT_ID]);
  console.log(`FeeOverrides total: ${feCount.rows[0].n}`);

  const abdCount2 = await client.query(`SELECT COUNT(*) as n FROM students WHERE "tenantId" = $1 AND status = 'WITHDRAWN'`, [TENANT_ID]);
  console.log(`Élèves WITHDRAWN: ${abdCount2.rows[0].n}`);

  const fsCount = await client.query(`SELECT COUNT(*) as n FROM fee_structures WHERE "tenantId" = $1 AND "academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Fee structures: ${fsCount.rows[0].n}`);

  // Échantillon des personnalisations FE
  console.log('\nÉchantillon personnalisations FE:');
  const feSample = await client.query(`
    SELECT s."lastName", s."firstName", fo."customAmount", fo.reason
    FROM fee_overrides fo
    JOIN students s ON s.id = fo."studentId"
    JOIN fee_structures fs ON fs.id = fo."feeStructureId"
    WHERE fs."tenantId" = $1
    LIMIT 5
  `, [TENANT_ID]);
  feSample.rows.forEach(r => console.log(`  ${r.lastName} ${r.firstName} | custom=${r.customAmount} | ${r.reason}`));

  await client.end();
  console.log('\n✅ Configuration terminée.');
}

main().catch(e => { console.error(e); process.exit(1); });
