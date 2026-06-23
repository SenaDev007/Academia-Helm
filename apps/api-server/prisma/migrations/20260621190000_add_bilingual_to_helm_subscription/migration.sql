-- ============================================================================
-- Migration: 20260621190000_add_bilingual_to_helm_subscription
-- ============================================================================
-- Ajoute le champ `bilingualEnabled` à HelmSubscription pour stocker l'état
-- de l'option bilingue (Français + Anglais).
--
-- Ce champ est utilisé par les endpoints /billing/bilingual-* pour activer
-- ou désactiver l'option bilingue depuis le module paramètres.
--
-- Le modèle Subscription (l'ancien) a déjà ce champ, mais le système de
-- billing principal utilise HelmSubscription. On ajoute donc le champ ici
-- pour cohérence.
-- ============================================================================

ALTER TABLE "helm_subscriptions" ADD COLUMN IF NOT EXISTS "bilingualEnabled" BOOLEAN NOT NULL DEFAULT false;
