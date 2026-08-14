/**
 * Nettoie les enregistrements de test dans promoter_payment_eligibility
 * ET restaure le vrai mot de passe du promoteur Julien OGBON.
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
const USER_EMAIL = 'cspmonavenirplusndali@gmail.com';
const NEW_PASSWORD = 'FondéMonAvenirJulien2026!';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Delete test records (those created by seed_test_promoter_eligibility.js)
  //    They have the motif starting with "Paiement direct au fondateur — élève ami du promoteur"
  const del = await client.query(`
    DELETE FROM promoter_payment_eligibility
    WHERE tenantid = $1
      AND academicyearid = $2
      AND motif LIKE 'Paiement direct au fondateur — élève ami du promoteur%'
    RETURNING id, studentid
  `, [TENANT_ID, YEAR_ID]);
  console.log(`🗑️  Deleted ${del.rows.length} test records from promoter_payment_eligibility`);

  // Verify remaining
  const remaining = await client.query(`
    SELECT COUNT(*) as c FROM promoter_payment_eligibility
    WHERE tenantid = $1 AND academicyearid = $2 AND isactive = TRUE
  `, [TENANT_ID, YEAR_ID]);
  console.log(`Remaining active records: ${remaining.rows[0].c}`);

  // 2. Restore the real password
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  const r = await client.query(
    `UPDATE users SET "passwordHash" = $1, "updatedAt" = now() WHERE email = $2 RETURNING id, email, "firstName", "lastName"`,
    [hash, USER_EMAIL]
  );
  if (r.rows.length === 0) {
    console.log('❌ User not found');
  } else {
    console.log(`✅ Password restored for: ${r.rows[0].firstName} ${r.rows[0].lastName} (${r.rows[0].email})`);
  }

  await client.end();
}
main().catch(e => console.error(e.message));
