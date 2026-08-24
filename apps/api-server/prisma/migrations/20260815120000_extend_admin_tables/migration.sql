-- ============================================================================
-- Migration: 20260815120000_extend_admin_tables
-- ============================================================================
-- ⭐ Étend les tables pour supporter la refonte Administration :
--    1. staff_admin_assignments : ajoute signatureUrl + functionLabel
--    2. administrative_seals : ajoute educationLevelId (lien par niveau)
-- ============================================================================

-- ── 1. staff_admin_assignments : ajout signatureUrl + functionLabel ──
ALTER TABLE staff_admin_assignments
  ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
ALTER TABLE staff_admin_assignments
  ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT;
ALTER TABLE staff_admin_assignments
  ADD COLUMN IF NOT EXISTS "functionLabel" TEXT;

-- ── 2. administrative_seals : ajout educationLevelId ──
ALTER TABLE administrative_seals
  ADD COLUMN IF NOT EXISTS "educationLevelId" TEXT;

CREATE INDEX IF NOT EXISTS idx_administrative_seals_education_level
  ON administrative_seals ("educationLevelId");
