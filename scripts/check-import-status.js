/**
 * Vérifie l'état de l'import (combien de transactions/arrears ont été créées).
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tx = await client.query(`SELECT COUNT(*) as n FROM finance_transactions WHERE "tenantId" = $1 AND "academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Transactions: ${tx.rows[0].n}`);

  const txImp = await client.query(`SELECT COUNT(*) as n FROM finance_transactions WHERE "tenantId" = $1 AND "academicYearId" = $2 AND reference LIKE 'Import Excel%'`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Transactions Import Excel: ${txImp.rows[0].n}`);

  const fa = await client.query(`SELECT COUNT(*) as n FROM fee_arrears WHERE "tenantId" = $1 AND "academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Arriérés: ${fa.rows[0].n}`);

  const faImp = await client.query(`SELECT COUNT(*) as n FROM fee_arrears WHERE "tenantId" = $1 AND notes LIKE '%Import Excel%'`, [TENANT_ID]);
  console.log(`Arriérés Import Excel: ${faImp.rows[0].n}`);

  const fs = await client.query(`SELECT COUNT(*) as n FROM fee_structures WHERE "tenantId" = $1 AND "academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Fee structures: ${fs.rows[0].n}`);

  const bd = await client.query(`SELECT COUNT(*) as n FROM account_breakdowns ab JOIN student_accounts sa ON sa.id = ab."studentAccountId" WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`Account breakdowns: ${bd.rows[0].n}`);

  // Vérifier quelques comptes
  console.log('\n=== Échantillon comptes mis à jour ===');
  const sample = await client.query(`
    SELECT s."lastName", s."firstName", sa."totalDue", sa."totalPaid", sa.balance
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2 AND sa."totalPaid" > 0
    ORDER BY s."lastName"
    LIMIT 10
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  sample.rows.forEach(r => console.log(`  ${r.lastName} ${r.firstName} | due=${r.totalDue} paid=${r.totalPaid} bal=${r.balance}`));

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
