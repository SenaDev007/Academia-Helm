-- ============================================================================
-- Migration: 20260621170000_add_logo_url_to_onboarding_draft
-- ============================================================================
-- Ajoute le champ `logoUrl` à la table `onboarding_drafts` pour stocker
-- le chemin du logo uploadé pendant l'onboarding.
--
-- Ce champ est ensuite utilisé lors de l'activation du tenant pour créer
-- l'entité School avec le bon logo.
-- ============================================================================

ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
