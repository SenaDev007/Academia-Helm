import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const TID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const AYID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

// account_breakdowns structure + data
console.log('=== account_breakdowns columns ===');
const cols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='account_breakdowns' ORDER BY ordinal_position`);
console.log(cols.rows.map(x => `${x.column_name} (${x.data_type})`).join(', '));

const ab = await c.query(`SELECT COUNT(*)::int n FROM account_breakdowns WHERE "tenantId"=$1`, [TID]);
console.log(`\naccount_breakdowns for tenant: ${ab.rows[0].n}`);

// sample
const abS = await c.query(`SELECT * FROM account_breakdowns WHERE "tenantId"=$1 LIMIT 2`, [TID]);
console.log('Sample:', JSON.stringify(abS.rows[0], null, 2));

// finance_daily_closures — check columns + revenue
console.log('\n=== finance_daily_closures ===');
const fdcCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='finance_daily_closures'`);
console.log('cols:', fdcCols.rows.map(x => x.column_name).join(', '));
const fdcSample = await c.query(`SELECT * FROM finance_daily_closures WHERE "tenantId"=$1 LIMIT 1`, [TID]);
console.log('Sample:', JSON.stringify(fdcSample.rows[0], null, 2));

// institutional_exams_grades — Module Examen
console.log('\n=== institutional-exams related tables ===');
const igTables = ['institutional_exams_grades', 'institutional_exams_evaluations', 'institutional_exams'];
for (const t of igTables) {
  try {
    const has = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name='tenantId' LIMIT 1`, [t]);
    if (has.rows.length > 0) {
      const cnt = await c.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE "tenantId"=$1`, [TID]);
      console.log(`  ${t}: ${cnt.rows[0].n}`);
    } else {
      const cnt = await c.query(`SELECT COUNT(*)::int n FROM "${t}"`);
      console.log(`  ${t}: ${cnt.rows[0].n} (no tenantId)`);
    }
  } catch (e) { console.log(`  ${t}: not found`); }
}

// Student academic records
console.log('\n=== student_academic_records ===');
const sar = await c.query(`SELECT COUNT(*)::int n, COALESCE(AVG("generalAverage"),0)::float avg FROM student_academic_records WHERE "tenantId"=$1 AND "generalAverage" IS NOT NULL AND "generalAverage" > 0`, [TID]);
console.log(JSON.stringify(sar.rows[0]));

// Evaluations with grades count
console.log('\n=== evaluations + their grades ===');
const evg = await c.query(`
  SELECT e.id, e.title, e.status, COUNT(g.id)::int AS grade_count
  FROM evaluations e
  LEFT JOIN grades g ON g."evaluationId" = e.id AND g."tenantId" = $1
  WHERE e."tenantId" = $1 AND e."academicYearId" = $2
  GROUP BY e.id, e.title, e.status
  ORDER BY grade_count DESC
  LIMIT 10
`, [TID, AYID]);
console.log(JSON.stringify(evg.rows, null, 2));

// All student_enrollments
const se = await c.query(`SELECT COUNT(*)::int n FROM student_enrollments WHERE "tenantId"=$1 AND "academicYearId"=$2`, [TID, AYID]);
console.log(`\nstudent_enrollments (current year): ${se.rows[0].n}`);

// report_cards
const rc = await c.query(`SELECT COUNT(*)::int n, status FROM report_cards WHERE "tenantId"=$1 GROUP BY status`, [TID]);
console.log('report_cards:', JSON.stringify(rc.rows));

await c.end();
