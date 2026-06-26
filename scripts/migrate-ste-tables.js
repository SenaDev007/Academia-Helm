const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});
async function main() {
  const client = await pool.connect();
  console.log('✓ Connexion réussie\n');
  try {
    // 1. timetable_configs
    await client.query(`
      CREATE TABLE IF NOT EXISTS "timetable_configs" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "schoolLevelId" TEXT NOT NULL,
        "academicYearId" TEXT NOT NULL,
        "schoolDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
        "timeBlocks" JSONB NOT NULL DEFAULT '[]',
        "dayStartTime" TEXT NOT NULL DEFAULT '08:00',
        "dayEndTime" TEXT NOT NULL DEFAULT '18:00',
        "defaultSessionDuration" INTEGER NOT NULL DEFAULT 120,
        "lunchBreakStart" TEXT,
        "lunchBreakEnd" TEXT,
        "saturdayEnabled" BOOLEAN NOT NULL DEFAULT false,
        "eveningEnabled" BOOLEAN NOT NULL DEFAULT false,
        "eveningStart" TEXT,
        "eveningEnd" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "timetable_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "timetable_configs_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id"),
        CONSTRAINT "timetable_configs_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
        CONSTRAINT "timetable_configs_tenantId_schoolLevelId_academicYearId_key" UNIQUE ("tenantId", "schoolLevelId", "academicYearId")
      );
      CREATE INDEX IF NOT EXISTS "idx_timetable_configs_tenant" ON "timetable_configs" ("tenantId");
    `);
    console.log('✓ timetable_configs');

    // 2. teacher_availability
    await client.query(`
      CREATE TABLE IF NOT EXISTS "teacher_availability" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "teacherId" TEXT NOT NULL,
        "staffId" TEXT,
        "dayOfWeek" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "teacher_availability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "teacher_availability_tenantId_teacherId_dayOfWeek_startTime_endTime_key" UNIQUE ("tenantId", "teacherId", "dayOfWeek", "startTime", "endTime")
      );
      CREATE INDEX IF NOT EXISTS "idx_teacher_availability_tenant_teacher" ON "teacher_availability" ("tenantId", "teacherId");
      CREATE INDEX IF NOT EXISTS "idx_teacher_availability_tenant_day" ON "teacher_availability" ("tenantId", "dayOfWeek");
    `);
    console.log('✓ teacher_availability');

    // 3. timetable_solutions
    await client.query(`
      CREATE TABLE IF NOT EXISTS "timetable_solutions" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "academicYearId" TEXT NOT NULL,
        "schoolLevelId" TEXT NOT NULL,
        "timetableId" TEXT,
        "score" INTEGER NOT NULL DEFAULT 0,
        "feasibilityScore" INTEGER NOT NULL DEFAULT 0,
        "pedagogyScore" INTEGER NOT NULL DEFAULT 0,
        "comfortScore" INTEGER NOT NULL DEFAULT 0,
        "preferenceScore" INTEGER NOT NULL DEFAULT 0,
        "conflictCount" INTEGER NOT NULL DEFAULT 0,
        "conflicts" JSONB NOT NULL DEFAULT '[]',
        "entries" JSONB NOT NULL DEFAULT '[]',
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "timetable_solutions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "timetable_solutions_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "timetables"("id") ON DELETE SET NULL,
        CONSTRAINT "timetable_solutions_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id"),
        CONSTRAINT "timetable_solutions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
      );
      CREATE INDEX IF NOT EXISTS "idx_timetable_solutions_tenant_year_level" ON "timetable_solutions" ("tenantId", "academicYearId", "schoolLevelId");
      CREATE INDEX IF NOT EXISTS "idx_timetable_solutions_tenant_status" ON "timetable_solutions" ("tenantId", "status");
    `);
    console.log('✓ timetable_solutions');

    // 4. timetable_constraints
    await client.query(`
      CREATE TABLE IF NOT EXISTS "timetable_constraints" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "schoolLevelId" TEXT,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'HARD',
        "entityId" TEXT,
        "entityType" TEXT,
        "params" JSONB NOT NULL DEFAULT '{}',
        "weight" INTEGER NOT NULL DEFAULT 5,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "timetable_constraints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_timetable_constraints_tenant_type_severity" ON "timetable_constraints" ("tenantId", "type", "severity");
    `);
    console.log('✓ timetable_constraints');

    console.log('\n✅ Toutes les tables STE créées');
  } finally { client.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
