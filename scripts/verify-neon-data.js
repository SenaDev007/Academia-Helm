/**
 * Quick verification — count rows in key tables
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

(async () => {
  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  // Count rows in each table
  const tables = ['annual_plans', 'monthly_plans', 'chat_conversations', 'chat_messages', 'chat_participants', 'chat_invitations'];
  console.log('📊 Row counts:');
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*)::int AS count FROM "${t}"`);
      console.log(`   - ${t}: ${res.rows[0].count} rows`);
    } catch (e) {
      console.log(`   - ${t}: ERROR (${e.message.substring(0, 80)})`);
    }
  }

  // Check annual_plans for a few classes — see if the new seed data is there
  console.log('\n📋 annual_plans by classLevel:');
  const res = await client.query(`
    SELECT "classLevel", COUNT(*)::int AS count
    FROM "annual_plans"
    GROUP BY "classLevel"
    ORDER BY
      CASE "classLevel"
        WHEN 'MATERNELLE_GRANDS' THEN 0
        WHEN 'CI' THEN 1
        WHEN 'CP' THEN 2
        WHEN 'CE1' THEN 3
        WHEN 'CE2' THEN 4
        WHEN 'CM1' THEN 5
        WHEN 'CM2' THEN 6
      END
  `);
  for (const r of res.rows) {
    console.log(`   - ${r.classLevel}: ${r.count} plans`);
  }

  // Check that "Education pour la santé" sub-domain exists in maternelle data
  // (this confirms the new I-V domain structure is seeded)
  console.log('\n🔍 Check maternelle subDomains for Domaine I:');
  const subRes = await client.query(`
    SELECT DISTINCT "subDomain", COUNT(*)::int AS count
    FROM "annual_plans"
    WHERE "classLevel" = 'MATERNELLE_GRANDS' AND "domain" = 'I'
    GROUP BY "subDomain"
    ORDER BY count DESC
  `);
  for (const r of subRes.rows) {
    console.log(`   - ${r.subDomain}: ${r.count} entries`);
  }

  // Check EPS data for CI (the user complained EPS was empty for CI)
  console.log('\n🔍 Check CI EPS data (was missing in previous seed):');
  const ciRes = await client.query(`
    SELECT "month", "content" FROM "annual_plans"
    WHERE "classLevel" = 'CI' AND "domain" = 'EPS'
    ORDER BY
      CASE "month"
        WHEN 'Septembre' THEN 1 WHEN 'Octobre' THEN 2 WHEN 'Novembre' THEN 3
        WHEN 'Décembre' THEN 4 WHEN 'Janvier' THEN 5 WHEN 'Février' THEN 6
        WHEN 'Mars' THEN 7 WHEN 'Avril' THEN 8 WHEN 'Mai' THEN 9 WHEN 'Juin' THEN 10
      END
  `);
  for (const r of ciRes.rows) {
    console.log(`   - ${r.month}: ${r.content.substring(0, 50)}`);
  }

  await client.end();
})();
