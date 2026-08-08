/**
 * Migration SQL — Bulletin workflow fields on report_cards
 *
 * Workflow states:
 *   DRAFT → DIRECTOR_SIGNED → TEACHER_DISTRIBUTED → TEACHER_SIGNED → PARENT_SENT
 *
 * New columns:
 *   - directorSignature (Text, nullable) : base64 signature data
 *   - directorSignedAt (Timestamp, nullable)
 *   - directorSignedBy (Text, nullable) : userId of director
 *   - teacherSignature (Text, nullable) : base64 signature data
 *   - teacherSignedAt (Timestamp, nullable)
 *   - teacherSignedBy (Text, nullable) : userId of teacher
 *   - distributedToTeacherAt (Timestamp, nullable)
 *   - distributedToTeacherBy (Text, nullable)
 *   - sentToParentAt (Timestamp, nullable)
 *   - sentToParentBy (Text, nullable)
 *   - parentReceivedAt (Timestamp, nullable)
 *   - blockedReason (Text, nullable) : e.g. "ARREARS_UNPAID"
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
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "directorSignature" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "directorSignedAt" TIMESTAMP;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "directorSignedBy" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "teacherSignature" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "teacherSignedAt" TIMESTAMP;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "teacherSignedBy" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "distributedToTeacherAt" TIMESTAMP;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "distributedToTeacherBy" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "sentToParentAt" TIMESTAMP;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "sentToParentBy" TEXT;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "parentReceivedAt" TIMESTAMP;`,
    `ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;`,
  ];

  for (const sql of statements) {
    console.log('→', sql);
    await client.query(sql);
  }

  console.log('\n✓ Migration complete — 12 workflow columns added to report_cards');
  await client.end();
}

main().catch((e) => {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
});
