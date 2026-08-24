import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const TID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const AYID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

// 1. Gender — check if stored elsewhere
console.log('=== Students with gender ===');
const g = await client.query(`SELECT gender, COUNT(*)::int n FROM students WHERE "tenantId"=$1 GROUP BY gender`, [TID]);
console.log(JSON.stringify(g.rows));

// 2. Payments — check all finance-related tables
console.log('\n=== Finance tables ===');
const tables = ['payments', 'transactions', 'student_fee_payments', 'fee_payments', 'cash_register_transactions', 'finance_transactions'];
for (const t of tables) {
  try {
    const r = await client.query(`SELECT COUNT(*)::int n FROM ${t} WHERE "tenantId"=$1`, [TID]);
    if (r.rows[0].n > 0) console.log(`  ${t}: ${r.rows[0].n} rows`);
  } catch {}
}

// 3. Grades — check all grade-related tables
console.log('\n=== Grade tables ===');
const gTables = ['grades', 'student_grades', 'evaluation_grades', 'grade'];
for (const t of gTables) {
  try {
    const r = await client.query(`SELECT COUNT(*)::int n FROM ${t} WHERE "tenantId"=$1`, [TID]);
    if (r.rows[0].n > 0) console.log(`  ${t}: ${r.rows[0].n} rows`);
  } catch {}
}

// 4. Attendance / absences
console.log('\n=== Attendance tables ===');
const aTables = ['attendance_records', 'absences', 'attendances', 'daily_attendances', 'student_attendances'];
for (const t of aTables) {
  try {
    const r = await client.query(`SELECT COUNT(*)::int n FROM ${t} WHERE "tenantId"=$1`, [TID]);
    if (r.rows[0].n > 0) console.log(`  ${t}: ${r.rows[0].n} rows`);
  } catch {}
}

// 5. Arrears — check student_accounts
console.log('\n=== student_accounts ===');
const sa = await client.query(`SELECT COUNT(*)::int n, COALESCE(SUM("arrearsAmount"),0)::float arr, COALESCE(SUM("totalDue"),0)::float due, COALESCE(SUM("totalPaid"),0)::float paid FROM student_accounts WHERE "tenantId"=$1`, [TID]);
console.log(JSON.stringify(sa.rows[0]));

// 6. Check all tables with tenantId for this tenant
console.log('\n=== All non-empty tables for this tenant ===');
const allTables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);
for (const r of allTables.rows) {
  const t = r.table_name;
  try {
    const has = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name IN ('tenantId','tenant_id') LIMIT 1`, [t]);
    if (has.rows.length > 0) {
      const col = has.rows[0].column_name;
      const cnt = await client.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE "${col}"=$1`, [TID]);
      if (cnt.rows[0].n > 0) console.log(`  ${t}: ${cnt.rows[0].n}`);
    }
  } catch {}
}

await client.end();
