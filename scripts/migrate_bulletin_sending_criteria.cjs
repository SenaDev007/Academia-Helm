/**
 * Migration SQL — Create bulletin_sending_criteria table
 *
 * Per-tenant configuration for bulletin sending rules:
 *   - blockIfArrears (Boolean, default true)
 *   - minPaymentPercentage (Int, default 100)
 *   - allowDownloadByParents (Boolean, default true)
 *   - requireDirectorSignature (Boolean, default true)
 *   - requireTeacherSignature (Boolean, default true)
 *   - autoSendAfterTeacherSign (Boolean, default false)
 *   - notifyParentOnSend (Boolean, default true)
 *   - reminderDaysBeforeBlock (Int, default 7)
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
    `CREATE TABLE IF NOT EXISTS "bulletin_sending_criteria" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "tenantId" TEXT NOT NULL UNIQUE,
      "blockIfArrears" BOOLEAN NOT NULL DEFAULT true,
      "minPaymentPercentage" INTEGER NOT NULL DEFAULT 100,
      "allowDownloadByParents" BOOLEAN NOT NULL DEFAULT true,
      "requireDirectorSignature" BOOLEAN NOT NULL DEFAULT true,
      "requireTeacherSignature" BOOLEAN NOT NULL DEFAULT true,
      "autoSendAfterTeacherSign" BOOLEAN NOT NULL DEFAULT false,
      "notifyParentOnSend" BOOLEAN NOT NULL DEFAULT true,
      "reminderDaysBeforeBlock" INTEGER NOT NULL DEFAULT 7,
      "customMessage" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT "fk_bulletin_sending_criteria_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "idx_bulletin_sending_criteria_tenant" ON "bulletin_sending_criteria"("tenantId");`,
  ];

  for (const sql of statements) {
    console.log('→', sql.substring(0, 80) + '...');
    await client.query(sql);
  }

  console.log('\n✓ Migration complete — bulletin_sending_criteria table created');
  await client.end();
}

main().catch((e) => {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
});
