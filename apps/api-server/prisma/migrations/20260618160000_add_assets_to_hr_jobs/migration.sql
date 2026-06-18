-- ============================================================================
-- Migration: 20260618160000_add_assets_to_hr_jobs
-- ============================================================================
-- Ajoute la colonne `assets` à la table `hr_jobs` pour stocker les atouts
-- (bonus points) recherchés pour un poste.
-- ============================================================================

ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "assets" TEXT;
