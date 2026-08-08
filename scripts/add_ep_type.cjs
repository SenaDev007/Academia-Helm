const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // Maternelle level: ea2e2f8a, Primaire level: bc434610
  const levels = [
    { id: 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80', name: 'MATERNELLE' },
    { id: 'bc434610-8cf6-4415-a51a-cc5300cd99da', name: 'PRIMAIRE' },
  ];

  for (const level of levels) {
    // Check if EP already exists
    const existing = await client.query(
      `SELECT id FROM evaluation_types WHERE "tenantId" = $1 AND code = 'EP' AND "schoolLevelId" = $2`,
      [TENANT_ID, level.id]
    );
    if (existing.rows.length > 0) {
      console.log(`  ⏭️  EP already exists for ${level.name}`);
      continue;
    }
    // Insert EP
    await client.query(`
      INSERT INTO evaluation_types (id, "tenantId", name, code, "schoolLevelId", "isSystem", "defaultMaxScore", "defaultCoefficient", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'EP', $3, false, 20, 2, NOW(), NOW())
    `, [TENANT_ID, 'Évaluation de passage', level.id]);
    console.log(`  ✓ Added EP (Évaluation de passage) for ${level.name}`);
  }

  // Verify
  const r = await client.query(`
    SELECT code, name, "schoolLevelId" FROM evaluation_types
    WHERE "tenantId" = $1 AND code IN ('EM1','EM2','EC','EP')
    ORDER BY "schoolLevelId", code
  `, [TENANT_ID]);
  console.log('\nFinal evaluation types:');
  for (const row of r.rows) {
    console.log(`  [${row.code}] ${row.name}`);
  }

  await client.end();
}
main().catch(e => console.error(e.message));
