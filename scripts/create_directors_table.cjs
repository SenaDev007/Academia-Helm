const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "school_directors" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "schoolLevelId" TEXT NOT NULL,
      "language" TEXT DEFAULT 'FR',
      "fullName" TEXT NOT NULL,
      "functionLabel" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "signatureDataUrl" TEXT,
      "signatureUploadedUrl" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "school_directors_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('✓ Table school_directors created');

  await client.query(`CREATE INDEX IF NOT EXISTS "school_directors_tenantId_idx" ON "school_directors"("tenantId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "school_directors_schoolLevelId_idx" ON "school_directors"("schoolLevelId")`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "school_directors_tenant_schoolLevel_language_key" ON "school_directors"("tenantId", "schoolLevelId", "language")`);

  console.log('✓ Indexes created');
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
