-- ============================================================================
-- Migration V2+ : Bilingue affectation + Multigrade
-- ============================================================================
-- 1. Ajout assignedLanguages (Json) à Teacher et Staff
-- 2. Création table multigrade_assignments
--
-- ⚠️ Cette migration est idempotente (IF NOT EXISTS) — peut être rejouée sans erreur.
-- À exécuter sur la BDD de production via psql ou l'outil de migration Prisma.
-- ============================================================================

-- ─── 1. Teacher.assignedLanguages ──
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "assignedLanguages" JSONB;

-- ─── 2. Staff.assignedLanguages ──
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "assignedLanguages" JSONB;

-- ─── 3. Table multigrade_assignments ──
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

-- ─── 4. Initialise assignedLanguages pour les enregistrements existants ──
-- Par défaut : ["FR","EN"] (bilingue) — l'utilisateur ajustera si besoin.
-- Les nouveaux enregistrements auront cette valeur par défaut côté application.
UPDATE "teachers" SET "assignedLanguages" = '["FR","EN"]' WHERE "assignedLanguages" IS NULL;
UPDATE "staff" SET "assignedLanguages" = '["FR","EN"]' WHERE "assignedLanguages" IS NULL AND "roleType" = 'TEACHER';
