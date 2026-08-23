import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
const r = await pool.query(`
  SELECT g.id, g."firstName", g."lastName", g.email, g.phone, g."userId", g."tenantId", t."name" AS "tenantName"
  FROM guardians g
  LEFT JOIN tenants t ON t.id = g."tenantId"
  WHERE g."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  ORDER BY g."lastName" LIMIT 20
`);
console.log('Found', r.rows.length, 'guardians:');
for (const row of r.rows) console.log('  -', row.firstName, row.lastName, '| email:', row.email, '| phone:', row.phone, '| userId:', row.userId || '(null)');
await pool.end();
