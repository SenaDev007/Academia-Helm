-- ============================================================================
-- 010_maternelle_pickup_hours.sql
-- ============================================================================
-- Ajoute les heures de sortie pour les élèves de maternelle.
-- Permet à l'école de paramétrer l'heure de récupération le matin et l'après-midi.
-- ============================================================================

ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "maternellePickupMorning" TEXT DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS "maternellePickupAfternoon" TEXT DEFAULT '16:30';
