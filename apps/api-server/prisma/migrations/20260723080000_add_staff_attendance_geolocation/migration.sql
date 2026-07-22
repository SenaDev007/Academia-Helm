-- ============================================================================
-- Géolocalisation du pointage des enseignants/staff
-- ============================================================================
--
-- Objectif : Permettre à un enseignant (ou au semainier) de marquer sa
-- présence depuis son téléphone/PC, en vérifiant la position GPS contre les
-- coordonnées de l'école (rayon de tolérance configurable).
--
-- 1. Ajout de champs géo + audit sur `staff_attendances`
-- 2. Ajout de coords école + rayon sur `tenant_identity_profiles`
-- ============================================================================

-- ============================================================================
-- 1. staff_attendances — champs géo + audit
-- ============================================================================
ALTER TABLE "staff_attendances"
  ADD COLUMN IF NOT EXISTS "latitude"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "geoAccuracy"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "geoVerified"  BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "geoDistance"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "markedBy"     TEXT,
  ADD COLUMN IF NOT EXISTS "markedByRole" TEXT            NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN IF NOT EXISTS "deviceInfo"   TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress"    TEXT,
  ADD COLUMN IF NOT EXISTS "checkOutMethod" TEXT;

-- Commentaire pour compréhension future
COMMENT ON COLUMN "staff_attendances"."geoVerified" IS
  'TRUE si la position GPS au moment du pointage était dans le rayon toléré de l''école';
COMMENT ON COLUMN "staff_attendances"."markedByRole" IS
  'SELF (auto-pointage enseignant) | SEMINARIER (marqué par le semainier) | ADMIN (marqué par RH/direction)';
COMMENT ON COLUMN "staff_attendances"."checkOutMethod" IS
  'AUTO (calculé à heure fixe) | MANUAL (click bouton fin de journée) | NULL si pas encore checkout';

CREATE INDEX IF NOT EXISTS "staff_attendances_geoVerified_idx"
  ON "staff_attendances" ("geoVerified");
CREATE INDEX IF NOT EXISTS "staff_attendances_markedByRole_idx"
  ON "staff_attendances" ("markedByRole");
CREATE INDEX IF NOT EXISTS "staff_attendances_date_geoVerified_idx"
  ON "staff_attendances" ("date", "geoVerified");

-- ============================================================================
-- 2. tenant_identity_profiles — coords école + rayon de tolérance
-- ============================================================================
ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "latitude"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "geoRadius"  INTEGER         NOT NULL DEFAULT 100;

COMMENT ON COLUMN "tenant_identity_profiles"."latitude" IS
  'Latitude GPS de l''école (format décimal, ex: 6.3654)';
COMMENT ON COLUMN "tenant_identity_profiles"."longitude" IS
  'Longitude GPS de l''école (format décimal, ex: 2.4183)';
COMMENT ON COLUMN "tenant_identity_profiles"."geoRadius" IS
  'Rayon de tolérance en mètres pour le pointage géolocalisé (défaut: 100m)';

CREATE INDEX IF NOT EXISTS "tenant_identity_profiles_lat_lng_idx"
  ON "tenant_identity_profiles" ("latitude", "longitude");
