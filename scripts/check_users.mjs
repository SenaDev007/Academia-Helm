import pg from 'pg';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// List users with their emails and roles
const users = await client.query(`
  SELECT email, role, "firstName", "lastName", "tenantId"
  FROM users
  WHERE email LIKE '%cspeb%' OR email LIKE '%promoteur%' OR email LIKE '%enseignant%'
  ORDER BY email
  LIMIT 20
`);
console.log('Users found:');
for (const u of users.rows) {
  console.log(`  ${u.email} | role=${u.role} | ${u.firstName} ${u.lastName} | tenant=${u.tenantId?.substring(0,8)}`);
}

// Also check total user count
const count = await client.query('SELECT COUNT(*)::int as total FROM users');
console.log(`\nTotal users in DB: ${count.rows[0].total}`);

await client.end();
