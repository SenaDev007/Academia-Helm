import pg from 'pg';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const users = await client.query(`
  SELECT email, role, "firstName", "lastName"
  FROM users
  ORDER BY "createdAt" ASC
`);
console.log(`Total users: ${users.rows.length}\n`);
for (const u of users.rows) {
  console.log(`  ${u.email} | role=${u.role} | ${u.firstName} ${u.lastName}`);
}

// Check tenants
const tenants = await client.query(`
  SELECT id, name, slug FROM tenants LIMIT 5
`);
console.log(`\nTenants: ${tenants.rows.length}`);
for (const t of tenants.rows) {
  console.log(`  ${t.name} (slug=${t.slug}, id=${t.id.substring(0,8)})`);
}

await client.end();
