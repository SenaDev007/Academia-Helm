/**
 * Vérifie un échantillon d'élèves existants pour comprendre le matching nom.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== 10 premiers élèves (alphabet) ===');
  const res = await client.query(`
    SELECT s.id, s."firstName", s."lastName", s.matricule, s."schoolLevelId",
           c.name as class_name
    FROM students s
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'
    LEFT JOIN classes c ON c.id = se."classId"
    WHERE s."tenantId" = $1
    ORDER BY s."lastName", s."firstName"
    LIMIT 15
  `, [TENANT_ID]);
  res.rows.forEach(r => console.log(`  ${r.id} | ${r.lastName} ${r.firstName} | matr=${r.matricule} | class=${r.class_name}`));

  console.log('\n=== Comptes élèves (échantillon) ===');
  const accts = await client.query(`
    SELECT sa.id, sa."studentId", s."lastName", s."firstName", sa."totalDue", sa."totalPaid", sa.balance
    FROM student_accounts sa
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'
    ORDER BY s."lastName", s."firstName"
    LIMIT 10
  `, [TENANT_ID]);
  accts.rows.forEach(r => console.log(`  ${r.id} | ${r.lastName} ${r.firstName} | due=${r.totalDue} paid=${r.totalPaid} bal=${r.balance}`));

  console.log('\n=== account_breakdowns (échantillon) ===');
  const bd = await client.query(`
    SELECT ab.id, ab."studentAccountId", fs.name, fs."feeType", ab."initialAmount", ab."paidAmount", ab."remainingAmount"
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'
    ORDER BY s."lastName", s."firstName"
    LIMIT 15
  `, [TENANT_ID]);
  bd.rows.forEach(r => console.log(`  ${r.id} | ${r.name} (${r.feeType}) | init=${r.initialAmount} paid=${r.paidAmount} rem=${r.remainingAmount}`));

  console.log('\n=== finance_transactions existantes ===');
  const tx = await client.query(`SELECT COUNT(*) as n FROM finance_transactions WHERE "tenantId" = $1 AND "academicYearId" = '78e862b0-ff11-49dc-9c5f-cc455b402c7b'`, [TENANT_ID]);
  console.log(`  ${tx.rows[0].n} transactions existantes`);

  console.log('\n=== fee_arrears existants ===');
  const fa = await client.query(`SELECT COUNT(*) as n FROM fee_arrears WHERE "tenantId" = $1`, [TENANT_ID]);
  console.log(`  ${fa.rows[0].n} arriérés existants`);

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
