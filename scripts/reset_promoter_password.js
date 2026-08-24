/**
 * Réinitialise le mot de passe du promoteur Mon Avenir Plus pour test agent-browser
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const NEW_PASSWORD = 'Academia@2026';
const USER_EMAIL = 'cspmonavenirplusndali@gmail.com';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  console.log('New hash:', hash.substring(0, 30) + '...');

  const r = await client.query(
    `UPDATE users SET "passwordHash" = $1, "updatedAt" = now() WHERE email = $2 RETURNING id, email, "firstName", "lastName"`,
    [hash, USER_EMAIL]
  );

  if (r.rows.length === 0) {
    console.log('❌ User not found');
  } else {
    console.log('✅ Password reset for:', r.rows[0]);
    console.log('   New password:', NEW_PASSWORD);
  }

  await client.end();
}
main().catch(e => console.error(e.message));
