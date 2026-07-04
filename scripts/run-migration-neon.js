/**
 * Script temporaire : exécute la migration SQL sur la BDD Neon de production.
 * À supprimer après exécution.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const MIGRATION_SQL = `
-- 1. Teacher.assignedLanguages
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "assignedLanguages" JSONB;

-- 2. Staff.assignedLanguages
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "assignedLanguages" JSONB;

-- 3. Table multigrade_assignments
CREATE TABLE IF NOT EXISTS "multigrade_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classIds" JSONB NOT NULL,
  "language" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "multigrade_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "multigrade_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE,
  CONSTRAINT "multigrade_assignments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE,
  CONSTRAINT "multigrade_assignments_tenantId_academicYearId_teacherId_classIds_key" UNIQUE ("tenantId", "academicYearId", "teacherId", "classIds")
);

CREATE INDEX IF NOT EXISTS "multigrade_assignments_tenantId_academicYearId_idx" ON "multigrade_assignments" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "multigrade_assignments_tenantId_teacherId_idx" ON "multigrade_assignments" ("tenantId", "teacherId");

-- 4. Initialise assignedLanguages pour les enregistrements existants
UPDATE "teachers" SET "assignedLanguages" = '["FR","EN"]' WHERE "assignedLanguages" IS NULL;
UPDATE "staff" SET "assignedLanguages" = '["FR","EN"]' WHERE "assignedLanguages" IS NULL AND "roleType" = 'TEACHER';
`;

async function main() {
  console.log('Connexion à la BDD Neon...');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon');

    console.log('Exécution de la migration...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migration SQL exécutée avec succès');

    // Vérification
    const teachersCol = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'teachers' AND column_name = 'assignedLanguages'
    `);
    console.log(`teachers.assignedLanguages: ${teachersCol.rows.length > 0 ? '✅ existe' : '❌ manquant'}`);

    const staffCol = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'staff' AND column_name = 'assignedLanguages'
    `);
    console.log(`staff.assignedLanguages: ${staffCol.rows.length > 0 ? '✅ existe' : '❌ manquant'}`);

    const multigradeTable = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'multigrade_assignments'
    `);
    console.log(`multigrade_assignments: ${multigradeTable.rows.length > 0 ? '✅ existe' : '❌ manquant'}`);

    // Stats
    const teachersUpdated = await client.query(`SELECT COUNT(*) as count FROM "teachers" WHERE "assignedLanguages" IS NOT NULL`);
    console.log(`Teachers avec assignedLanguages: ${teachersUpdated.rows[0].count}`);

    const staffUpdated = await client.query(`SELECT COUNT(*) as count FROM "staff" WHERE "assignedLanguages" IS NOT NULL AND "roleType" = 'TEACHER'`);
    console.log(`Staff TEACHER avec assignedLanguages: ${staffUpdated.rows[0].count}`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
