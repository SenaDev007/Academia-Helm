/**
 * Migration SQL — Add bulletin annotation columns to report_cards
 * for per-student persistence of:
 *   - assiduite (Text)
 *   - discipline (Text)
 *   - defautsMajeurs (Text)
 *   - qualitesRemarquables (Text)
 *   - analyseRecommandations (Text)
 *   - directorVisa (Text) — already exists but ensure it's there
 */
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('✓ Connected to database');

  const statements = [
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "assiduite" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "discipline" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "defautsMajeurs" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "qualitesRemarquables" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "analyseRecommandations" TEXT;`,
  ];

  for (const sql of statements) {
    console.log('→', sql);
    await client.query(sql);
  }

  console.log('\n✓ Migration complete — 5 annotation columns added to report_cards');
  await client.end();
}

main().catch((e) => {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
});
