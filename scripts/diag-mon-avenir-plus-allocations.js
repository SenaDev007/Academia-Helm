/**
 * Diagnostic approfondi : analyser les allocations de transactions
 * pour comprendre pourquoi le bilan affiche des montants incohérents.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const academicYearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  console.log('=== 1. Compter les transactions avec/sans allocations ===');
  const allocStats = await client.query(`
    SELECT
      COUNT(DISTINCT ft.id) as total_tx,
      COUNT(DISTINCT CASE WHEN fta.id IS NOT NULL THEN ft.id END) as tx_with_alloc,
      COUNT(DISTINCT CASE WHEN fta.id IS NULL THEN ft.id END) as tx_without_alloc
    FROM finance_transactions ft
    LEFT JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
  `, [tenantId, academicYearId]);
  console.log(`  Total transactions: ${allocStats.rows[0].total_tx}`);
  console.log(`  Avec allocations:   ${allocStats.rows[0].tx_with_alloc}`);
  console.log(`  Sans allocations:   ${allocStats.rows[0].tx_without_alloc}`);

  console.log('\n=== 2. Distribution feeType des allocations ===');
  const feeTypeStats = await client.query(`
    SELECT
      fs."feeType",
      COUNT(*) as alloc_count,
      SUM(fta.amount) as total_amount
    FROM finance_transaction_allocations fta
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN finance_transactions ft ON ft.id = fta."financeTransactionId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
    GROUP BY fs."feeType"
    ORDER BY total_amount DESC
  `, [tenantId, academicYearId]);
  feeTypeStats.rows.forEach(r => {
    console.log(`  ${r.feeType || 'NULL'}: ${r.alloc_count} allocations, total = ${r.total_amount} FCFA`);
  });

  console.log('\n=== 3. Analyse complète d\'un élève avec paiement INSCRIPTION > 100000 ===');
  // Trouver l'élève avec le plus haut paiement INSCRIPTION
  const topStudent = await client.query(`
    SELECT s.id, s."firstName", s."lastName", s.matricule,
      SUM(fta.amount) as total_inscription
    FROM finance_transactions ft
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2
      AND fs."feeType" = 'INSCRIPTION'
    GROUP BY s.id, s."firstName", s."lastName", s.matricule
    ORDER BY total_inscription DESC
    LIMIT 1
  `, [tenantId, academicYearId]);
  if (topStudent.rows.length === 0) {
    console.log('  Aucun élève trouvé');
  } else {
    const r = topStudent.rows[0];
    const studentId = r.id;
    console.log(`  Élève: ${r.firstName} ${r.lastName} (${r.matricule}) — Total INSCRIPTION: ${r.total_inscription} FCFA`);

    // Account breakdowns
    console.log('\n  → Account breakdowns:');
    const breakdowns = await client.query(`
      SELECT ab."initialAmount", ab."paidAmount", ab."remainingAmount",
        fs."feeType", fs.name as fs_name, fs."totalAmount" as fs_total
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      JOIN student_accounts sa ON sa.id = ab."studentAccountId"
      WHERE sa."studentId" = $1
      ORDER BY fs."feeType"
    `, [studentId]);
    breakdowns.rows.forEach(b => {
      console.log(`    ${b.feeType} (${b.fs_name}): initial=${b.initialAmount} | paid=${b.paidAmount} | remaining=${b.remainingAmount}`);
    });

    // Transactions + allocations
    console.log('\n  → Transactions + allocations:');
    const txs = await client.query(`
      SELECT
        ft."receiptNumber", ft.amount, ft."createdAt",
        fs."feeType", fs.name as fs_name,
        fta.amount as alloc_amount
      FROM finance_transactions ft
      JOIN student_accounts sa ON sa.id = ft."studentAccountId"
      LEFT JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
      LEFT JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
      LEFT JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE sa."studentId" = $1 AND ft."academicYearId" = $2
      ORDER BY ft."createdAt"
    `, [studentId, academicYearId]);
    txs.rows.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.receiptNumber} | amount=${t.amount} | alloc=${t.alloc_amount || 'NULL'} | feeType=${t.feeType || 'NULL'} (${t.fs_name || 'N/A'})`);
    });
  }

  console.log('\n=== 5. Test du filtre niveau sur les élèves ===');
  // Pour le niveau SECONDAIRE, vérifier combien d'élèves matchent
  const secondaireId = '95fae326-6da3-4a4a-a95c-6f5164dd5024';
  const allEnrollments = await client.query(`
    SELECT se."studentId", se."classId", se."academicClassId",
      c.name as class_name, c."schoolLevelId",
      sl.code as level_code
    FROM student_enrollments se
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE se."tenantId" = $1 AND se."academicYearId" = $2
      AND se.status IN ('ACTIVE', 'ENROLLED', 'PENDING', 'ADMITTED')
  `, [tenantId, academicYearId]);
  console.log(`  Total enrollments: ${allEnrollments.rows.length}`);
  const matchingLevel = allEnrollments.rows.filter(e =>
    e.schoolLevelId === secondaireId || e.level_code === 'SECONDAIRE'
  );
  console.log(`  Match level=SECONDAIRE (via schoolLevelId OU code): ${matchingLevel.length}`);
  const matchingLevelStrict = allEnrollments.rows.filter(e =>
    e.schoolLevelId === secondaireId
  );
  console.log(`  Match level=SECONDAIRE (via schoolLevelId strict): ${matchingLevelStrict.length}`);

  await client.end();
  console.log('\n✅ Diagnostic terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
