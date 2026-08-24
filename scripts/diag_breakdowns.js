/**
 * Diagnostic : pour chaque type de mismatch, examiner la structure des breakdowns
 */
const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // BARANON — Excel totalPay=55000, DB totalDue=58000, balance=-52000, totalPaid=110000
  // Hypothèse : DB a 2 breakdowns (INSCRIPTION 5000 + TUITION 53000=50000+3000???)
  const r = await client.query(`
    SELECT s.id, s."lastName", s."firstName",
           sa."totalDue", sa."totalPaid", sa."balance",
           ab.id as "bdId", ab."initialAmount", ab."paidAmount", ab."remainingAmount",
           fs."feeType", fs."totalAmount" as "fsAmount", fs."customFeeTypeLabel"
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    LEFT JOIN account_breakdowns ab ON ab."studentAccountId" = sa.id
    LEFT JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    WHERE s."tenantId" = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'
      AND sa."academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'
      AND s."lastName" ILIKE 'BARANON%'
    ORDER BY s."lastName", fs."feeType"
  `);
  console.log('=== BARANON M Kadidjatou ===');
  r.rows.forEach(x => console.log(JSON.stringify(x)));

  // Compter les étudiants par type de pattern
  // Pattern 1: totalDue=X, totalPaid=2X (paid twice as much as expected)
  const r2 = await client.query(`
    SELECT s."lastName", s."firstName",
           sa."totalDue", sa."totalPaid", sa."balance",
           ROUND(sa."totalPaid"::numeric / NULLIF(sa."totalDue", 0), 2) as ratio
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    WHERE s."tenantId" = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'
      AND sa."academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'
      AND sa."totalDue" > 0
    ORDER BY ratio DESC
    LIMIT 10
  `);
  console.log('\n=== Top 10 étudiants avec ratio totalPaid/totalDue le plus élevé ===');
  r2.rows.forEach(x => console.log(`  ${x.lastName} ${x.firstName}: due=${x.totalDue} paid=${x.totalPaid} balance=${x.balance} ratio=${x.ratio}`));

  // Check transaction count per account
  const r3 = await client.query(`
    SELECT s."lastName", s."firstName", COUNT(ft.id) as tx_count, SUM(ft.amount) as sum_amount
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    LEFT JOIN finance_transactions ft ON ft."studentAccountId" = sa.id
    WHERE s."tenantId" = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'
      AND sa."academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'
      AND s."lastName" ILIKE 'BARANON%'
    GROUP BY s."lastName", s."firstName"
    ORDER BY s."lastName"
  `);
  console.log('\n=== BARANON transactions ===');
  r3.rows.forEach(x => console.log(`  ${x.lastName} ${x.firstName}: ${x.tx_count} tx, total = ${x.sum_amount}`));

  await client.end();
}
main().catch(e => console.error(e.message));
