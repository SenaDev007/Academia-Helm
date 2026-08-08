const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const result = await db.query(`
    SELECT r.id, r."evaluationId", r.reason, r.status, r."createdAt",
           r."reviewedAt", r."reviewComment",
           u."firstName" as "requesterFirstName", u."lastName" as "requesterLastName",
           ru."firstName" as "reviewerFirstName", ru."lastName" as "reviewerLastName",
           et.name as "evaluationTypeName",
           c.name as "className",
           subj.name as "subjectName"
    FROM exam_unlock_requests r
    LEFT JOIN users u ON u.id = r."requestedById"
    LEFT JOIN users ru ON ru.id = r."reviewedById"
    LEFT JOIN evaluations e ON e.id = r."evaluationId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    LEFT JOIN classes c ON c.id = e."classId"
    LEFT JOIN subjects subj ON subj.id = e."subjectId"
    WHERE r."tenantId" = $1 AND r.status = 'PENDING'
    ORDER BY r."createdAt" DESC
    LIMIT 5
  `, [tenantId]);

  console.log('✅ Query works! Found', result.rows.length, 'pending requests:');
  result.rows.forEach(r => {
    console.log(`  - ${r.requesterFirstName} ${r.requesterLastName} | ${r.evaluationTypeName} | ${r.className} | ${r.subjectName} | ${r.reason.substring(0, 40)}`);
  });

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
