const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Find the CSPEB promoter
  const res = await client.query(`
    SELECT id, email, role, "firstName", "lastName"
    FROM users
    WHERE "role" IN ('PROMOTEUR', 'PROMOTER')
    AND "email" ILIKE '%salumer%'
    LIMIT 5
  `);

  if (res.rows.length === 0) {
    console.log('No promoter found with email containing "salumer". Trying broader search...');
    const res2 = await client.query(`
      SELECT id, email, role, "firstName", "lastName"
      FROM users
      WHERE "role" IN ('PROMOTEUR', 'PROMOTER')
      LIMIT 10
    `);
    console.log('All promoters:');
    res2.rows.forEach(r => console.log(`  ${r.email} (${r.role}) - ${r.firstName} ${r.lastName} (${r.id})`));
    await client.end();
    return;
  }

  // 2. Reset the password
  const newHash = await bcrypt.hash('CSPEB.fondé2021', 10);
  for (const user of res.rows) {
    console.log(`Resetting password for: ${user.email} (${user.role}) — ${user.firstName} ${user.lastName}`);
    await client.query(
      `UPDATE users SET "passwordHash" = $1 WHERE id = $2`,
      [newHash, user.id]
    );
    console.log(`  ✅ Password updated to: CSPEB.fondé2021`);
  }

  await client.end();
  console.log('\nDone! The promoter can now login with:');
  console.log('  Email: ' + res.rows[0].email);
  console.log('  Password: CSPEB.fondé2021');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
