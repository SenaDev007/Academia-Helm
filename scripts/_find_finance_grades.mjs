import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const TID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';

// List ALL tables with row counts
const r = await c.query(`
  SELECT relname AS table, n_live_tup AS rows
  FROM pg_stat_user_tables
  WHERE n_live_tup > 0
  ORDER BY n_live_tup DESC
`);
const filtered = r.rows.filter(x => !x.table.startsWith('pg_') && !x.table.startsWith('schema_'));
console.log('=== Non-empty tables (all tenants) ===');
for (const x of filtered.slice(0, 80)) console.log(`  ${x.table}: ${x.rows}`);

// Cash register transactions
console.log('\n=== cash_registers ===');
const cr = await c.query(`SELECT id, name, "currentBalance" FROM cash_registers WHERE "tenantId"=$1`, [TID]);
console.log(JSON.stringify(cr.rows.slice(0, 5), null, 2));

// finance_daily_closures
console.log('\n=== finance_daily_closures ===');
const fdc = await c.query(`SELECT COUNT(*)::int n, COALESCE(SUM("totalRevenue"),0)::float revenue, COALESCE(SUM("totalExpenses"),0)::float expenses FROM finance_daily_closures WHERE "tenantId"=$1`, [TID]);
console.log(JSON.stringify(fdc.rows[0], null, 2));

// Check for payments in finance_transactions or similar
const ts = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%payment%' OR table_name LIKE '%transaction%' OR table_name LIKE '%receipt%' OR table_name LIKE '%encaiss%' OR table_name LIKE '%caisse%'`);
console.log('\n=== Finance/payment-related tables ===');
for (const t of ts.rows) {
  try {
    const has = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name='tenantId' LIMIT 1`, [t.table_name]);
    if (has.rows.length > 0) {
      const cnt = await c.query(`SELECT COUNT(*)::int n FROM "${t.table_name}" WHERE "tenantId"=$1`, [TID]);
      if (cnt.rows[0].n > 0) console.log(`  ${t.table_name}: ${cnt.rows[0].n}`);
    }
  } catch {}
}

// Absences
console.log('\n=== absences ===');
const ab = await c.query(`SELECT COUNT(*)::int n, type, justified FROM absences WHERE "tenantId"=$1 GROUP BY type, justified`, [TID]);
console.log(JSON.stringify(ab.rows, null, 2));

// Daily logs (attendance)
const dl = await c.query(`SELECT COUNT(*)::int n FROM daily_logs WHERE "tenantId"=$1`, [TID]);
console.log(`daily_logs: ${dl.rows[0].n}`);

// Grades (evaluations)
const ev = await c.query(`SELECT COUNT(*)::int n, status FROM evaluations WHERE "tenantId"=$1 GROUP BY status`, [TID]);
console.log('\n=== evaluations ===');
console.log(JSON.stringify(ev.rows, null, 2));

// Check actual "grades" data via evaluation_grades or similar
const eg = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%grade%' OR table_name LIKE '%note%' OR table_name LIKE '%score%')`);
console.log('\n=== Grade-related tables ===');
for (const t of eg.rows) {
  try {
    const has = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name='tenantId' LIMIT 1`, [t.table_name]);
    if (has.rows.length > 0) {
      const cnt = await c.query(`SELECT COUNT(*)::int n FROM "${t.table_name}" WHERE "tenantId"=$1`, [TID]);
      console.log(`  ${t.table_name}: ${cnt.rows[0].n}`);
    } else {
      const cnt = await c.query(`SELECT COUNT(*)::int n FROM "${t.table_name}"`);
      console.log(`  ${t.table_name}: ${cnt.rows[0].n} (no tenantId col)`);
    }
  } catch {}
}

// institutional_exams_grades — likely where real grades are
console.log('\n=== institutional_exams_grades ===');
const ieg = await c.query(`SELECT COUNT(*)::int n FROM institutional_exams_grades WHERE "tenantId"=$1`, [TID]).catch(() => ({ rows: [{ n: 'table not found' }] }));
console.log(JSON.stringify(ieg.rows[0]));

// Absences detail
console.log('\n=== absences detail ===');
const ab2 = await c.query(`SELECT COUNT(*)::int n FROM absences WHERE "tenantId"=$1 AND "academicYearId"=$2`, [TID, '78e862b0-ff11-49dc-9c5f-cc455b402c7b']);
console.log(`absences (current year): ${ab2.rows[0].n}`);

await c.end();
