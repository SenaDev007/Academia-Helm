import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const TID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';

// Grades
console.log('=== grades ===');
const g = await c.query(`SELECT COUNT(*)::int n FROM grades WHERE "tenantId"=$1`, [TID]);
console.log(`grades for Mon Avenir: ${g.rows[0].n}`);

// Sample grades
const gs = await c.query(`SELECT id, score, "isAbsent", "createdAt" FROM grades WHERE "tenantId"=$1 LIMIT 3`, [TID]);
console.log(JSON.stringify(gs.rows, null, 2));

// Absences
console.log('\n=== absences ===');
const ab = await c.query(`SELECT COUNT(*)::int n FROM absences WHERE "tenantId"=$1`, [TID]);
console.log(`absences for Mon Avenir: ${ab.rows[0].n}`);

// account_breakdowns (this is where payments live)
console.log('\n=== account_breakdowns ===');
const abr = await c.query(`SELECT COUNT(*)::int n, type, COALESCE(SUM(amount),0)::float total FROM account_breakdowns WHERE "tenantId"=$1 GROUP BY type`, [TID]);
console.log(JSON.stringify(abr.rows, null, 2));

// student_accounts (real amounts)
console.log('\n=== student_accounts ===');
const sa = await c.query(`SELECT COUNT(*)::int n, COALESCE(SUM("totalDue"),0)::float due, COALESCE(SUM("totalPaid"),0)::float paid, COALESCE(SUM("arrearsAmount"),0)::float arr FROM student_accounts WHERE "tenantId"=$1`, [TID]);
console.log(JSON.stringify(sa.rows[0], null, 2));

// fee_arrears
console.log('\n=== fee_arrears ===');
const fa = await c.query(`SELECT COUNT(*)::int n, COALESCE(SUM(amount),0)::float total FROM fee_arrears WHERE "tenantId"=$1`, [TID]);
console.log(JSON.stringify(fa.rows[0], null, 2));

// finance_daily_closures
console.log('\n=== finance_daily_closures columns ===');
const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='finance_daily_closures' ORDER BY ordinal_position`);
console.log(cols.rows.map(x => x.column_name).join(', '));

const fdc = await c.query(`SELECT COUNT(*)::int n FROM finance_daily_closures WHERE "tenantId"=$1`, [TID]);
console.log(`daily_closures: ${fdc.rows[0].n}`);

// Sample row
const fdcRow = await c.query(`SELECT * FROM finance_daily_closures WHERE "tenantId"=$1 LIMIT 1`, [TID]);
console.log('Sample:', JSON.stringify(fdcRow.rows[0], null, 2));

// Evaluations with VALIDATED status for this tenant
console.log('\n=== evaluations for Mon Avenir ===');
const ev = await c.query(`SELECT status, COUNT(*)::int n FROM evaluations WHERE "tenantId"=$1 GROUP BY status`, [TID]);
console.log(JSON.stringify(ev.rows, null, 2));

await c.end();
