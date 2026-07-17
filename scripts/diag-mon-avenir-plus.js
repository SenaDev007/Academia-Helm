/**
 * Diagnostic : analyser les données réelles de "Mon Avenir Plus" pour
 * identifier les causes des incohérences dans le bilan des encaissements :
 *   1. Filtre niveau ne filtre pas le tableau (uniquement le sélecteur classes)
 *   2. Montants incohérents (ex: Inscription 98000)
 *   3. Tranches non récupérées correctement
 *
 * Ce script lit directement la DB Neon sans passer par l'API.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== 1. Tenant Mon Avenir Plus ===');
  const tenants = await client.query(`
    SELECT id, name, subdomain FROM tenants
    WHERE LOWER(name) LIKE '%avenir%' OR LOWER(name) LIKE '%ndali%'
    ORDER BY name
  `);
  tenants.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.subdomain}`));
  if (tenants.rows.length === 0) {
    console.log('Aucun tenant trouvé');
    await client.end();
    return;
  }
  const tenantId = tenants.rows[0].id;
  console.log(`→ Tenant sélectionné: ${tenantId}`);

  console.log('\n=== 2. Année académique active ===');
  const years = await client.query(`
    SELECT id, name, "startDate", "endDate", "isActive"
    FROM academic_years WHERE "tenantId" = $1
    ORDER BY "startDate" DESC
  `, [tenantId]);
  years.rows.forEach(y => console.log(`  ${y.id} | ${y.name} | active=${y.isActive}`));
  const activeYear = years.rows.find(y => y.isActive) || years.rows[0];
  if (!activeYear) {
    console.log('Aucune année trouvée');
    await client.end();
    return;
  }
  const academicYearId = activeYear.id;
  console.log(`→ Année sélectionnée: ${academicYearId}`);

  console.log('\n=== 3. School levels du tenant ===');
  const levels = await client.query(`
    SELECT id, code, name, label FROM school_levels WHERE "tenantId" = $1
    ORDER BY code
  `, [tenantId]);
  levels.rows.forEach(l => console.log(`  ${l.id} | ${l.code} | ${l.name} | ${l.label}`));

  console.log('\n=== 4. Classes par niveau ===');
  const classes = await client.query(`
    SELECT c.id, c.name, c.code, c."schoolLevelId", sl.code as level_code, sl.name as level_name
    FROM classes c
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE c."tenantId" = $1
    ORDER BY sl.code, c.name
  `, [tenantId]);
  console.log(`Total classes: ${classes.rows.length}`);
  // Grouper par niveau
  const byLevel = {};
  classes.rows.forEach(c => {
    const key = c.level_code || 'AUCUN_NIVEAU';
    if (!byLevel[key]) byLevel[key] = [];
    byLevel[key].push(c);
  });
  Object.entries(byLevel).forEach(([levelCode, cls]) => {
    console.log(`  ${levelCode} (${cls.length} classes):`);
    cls.slice(0, 3).forEach(c => console.log(`    ${c.id} | ${c.name} | schoolLevelId=${c.schoolLevelId || 'NULL'}`));
    if (cls.length > 3) console.log(`    ... et ${cls.length - 3} autres`);
  });

  console.log('\n=== 5. FeeStructures (INSCRIPTION, REINSCRIPTION, TUITION) ===');
  const feeStructures = await client.query(`
    SELECT id, name, "feeType", "totalAmount", "isInstallment", "isActive",
      "classId", "academicClassId", "levelId"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isActive" = true
    ORDER BY "feeType", name
  `, [tenantId, academicYearId]);
  console.log(`Total structures actives: ${feeStructures.rows.length}`);
  // Grouper par feeType
  const byType = {};
  feeStructures.rows.forEach(fs => {
    if (!byType[fs.feeType]) byType[fs.feeType] = [];
    byType[fs.feeType].push(fs);
  });
  Object.entries(byType).forEach(([type, structs]) => {
    console.log(`\n  ${type} (${structs.length} structures):`);
    structs.slice(0, 5).forEach(fs => {
      const scope = fs.academicClassId ? `academicClass=${fs.academicClassId}` :
                   fs.classId ? `class=${fs.classId}` :
                   fs.levelId ? `level=${fs.levelId}` : 'GLOBAL';
      console.log(`    ${fs.id} | ${fs.name} | ${fs.totalAmount} FCFA | installments=${fs.isInstallment} | scope=${scope}`);
    });
    if (structs.length > 5) console.log(`    ... et ${structs.length - 5} autres`);
  });

  console.log('\n=== 6. Tranches (FeeStructureInstallment) par structure TUITION ===');
  const tuitionStructures = feeStructures.rows.filter(fs => fs.feeType === 'TUITION' && fs.isInstallment);
  for (const fs of tuitionStructures.slice(0, 5)) {
    const installments = await client.query(`
      SELECT id, label, amount, "orderIndex"
      FROM fee_structure_installments
      WHERE "feeStructureId" = $1
      ORDER BY "orderIndex" ASC
    `, [fs.id]);
    console.log(`\n  Structure ${fs.id} (${fs.name}, total=${fs.totalAmount}):`);
    installments.rows.forEach(inst => console.log(`    Tranche ${inst.orderIndex + 1}: ${inst.label} = ${inst.amount} FCFA`));
  }

  console.log('\n=== 7. Top 10 élèves avec paiements INSCRIPTION les plus élevés ===');
  // Pour identifier le "98 000" — vérifier si c'est un paiement réel ou une somme de plusieurs paiements
  const inscriptionPayments = await client.query(`
    SELECT
      s.id as student_id,
      s."firstName" || ' ' || s."lastName" as student_name,
      c.name as class_name,
      sl.code as level_code,
      COUNT(ft.id) as tx_count,
      SUM(fta.amount) as total_paid_inscription
    FROM finance_transactions ft
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = ft."academicYearId"
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND fs."feeType" = 'INSCRIPTION'
    GROUP BY s.id, s."firstName", s."lastName", c.name, sl.code
    ORDER BY total_paid_inscription DESC
    LIMIT 10
  `, [tenantId, academicYearId]);
  console.log('Top 10 élèves avec paiements INSCRIPTION:');
  inscriptionPayments.rows.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.student_name} | ${r.class_name || 'N/A'} | ${r.level_code || 'N/A'} | ${r.tx_count} tx | Total INSCRIPTION: ${r.total_paid_inscription} FCFA`);
  });

  console.log('\n=== 8. Total des transactions pour 3 élèves avec "Inscription > 50000" ===');
  // Pour comprendre la structure des données d'un élève avec paiement inscription élevé
  const targetStudents = inscriptionPayments.rows.filter(r => Number(r.total_paid_inscription) > 50000).slice(0, 3);
  for (const ts of targetStudents) {
    console.log(`\n--- Élève: ${ts.student_name} (${ts.class_name}, ${ts.level_code}) ---`);
    const txDetails = await client.query(`
      SELECT
        ft.id as tx_id,
        ft."receiptNumber",
        ft.amount,
        ft."createdAt",
        fta.amount as alloc_amount,
        fs."feeType",
        fs.name as fee_name,
        fs.id as fee_structure_id
      FROM finance_transactions ft
      JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
      JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      JOIN student_accounts sa ON sa.id = ft."studentAccountId"
      WHERE ft."tenantId" = $1
        AND ft."academicYearId" = $2
        AND sa."studentId" = $3
      ORDER BY ft."createdAt" DESC
      LIMIT 20
    `, [tenantId, academicYearId, ts.student_id]);
    txDetails.rows.forEach(t => {
      console.log(`  ${t.receiptNumber} | ${t.createdAt} | ${t.amount} → alloc ${t.alloc_amount} | ${t.feeType} (${t.fee_name}) | fsId=${t.fee_structure_id}`);
    });

    // Vérifier les FeeStructures qui devraient matcher pour cet élève
    console.log('  → FeeStructures qui matchent (INSCRIPTION/TUITION):');
    const matchingFs = await client.query(`
      SELECT fs.id, fs.name, fs."feeType", fs."totalAmount",
        fs."classId", fs."academicClassId", fs."levelId"
      FROM fee_structures fs
      WHERE fs."tenantId" = $1
        AND fs."academicYearId" = $2
        AND fs."isActive" = true
        AND fs."feeType" IN ('INSCRIPTION', 'REINSCRIPTION', 'TUITION')
      ORDER BY fs."feeType"
    `, [tenantId, academicYearId]);
    // Identifier la classe de l'élève
    const studentClass = await client.query(`
      SELECT se."classId", se."academicClassId", c."schoolLevelId"
      FROM student_enrollments se
      LEFT JOIN classes c ON c.id = se."classId"
      WHERE se."studentId" = $1 AND se."academicYearId" = $2
      LIMIT 1
    `, [ts.student_id, academicYearId]);
    const studentClassId = studentClass.rows[0]?.classId;
    const studentAcademicClassId = studentClass.rows[0]?.academicClassId;
    const studentLevelId = studentClass.rows[0]?.schoolLevelId;
    console.log(`    Élève: classId=${studentClassId}, academicClassId=${studentAcademicClassId}, schoolLevelId=${studentLevelId}`);
    matchingFs.rows.forEach(fs => {
      const scope = fs.academicClassId ? `academicClass` :
                   fs.classId ? `class` :
                   fs.levelId ? `level` : 'GLOBAL';
      const matches = fs.academicClassId === studentAcademicClassId ||
                     (!fs.academicClassId && fs.classId === studentClassId) ||
                     (!fs.academicClassId && !fs.classId && fs.levelId === studentLevelId) ||
                     (!fs.academicClassId && !fs.classId && !fs.levelId);
      console.log(`    ${fs.feeType} ${fs.name} (${fs.totalAmount}) | scope=${scope} → ${matches ? '✓ MATCH' : '✗ no match'}`);
    });
  }

  console.log('\n=== 9. Test du filtre niveau : compter élèves par niveau ===');
  for (const level of levels.rows.slice(0, 5)) {
    const count = await client.query(`
      SELECT COUNT(DISTINCT se."studentId") as nb
      FROM student_enrollments se
      JOIN classes c ON c.id = se."classId"
      WHERE se."tenantId" = $1 AND se."academicYearId" = $2
        AND se.status IN ('ACTIVE', 'ENROLLED', 'PENDING', 'ADMITTED')
        AND (c."schoolLevelId" = $3 OR c."schoolLevelId" IS NULL)
    `, [tenantId, academicYearId, level.id]);
    const countWithLevel = await client.query(`
      SELECT COUNT(DISTINCT se."studentId") as nb
      FROM student_enrollments se
      JOIN classes c ON c.id = se."classId"
      WHERE se."tenantId" = $1 AND se."academicYearId" = $2
        AND se.status IN ('ACTIVE', 'ENROLLED', 'PENDING', 'ADMITTED')
        AND c."schoolLevelId" = $3
    `, [tenantId, academicYearId, level.id]);
    console.log(`  Niveau ${level.code} (${level.name}): ${count.rows[0].nb} élèves (incluant NULL) | ${countWithLevel.rows[0].nb} élèves (levelId exact)`);
  }

  console.log('\n=== 10. Classes avec schoolLevelId NULL ===');
  const nullLevelClasses = await client.query(`
    SELECT id, name, code FROM classes
    WHERE "tenantId" = $1 AND "schoolLevelId" IS NULL
    ORDER BY name
  `, [tenantId]);
  console.log(`Total classes sans niveau: ${nullLevelClasses.rows.length}`);
  nullLevelClasses.rows.slice(0, 10).forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.code}`));

  await client.end();
  console.log('\n✅ Diagnostic terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
