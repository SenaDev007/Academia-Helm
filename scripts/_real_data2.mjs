import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const TID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const AYID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

// account_breakdowns via student_accounts join
console.log('=== account_breakdowns (via join) ===');
const ab = await c.query(`
  SELECT COUNT(*)::int n,
    COALESCE(SUM(ab."initialAmount"),0)::float initial,
    COALESCE(SUM(ab."paidAmount"),0)::float paid,
    COALESCE(SUM(ab."remainingAmount"),0)::float remaining
  FROM account_breakdowns ab
  JOIN student_accounts sa ON sa.id = ab."studentAccountId"
  WHERE sa."tenantId"=$1
`, [TID]);
console.log(JSON.stringify(ab.rows[0], null, 2));

// finance_daily_closures — columns
console.log('\n=== finance_daily_closures sample ===');
const fdc = await c.query(`SELECT * FROM finance_daily_closures WHERE "tenantId"=$1 LIMIT 1`, [TID]);
if (fdc.rows[0]) {
  console.log('cols:', Object.keys(fdc.rows[0]).join(', '));
  console.log(JSON.stringify(fdc.rows[0], null, 2));
} else {
  console.log('No rows');
}

// finance_daily_closures sums
console.log('\n=== finance_daily_closures sums ===');
const fdcCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='finance_daily_closures' AND column_name LIKE '%mount%' OR column_name LIKE '%revenue%' OR column_name LIKE '%total%'`);
console.log('Amount cols:', fdcCols.rows.map(x => x.column_name).join(', '));

// evaluations with grades for Mon Avenir
console.log('\n=== evaluations + grades ===');
const evg = await c.query(`
  SELECT e.id, e.title, e.status, COUNT(g.id)::int AS grade_count,
    COALESCE(AVG(g.score),0)::float avg_score
  FROM evaluations e
  LEFT JOIN grades g ON g."evaluationId" = e.id
  WHERE e."tenantId" = $1 AND e."academicYearId" = $2
  GROUP BY e.id, e.title, e.status
  ORDER BY grade_count DESC
  LIMIT 5
`, [TID, AYID]);
console.log(JSON.stringify(evg.rows, null, 2));

// Grades for this tenant via join with evaluations
console.log('\n=== grades via evaluation join ===');
const gr = await c.query(`
  SELECT COUNT(*)::int n, COALESCE(AVG(g.score),0)::float avg
  FROM grades g
  JOIN evaluations e ON e.id = g."evaluationId"
  WHERE e."tenantId"=$1 AND e."academicYearId"=$2 AND g."isAbsent"=false AND g.score IS NOT NULL
`, [TID, AYID]);
console.log(JSON.stringify(gr.rows[0], null, 2));

// report_cards
console.log('\n=== report_cards ===');
const rc = await c.query(`SELECT COUNT(*)::int n, status FROM report_cards WHERE "tenantId"=$1 GROUP BY status`, [TID]);
console.log(JSON.stringify(rc.rows));

// absences via student join
console.log('\n=== absences via student ===');
const ab2 = await c.query(`
  SELECT COUNT(*)::int n
  FROM absences a JOIN students s ON s.id = a."studentId"
  WHERE s."tenantId"=$1
`, [TID]);
console.log(JSON.stringify(ab2.rows[0]));

await c.end();
