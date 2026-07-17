-- ============================================================================
-- Migration: 020_card_design_options_configurables.sql
-- Date: 2026-07-18
-- Purpose: Add 16 new configurable design options to TenantIdentityProfile
--   for the CMS Carte Scolaire studio (Phase 5 — Task 22-b).
--
-- New fields :
--   - Police : cardFontFamily, cardFontSizeScale, cardStudentNameStyle
--   - Photo : cardPhotoPosition, cardPhotoSize, cardPhotoShape
--   - Header : cardHeaderStyle, cardLogoPosition, cardLogoSize
--   - Champs affichés : cardShowMatricule, cardShowBirthInfo, cardShowGender,
--     cardShowLevel
--   - QR Code : cardQrPosition, cardQrSize, cardQrWithLogo
--
-- All fields are nullable with sensible defaults — fully retro-compatible.
-- ============================================================================

-- ⚠️ Ne pas utiliser ALTER TABLE IF NOT EXISTS sur Neon (pas supporté).
-- On utilise une guard PL/pgSQL pour vérifier l'existence de chaque colonne.

DO $$
BEGIN
  -- ─── Police ───
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardFontFamily') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardFontFamily" TEXT DEFAULT 'Helvetica';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardFontSizeScale') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardFontSizeScale" TEXT DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardStudentNameStyle') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardStudentNameStyle" TEXT DEFAULT 'bold';
  END IF;

  -- ─── Photo ───
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardPhotoPosition') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardPhotoPosition" TEXT DEFAULT 'left';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardPhotoSize') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardPhotoSize" TEXT DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardPhotoShape') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardPhotoShape" TEXT DEFAULT 'rectangle';
  END IF;

  -- ─── Header ───
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardHeaderStyle') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardHeaderStyle" TEXT DEFAULT 'solid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardLogoPosition') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardLogoPosition" TEXT DEFAULT 'left';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardLogoSize') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardLogoSize" TEXT DEFAULT 'medium';
  END IF;

  -- ─── Champs affichés ───
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardShowMatricule') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardShowMatricule" BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardShowBirthInfo') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardShowBirthInfo" BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardShowGender') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardShowGender" BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardShowLevel') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardShowLevel" BOOLEAN DEFAULT true;
  END IF;

  -- ─── QR Code ───
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardQrPosition') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardQrPosition" TEXT DEFAULT 'bottom-right';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardQrSize') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardQrSize" TEXT DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_identity_profiles' AND column_name = 'cardQrWithLogo') THEN
    ALTER TABLE tenant_identity_profiles ADD COLUMN "cardQrWithLogo" BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON COLUMN tenant_identity_profiles."cardFontFamily" IS 'Famille de police (Helvetica, Arial, Times New Roman, Georgia, Verdana, Trebuchet MS, Courier New)';
COMMENT ON COLUMN tenant_identity_profiles."cardFontSizeScale" IS 'Échelle de taille des textes (small=90%, medium=100%, large=110%)';
COMMENT ON COLUMN tenant_identity_profiles."cardPhotoPosition" IS 'Position de la photo dans le body recto (left, right)';
COMMENT ON COLUMN tenant_identity_profiles."cardPhotoSize" IS 'Taille de la photo (small=20x26mm, medium=24x30mm, large=28x34mm)';
COMMENT ON COLUMN tenant_identity_profiles."cardPhotoShape" IS 'Forme de la photo (rectangle, rounded, circle)';
COMMENT ON COLUMN tenant_identity_profiles."cardHeaderStyle" IS 'Style du bandeau en-tête (solid, gradient, striped)';
COMMENT ON COLUMN tenant_identity_profiles."cardLogoPosition" IS 'Position du logo dans le header (left, center, right)';
COMMENT ON COLUMN tenant_identity_profiles."cardLogoSize" IS 'Taille du logo (small=8mm, medium=10mm, large=12mm)';
COMMENT ON COLUMN tenant_identity_profiles."cardQrPosition" IS 'Position du QR code au verso (bottom-right, bottom-left, top-right, top-left)';
COMMENT ON COLUMN tenant_identity_profiles."cardQrSize" IS 'Taille du QR code (small=16mm, medium=20mm, large=24mm)';
COMMENT ON COLUMN tenant_identity_profiles."cardQrWithLogo" IS 'Logo école intégré au centre du QR code (true/false)';
COMMENT ON COLUMN tenant_identity_profiles."cardStudentNameStyle" IS 'Style du nom élève (normal, uppercase, bold)';
