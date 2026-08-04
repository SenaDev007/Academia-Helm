const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1. evaluations columns
  const cols = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'evaluations' ORDER BY ordinal_position
  `);
  console.log('evaluations columns:', cols.rows.map(c => c.column_name).join(', '));

  // 2. Tester avec le 1er evaluationId
  const r = await db.query('SELECT "evaluationId" FROM exam_unlock_requests LIMIT 1');
  const evalId = r.rows[0].evaluationId;
  console.log('\nLooking for evaluation:', evalId);

  const evalRows = await db.query('SELECT * FROM evaluations WHERE id = $1', [evalId]);
  console.log('Found:', evalRows.rows.length > 0);
  if (evalRows.rows.length > 0) {
    console.log('Sample:', JSON.stringify(evalRows.rows[0], null, 2));
  }

  // 3. Test the corrected query (simplified, no LATERAL)
  console.log('\n═══ Test corrected query (simple JOIN) ═══');
  const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const result = await db.query(`
    SELECT r.id, r.status, r.reason, r."createdAt",
           r."evaluationId",
           u."firstName" as "requesterFirstName", u."lastName" as "requesterLastName",
           ru."firstName" as "reviewerFirstName", ru."lastName" as "reviewerLastName",
           r."reviewComment", r."reviewedAt"
    FROM exam_unlock_requests r
    LEFT JOIN users u ON u.id = r."requestedById"
    LEFT JOIN users ru ON ru.id = r."reviewedById"
    WHERE r."tenantId" = $1
    ORDER BY r."createdAt" DESC
    LIMIT 5
  `, [tenantId]);
  console.log('Result:', result.rows.length, 'rows');
  result.rows.forEach(r => {
    console.log(`  ${r.status} | ${r.requesterFirstName} ${r.requesterLastName} | ${r.reason?.substring(0, 40)}`);
  });

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
