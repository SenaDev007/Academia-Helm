// ⭐ Apply migration 20260820140000_add_material_return_tracking on Neon prod DB
//    Adds return-tracking columns to teacher_material_assignments table.

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

  // Check if table exists first
  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'teacher_material_assignments';
  `);

  if (tableCheck.rows.length === 0) {
    console.log('⚠️  Table teacher_material_assignments does not exist yet — running parent migration first');
    // The table is created by an earlier migration: 20260122152420_add_pedagogical_materials
    // Read that migration file and execute it
    const fs = require('fs');
    const parentMigration = fs.readFileSync(
      '/home/z/my-project/apps/api-server/prisma/migrations/20260122152420_add_pedagogical_materials/migration.sql',
      'utf8',
    );
    console.log('→ Running parent migration (20260122152420_add_pedagogical_materials)...');
    await client.query(parentMigration);
    console.log('✅ Parent migration applied');
  } else {
    console.log('✅ Table teacher_material_assignments already exists');
  }

  // Apply return tracking migration
  const migrationSql = `
    ALTER TABLE "teacher_material_assignments"
      ADD COLUMN IF NOT EXISTS "returnQuantity" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "returnCondition" TEXT,
      ADD COLUMN IF NOT EXISTS "returnStatus" TEXT NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "returnNotes" TEXT,
      ADD COLUMN IF NOT EXISTS "returnSignatureUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "returnSentAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "returnValidatedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "returnValidatedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "returnRejectionReason" TEXT,
      ADD COLUMN IF NOT EXISTS "lostQuantity" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lostNotes" TEXT;

    CREATE INDEX IF NOT EXISTS "teacher_material_assignments_return_status_idx"
      ON "teacher_material_assignments" ("returnStatus");

    CREATE INDEX IF NOT EXISTS "teacher_material_assignments_return_pending_idx"
      ON "teacher_material_assignments" ("tenantId", "academicYearId", "returnStatus")
      WHERE "returnStatus" = 'SUBMITTED';
  `;
  await client.query(migrationSql);
  console.log('✅ Migration applied: return-tracking columns + indexes added');

  // Verify
  const result = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'teacher_material_assignments' AND column_name LIKE 'return%'
    ORDER BY column_name;
  `);
  console.log('✅ Return columns verified:');
  for (const row of result.rows) {
    console.log(`   • ${row.column_name} (${row.data_type})`);
  }

  await client.end();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  console.error(err);
  process.exit(1);
});
