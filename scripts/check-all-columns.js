/**
 * Identifie TOUTES les colonnes manquantes dans la base Neon.
 * Compare le schéma Prisma avec les colonnes réelles en DB.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Tables critiques pour le module Finance
  const tables = [
    'finance_transactions',
    'finance_transaction_allocations',
    'student_accounts',
    'account_breakdowns',
    'fee_structures',
    'fee_overrides',
    'cash_registers',
    'finance_expenses',
    'fee_arrears',
    'payment_allocations',
    'student_enrollments',
    'students',
    'cash_register_transfers',
    'cash_register_transactions',
  ];

  for (const table of tables) {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    if (res.rows.length === 0) {
      console.log(`\n❌ TABLE MANQUANTE: ${table}`);
    } else {
      console.log(`\n✅ ${table} (${res.rows.length} colonnes):`);
      res.rows.forEach(r => console.log(`   ${r.column_name} | ${r.data_type} | nullable=${r.is_nullable}`));
    }
  }

  // Vérifier spécifiquement les colonnes que le backend tente d'utiliser
  console.log('\n=== Vérifications spécifiques ===');

  // cash_registers - vérifier toutes les colonnes utilisées par cash-register.service.ts
  const cr = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cash_registers'`);
  const crCols = new Set(cr.rows.map(r => r.column_name));
  const expectedCr = ['id', 'tenantId', 'code', 'name', 'description', 'openingBalance', 'currentBalance', 'isActive', 'isOpen', 'openedAt', 'openedByUserId', 'closedAt', 'closedByUserId', 'responsibleUserId', 'type', 'schoolLevelId', 'bankName', 'bankAccountNumber', 'bankIBAN', 'bankBranch', 'bankAccountType', 'bankContact', 'createdAt', 'updatedAt'];
  const missingCr = expectedCr.filter(c => !crCols.has(c));
  console.log(`cash_registers manquantes: ${missingCr.length > 0 ? missingCr.join(', ') : 'AUCUNE'}`);

  // finance_expenses
  const fe = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'finance_expenses'`);
  const feCols = new Set(fe.rows.map(r => r.column_name));
  const expectedFe = ['id', 'tenantId', 'academicYearId', 'category', 'description', 'amount', 'expenseDate', 'paymentMethod', 'status', 'requestedById', 'approvedById', 'rejectedById', 'cashRegisterId', 'pendingApproverId', 'receiptUrl', 'notes', 'createdAt', 'updatedAt'];
  const missingFe = expectedFe.filter(c => !feCols.has(c));
  console.log(`finance_expenses manquantes: ${missingFe.length > 0 ? missingFe.join(', ') : 'AUCUNE'}`);

  // finance_transactions
  const ft = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'finance_transactions'`);
  const ftCols = new Set(ft.rows.map(r => r.column_name));
  const expectedFt = ['id', 'tenantId', 'academicYearId', 'studentAccountId', 'type', 'amount', 'paymentMethod', 'reference', 'reversedFromId', 'cashierId', 'deviceId', 'receiptNumber', 'receiptUrl', 'createdAt', 'cashRegisterId', 'integrityHash', 'tendered_amount', 'change_given'];
  const missingFt = expectedFt.filter(c => !ftCols.has(c));
  console.log(`finance_transactions manquantes: ${missingFt.length > 0 ? missingFt.join(', ') : 'AUCUNE'}`);

  // account_breakdowns
  const ab = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'account_breakdowns'`);
  const abCols = new Set(ab.rows.map(r => r.column_name));
  const expectedAb = ['id', 'studentAccountId', 'feeStructureId', 'initialAmount', 'adjustedAmount', 'paidAmount', 'remainingAmount', 'createdAt'];
  const missingAb = expectedAb.filter(c => !abCols.has(c));
  console.log(`account_breakdowns manquantes: ${missingAb.length > 0 ? missingAb.join(', ') : 'AUCUNE'}`);

  // fee_structures
  const fs = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'fee_structures'`);
  const fsCols = new Set(fs.rows.map(r => r.column_name));
  const expectedFs = ['id', 'tenantId', 'academicYearId', 'name', 'feeType', 'totalAmount', 'isInstallment', 'isMandatory', 'levelId', 'classId', 'academicClassId', 'customFeeTypeLabel', 'createdAt', 'updatedAt'];
  const missingFs = expectedFs.filter(c => !fsCols.has(c));
  console.log(`fee_structures manquantes: ${missingFs.length > 0 ? missingFs.join(', ') : 'AUCUNE'}`);

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
