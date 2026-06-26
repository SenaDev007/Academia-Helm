const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});
async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tenant_website_level_sections" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT NOT NULL,
        "schoolLevelId" TEXT NOT NULL,
        "directorWord" TEXT,
        "directorName" TEXT,
        "directorPhotoUrl" TEXT,
        "directorIsActive" BOOLEAN,
        "presentationTitle" TEXT,
        "presentationContent" TEXT,
        "presentationIsActive" BOOLEAN,
        "admissionsTitle" TEXT,
        "admissionsContent" TEXT,
        "admissionsIsActive" BOOLEAN,
        "schoolLifeTitle" TEXT,
        "schoolLifeContent" TEXT,
        "schoolLifeIsActive" BOOLEAN,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tenant_website_level_sections_websiteId_fkey"
          FOREIGN KEY ("websiteId") REFERENCES "tenant_websites"("id") ON DELETE CASCADE,
        CONSTRAINT "tenant_website_level_sections_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "tenant_website_level_sections_schoolLevelId_fkey"
          FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE CASCADE,
        CONSTRAINT "tenant_website_level_sections_tenantId_schoolLevelId_key"
          UNIQUE ("tenantId", "schoolLevelId")
      );
      CREATE INDEX IF NOT EXISTS "idx_tenant_website_level_sections_tenant_level"
        ON "tenant_website_level_sections" ("tenantId", "schoolLevelId");
    `);
    console.log('✓ Table tenant_website_level_sections créée');
  } finally { client.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
