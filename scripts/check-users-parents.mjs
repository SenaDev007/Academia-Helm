import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
const r = await pool.query(`
  SELECT u.id, u."firstName", u."lastName", u.email, u.role, u."tenantId"
  FROM users u
  WHERE u."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND (u.role ILIKE '%parent%' OR u.role ILIKE '%guardian%')
  ORDER BY u."lastName" LIMIT 20
`);
console.log('Found', r.rows.length, 'users with parent/guardian role:');
for (const row of r.rows) console.log('  -', row.firstName, row.lastName, '| email:', row.email, '| role:', row.role);
await pool.end();
