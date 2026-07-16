/**
 * Vérifie les fee_structures par niveau/classe pour comprendre le mapping.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Lister toutes les fee_structures avec leur level
  console.log('=== Toutes les fee_structures ===');
  const fs = await client.query(`
    SELECT fs.id, fs.name, fs."feeType", fs."totalAmount", fs."levelId", fs."academicClassId",
           sl.name as level_name, ac.name as class_name
    FROM fee_structures fs
    LEFT JOIN school_levels sl ON sl.id = fs."levelId"
    LEFT JOIN pedagogy_academic_classes ac ON ac.id = fs."academicClassId"
    WHERE fs."tenantId" = $1 AND fs."academicYearId" = $2
    ORDER BY sl.name, fs."feeType"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  fs.rows.forEach(r => console.log(`  ${r.id} | ${r.level_name || '—'} | ${r.class_name || '—'} | ${r.feeType} | ${r.totalAmount}`));

  // Pour chaque breakdown, vérifier le feeType et le total
  console.log('\n=== Répartition des breakdowns par feeType ===');
  const bd = await client.query(`
    SELECT fs."feeType", fs."totalAmount", COUNT(*) as n, sl.name as level_name
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    LEFT JOIN school_levels sl ON sl.id = fs."levelId"
    WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
    GROUP BY fs."feeType", fs."totalAmount", sl.name
    ORDER BY sl.name, fs."feeType"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  bd.rows.forEach(r => console.log(`  ${r.level_name || '—'} | ${r.feeType} | ${r.totalAmount} | ${r.n} breakdowns`));

  // Vérifier les columns de finance_transactions
  console.log('\n=== Structure table finance_transactions ===');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'finance_transactions'
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable=${r.is_nullable}`));

  // Vérifier les columns de fee_arrears
  console.log('\n=== Structure table fee_arrears ===');
  const faCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'fee_arrears'
    ORDER BY ordinal_position
  `);
  faCols.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable=${r.is_nullable}`));

  // Vérifier les triggers sur finance_transactions
  console.log('\n=== Triggers sur finance_transactions ===');
  const trg = await client.query(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'finance_transactions'
  `);
  trg.rows.forEach(r => console.log(`  ${r.trigger_name} | ${r.event_manipulation} | ${r.action_timing}`));

  // Vérifier les triggers sur student_accounts
  console.log('\n=== Triggers sur student_accounts ===');
  const trg2 = await client.query(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'student_accounts'
  `);
  trg2.rows.forEach(r => console.log(`  ${r.trigger_name} | ${r.event_manipulation} | ${r.action_timing}`));

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
