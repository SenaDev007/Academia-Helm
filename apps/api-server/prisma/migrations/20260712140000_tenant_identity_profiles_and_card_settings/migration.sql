-- ============================================================================
-- 20260712140000_tenant_identity_profiles_and_card_settings
-- ============================================================================
-- Crée la table tenant_identity_profiles (si absente) + ajoute les colonnes
-- de paramétrage des cartes scolaires, heures maternelle, et admissions publiques.
-- Also adds academicClassId on student_enrollments, requestedAcademicClassId on
-- admissions, transferType/fromSeriesId/toSeriesId on class_transfers, and
-- admission settings on academic_years.
-- Toutes les opérations sont idempotentes (IF NOT EXISTS).
-- ============================================================================

-- ─── 1. Table tenant_identity_profiles ───
CREATE TABLE IF NOT EXISTS "tenant_identity_profiles" (
  "id"                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"                TEXT NOT NULL,
  "version"                 INTEGER NOT NULL DEFAULT 1,
  "isActive"                BOOLEAN NOT NULL DEFAULT false,
  "schoolName"              TEXT NOT NULL,
  "schoolAcronym"           TEXT,
  "schoolType"              TEXT NOT NULL DEFAULT 'PRIVEE',
  "authorizationNumber"     TEXT,
  "foundationDate"          TIMESTAMP(3),
  "slogan"                  TEXT,
  "address"                 TEXT,
  "city"                    TEXT,
  "department"              TEXT,
  "country"                 TEXT NOT NULL DEFAULT 'BJ',
  "postalCode"              TEXT,
  "phonePrimary"            TEXT,
  "phoneSecondary"          TEXT,
  "whatsapp"                TEXT,
  "email"                   TEXT,
  "website"                 TEXT,
  "currency"                TEXT NOT NULL DEFAULT 'XOF',
  "timezone"                TEXT NOT NULL DEFAULT 'Africa/Porto-Novo',
  "logoUrl"                 TEXT,
  "stampUrl"                TEXT,
  "directorSignatureUrl"    TEXT,
  "createdBy"               TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt"             TIMESTAMP(3),
  "activatedBy"             TEXT,
  "deactivatedAt"           TIMESTAMP(3),
  "deactivatedBy"           TEXT,
  "changeReason"            TEXT,

  -- Paramètres cartes scolaires (migration 011)
  "maternellePickupMorning"    TEXT DEFAULT '12:00',
  "maternellePickupAfternoon"  TEXT DEFAULT '16:30',
  "cardPrimaryColor"           TEXT DEFAULT '#003087',
  "cardSecondaryColor"         TEXT DEFAULT '#007BFF',
  "cardShowQRCode"             BOOLEAN DEFAULT true,
  "cardShowBarcode"            BOOLEAN DEFAULT true,
  "cardShowPhoto"              BOOLEAN DEFAULT true,
  "cardShowGuardian"           BOOLEAN DEFAULT true,
  "cardShowEmergencyCall"      BOOLEAN DEFAULT true,
  "cardShowSchoolAddress"      BOOLEAN DEFAULT true,
  "cardFooterText"             TEXT DEFAULT 'Academia Helm',
  "cardConditionsText"         TEXT,

  -- Sortie unique maternelle (migration 012)
  "maternelleSingleExit"       BOOLEAN DEFAULT false,
  "maternelleSingleExitTime"   TEXT DEFAULT '15:30'
);

-- FK tenant_identity_profiles → tenants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_identity_profiles_tenantId_fkey') THEN
    ALTER TABLE "tenant_identity_profiles"
      ADD CONSTRAINT "tenant_identity_profiles_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK tenant_identity_profiles: %', SQLERRM;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_identity_profiles_tenantId_version_key"
  ON "tenant_identity_profiles" ("tenantId", "version");
CREATE INDEX IF NOT EXISTS "tenant_identity_profiles_tenantId_isActive_idx"
  ON "tenant_identity_profiles" ("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "tenant_identity_profiles_tenantId_version_idx"
  ON "tenant_identity_profiles" ("tenantId", "version");

-- ─── 2. admissions.requestedAcademicClassId (migration 013) ───
ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "requestedAcademicClassId" TEXT;
CREATE INDEX IF NOT EXISTS "admissions_requestedAcademicClassId_idx"
  ON "admissions" ("requestedAcademicClassId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admissions_requestedAcademicClassId_fkey') THEN
    ALTER TABLE "admissions"
      ADD CONSTRAINT "admissions_requestedAcademicClassId_fkey"
      FOREIGN KEY ("requestedAcademicClassId") REFERENCES "pedagogy_academic_classes" ("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK admissions.requestedAcademicClassId: %', SQLERRM;
END $$;

-- ─── 3. student_enrollments.academicClassId (migration 013) ───
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "academicClassId" TEXT;
CREATE INDEX IF NOT EXISTS "student_enrollments_academicClassId_idx"
  ON "student_enrollments" ("academicClassId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_academicClassId_fkey') THEN
    ALTER TABLE "student_enrollments"
      ADD CONSTRAINT "student_enrollments_academicClassId_fkey"
      FOREIGN KEY ("academicClassId") REFERENCES "pedagogy_academic_classes" ("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK student_enrollments.academicClassId: %', SQLERRM;
END $$;

-- ─── 4. class_transfers : transferType + fromSeriesId + toSeriesId + nullables (migration 013) ───
ALTER TABLE "class_transfers" ALTER COLUMN "fromClassId" DROP NOT NULL;
ALTER TABLE "class_transfers" ALTER COLUMN "toClassId" DROP NOT NULL;
ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "transferType" TEXT NOT NULL DEFAULT 'CLASS_CHANGE';
ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "fromSeriesId" TEXT;
ALTER TABLE "class_transfers" ADD COLUMN IF NOT EXISTS "toSeriesId" TEXT;
CREATE INDEX IF NOT EXISTS "class_transfers_transferType_idx"
  ON "class_transfers" ("transferType");

-- ─── 5. academic_years : admission settings (migration 014) ───
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionOpenDate" TIMESTAMP(3);
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionCloseDate" TIMESTAMP(3);
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "admissionEnabled" BOOLEAN NOT NULL DEFAULT true;
