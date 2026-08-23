// Apply migration 20260901100000_add_userId_to_guardians directly to Neon
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const MIGRATION_SQL = `
-- Migration: Add userId column to guardians table
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS "guardians_userId_idx" ON "guardians"("userId");

-- Foreign key constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guardians_userId_fkey'
  ) THEN
    ALTER TABLE "guardians"
      ADD CONSTRAINT "guardians_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;
END$$;
`;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Neon...');
    await client.connect();
    console.log('✅ Connected');

    // Check current state
    const before = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'guardians' AND column_name = 'userId'
    `);
    console.log(`Column 'userId' exists before migration: ${before.rows.length > 0}`);

    if (before.rows.length > 0) {
      console.log('ℹ️  Column already exists — migration is idempotent, will proceed anyway');
    }

    // Apply migration
    console.log('Applying migration SQL...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migration applied successfully');

    // Verify
    const after = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'guardians' AND column_name = 'userId'
    `);
    if (after.rows.length > 0) {
      console.log('✅ Verification: userId column now exists:');
      console.log(`   - data_type: ${after.rows[0].data_type}`);
      console.log(`   - is_nullable: ${after.rows[0].is_nullable}`);
    } else {
      console.log('❌ Verification FAILED: userId column not found after migration');
    }

    // Check index
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'guardians' AND indexname = 'guardians_userId_idx'
    `);
    console.log(`Index 'guardians_userId_idx' exists: ${idx.rows.length > 0}`);

    // Check FK constraint
    const fk = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'guardians_userId_fkey'
    `);
    console.log(`FK constraint 'guardians_userId_fkey' exists: ${fk.rows.length > 0}`);

    // Count guardians that already have userId set (should be 0 for fresh migration)
    const count = await client.query(`
      SELECT count(*) AS total,
             count("userId") AS with_user_id
      FROM "guardians"
    `);
    console.log(`Guardians: ${count.rows[0].total} total, ${count.rows[0].with_user_id} with userId set`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
