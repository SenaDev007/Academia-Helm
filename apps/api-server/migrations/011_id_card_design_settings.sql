-- ============================================================================
-- 011_id_card_design_settings.sql
-- ============================================================================
-- Paramètres de design des cartes scolaires + heures de sortie maternelle.
-- Permet à l'école de personnaliser le design des cartes.
-- ============================================================================

ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "maternellePickupMorning" TEXT DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS "maternellePickupAfternoon" TEXT DEFAULT '16:30';

-- Paramètres de design des cartes scolaires (couleurs, texte)
ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "cardPrimaryColor" TEXT DEFAULT '#0D1F6E',
  ADD COLUMN IF NOT EXISTS "cardSecondaryColor" TEXT DEFAULT '#1A237E',
  ADD COLUMN IF NOT EXISTS "cardShowQRCode" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cardShowBarcode" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cardShowPhoto" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cardShowGuardian" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cardShowEmergencyCall" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cardShowSchoolAddress" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cardFooterText" TEXT DEFAULT 'Academia Helm',
  ADD COLUMN IF NOT EXISTS "cardConditionsText" TEXT DEFAULT 'Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l''administration.';
