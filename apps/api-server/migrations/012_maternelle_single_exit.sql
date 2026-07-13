-- ============================================================================
-- 012_maternelle_single_exit.sql
-- ============================================================================
-- Ajoute le support de la sortie unique pour les écoles bilingues
-- (cours jusqu'à 15h30 au lieu de sortie matin + après-midi séparées)
-- ============================================================================

ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "maternelleSingleExit" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "maternelleSingleExitTime" TEXT DEFAULT '15:30';
