-- ============================================================================
-- Migration : Ajout colonne whatsapp à tenant_identity_profiles
-- ============================================================================
-- Objectif : Permettre la persistance du numéro WhatsApp de l'école dans
--            l'onglet Identité du module Paramètres.
--
-- Cette colonne sera synchronisée vers school_settings.whatsapp (qui existe
-- déjà) par IdentityProfileService.syncToSchoolSettings().
--
-- Utilisée par les templates WhatsApp Meta v3 (boutons URL dynamiques).
-- ============================================================================

ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

COMMENT ON COLUMN "tenant_identity_profiles"."whatsapp" IS
  'Numéro WhatsApp de l''école au format E.164 (ex: +22997123456). Alimenté via l''onglet Identité du module Paramètres.';
