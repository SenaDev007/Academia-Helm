/**
 * Test du filtre niveau sur l'API collection-summary.
 * Connexion avec le token du promoteur Mon Avenir Plus et test direct.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const academicYearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  // Reproduire EXACTEMENT la logique du controller :
  console.log('=== Reproduction de la logique du controller ===\n');

  // 1. Sans filtre (tous)
  const allEnrollments = await client.query(`
    SELECT se."studentId", se."classId", se."academicClassId",
      c.name as class_name, c."schoolLevelId"
    FROM student_enrollments se
    LEFT JOIN classes c ON c.id = se."classId"
    WHERE se."tenantId" = $1 AND se."academicYearId" = $2
      AND se.status IN ('ACTIVE', 'ENROLLED', 'PENDING', 'ADMITTED')
  `, [tenantId, academicYearId]);
  console.log(`1. Total enrollments (sans filtre): ${allEnrollments.rows.length}`);

  // 2. Avec filtre niveau SECONDAIRE
  const secondaireId = '95fae326-6da3-4a4a-a95c-6f5164dd5024';
  const filteredSecondaire = allEnrollments.rows.filter(e =>
    e.schoolLevelId === secondaireId
  );
  console.log(`2. Enrollments SECONDAIRE (via schoolLevelId): ${filteredSecondaire.length}`);

  // 3. Vérifier combien de classes distinctes parmi les SECONDAIRE
  const secondaireClasses = [...new Set(filteredSecondaire.map(e => e.class_name))];
  console.log(`3. Classes SECONDAIRE distinctes: ${secondaireClasses.length}`);
  console.log(`   → ${secondaireClasses.join(', ')}`);

  // 4. Pour chaque classe SECONDAIRE, combien d'élèves
  const byClass = {};
  filteredSecondaire.forEach(e => {
    const cn = e.class_name || 'N/A';
    if (!byClass[cn]) byClass[cn] = 0;
    byClass[cn]++;
  });
  console.log('\n4. Élèves par classe SECONDAIRE:');
  Object.entries(byClass).forEach(([cls, count]) => {
    console.log(`   ${cls}: ${count} élèves`);
  });

  // 5. Vérifier le total des paiements INSCRIPTION pour les élèves SECONDAIRE
  const secondaireStudentIds = filteredSecondaire.map(e => e.studentId);
  console.log(`\n5. Test paiements pour ${secondaireStudentIds.length} élèves SECONDAIRE:`);
  const paymentsByType = await client.query(`
    SELECT
      fs."feeType",
      COUNT(DISTINCT ft.id) as tx_count,
      SUM(fta.amount) as total_amount
    FROM finance_transactions ft
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND sa."studentId" = ANY($3::text[])
    GROUP BY fs."feeType"
    ORDER BY total_amount DESC
  `, [tenantId, academicYearId, secondaireStudentIds]);
  console.log('   Répartition par feeType:');
  paymentsByType.rows.forEach(r => {
    console.log(`     ${r.feeType}: ${r.tx_count} tx, total = ${r.total_amount} FCFA`);
  });

  // 6. EXPECTED: INSCRIPTION pour SECONDAIRE = 180 élèves × 8000 FCFA = 1 440 000 FCFA
  console.log(`\n6. Comparaison:`);
  console.log(`   INSCRIPTION attendu (180 élèves × 8000): 1 440 000 FCFA`);
  const inscriptionPaidRow = paymentsByType.rows.find(r => r.feeType === 'INSCRIPTION');
  console.log(`   INSCRIPTION payé réel:                   ${inscriptionPaidRow?.total_amount || 0} FCFA`);
  console.log(`   → Écart: ${Number(inscriptionPaidRow?.total_amount || 0) - 1440000} FCFA (probablement mal taggé)`);

  // 7. Compter les transactions par tranche Excel (P1, P2, P3, P4, P5, P6)
  console.log('\n7. Distribution des transactions par référence (P1-P6):');
  const txByRef = await client.query(`
    SELECT
      CASE
        WHEN reference LIKE '%P1%' THEN 'P1'
        WHEN reference LIKE '%P2%' THEN 'P2'
        WHEN reference LIKE '%P3%' THEN 'P3'
        WHEN reference LIKE '%P4%' THEN 'P4'
        WHEN reference LIKE '%P5%' THEN 'P5'
        WHEN reference LIKE '%P6%' THEN 'P6'
        WHEN reference LIKE '%Inscription%' THEN 'INSCRIPT'
        WHEN reference LIKE '%Uniforme%' THEN 'UNIF'
        WHEN reference LIKE '%Tenue%' THEN 'TENUE'
        ELSE 'AUTRE'
      END as ref_type,
      COUNT(*) as tx_count,
      SUM(amount) as total_amount
    FROM finance_transactions
    WHERE "tenantId" = $1 AND "academicYearId" = $2
    GROUP BY ref_type
    ORDER BY total_amount DESC
  `, [tenantId, academicYearId]);
  txByRef.rows.forEach(r => {
    console.log(`   ${r.ref_type}: ${r.tx_count} tx, total = ${r.total_amount} FCFA`);
  });

  await client.end();
  console.log('\n✅ Diagnostic terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
