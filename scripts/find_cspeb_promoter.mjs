import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[A] Looking for CSPEB (59b8c348) promoter/director users:');
const users = await client.query(`
  SELECT u.id, u.email, u.role, u."firstName", u."lastName", u.status
  FROM users u
  WHERE u."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND u.role IN ('PROMOTER', 'DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN')
  ORDER BY u.role, u."lastName"
`);
for (const u of users.rows) {
  console.log(`  • ${u.lastName||''} ${u.firstName||''} — ${u.email} (role=${u.role} status=${u.status})`);
}

console.log('\n[B] Looking for tenant name:');
const tenant = await client.query(`SELECT name FROM tenants WHERE id = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'`);
console.log(`  • ${tenant.rows[0]?.name}`);

await client.end();
