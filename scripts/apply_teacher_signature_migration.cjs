// ⭐ Apply migration 20260820120000_add_teacher_signature_url on Neon prod DB
//    Adds the `signatureUrl` column to the `teachers` table.
//
//    Usage:
//      node /home/z/my-project/scripts/apply_teacher_signature_migration.mjs
//
//    The DATABASE_URL is hardcoded below (provided by the user for prod).

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  });
  await client.connect();
  console.log('✅ Connected to Neon prod DB');

  // ⭐ Apply migration
  const migrationSql = `
    ALTER TABLE "teachers"
      ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
  `;
  await client.query(migrationSql);
  console.log('✅ Migration applied: teachers.signatureUrl column added');

  // Verify
  const result = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'teachers' AND column_name = 'signatureUrl';
  `);
  if (result.rows.length > 0) {
    console.log('✅ Verified: column exists →', result.rows[0]);
  } else {
    console.warn('⚠️  Column signatureUrl not found after migration!');
  }

  await client.end();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  console.error(err);
  process.exit(1);
});
