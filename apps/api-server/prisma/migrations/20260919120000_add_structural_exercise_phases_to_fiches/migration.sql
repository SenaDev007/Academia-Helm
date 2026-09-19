-- ============================================================================
-- FICHE DE FRANÇAIS — EXERCICES STRUCTURAUX EN TABLEAUX 2 COLONNES
-- (retour promoteur, 2026-09-19) :
--
--   Phase introductive      : tableau 2 colonnes « Enseignant | Enseignant »
--                             → phase_intro_ens1 | phase_intro_ens2
--   Phase de systématisation : tableau 2 colonnes « Enseignant | Apprenant »
--                             → phase_syst_ens  | phase_syst_app
--
-- Utilisées dans la PRÉPARATION de la fiche (UI), la GÉNÉRATION DU PDF et
-- persistées via le CRUD /pedagogy-space/fiches (champs ajoutés au fieldMap
-- create + allowedFields update + listes de repli optionnel 42703).
--
-- Colonnes NULLABLE (rétro-compatibilité) :
--   - les fiches existantes restent valides ;
--   - les anciennes colonnes phase_introductive / phase_systematisation
--     (texte simple) sont CONSERVÉES : à l'ouverture en édition, l'ancien
--     contenu est reporté dans la 1re colonne du tableau correspondant, et
--     il reste lisible dans les anciens PDF déjà générés.
-- ============================================================================

ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "phase_intro_ens1" TEXT,
  ADD COLUMN IF NOT EXISTS "phase_intro_ens2" TEXT,
  ADD COLUMN IF NOT EXISTS "phase_syst_ens" TEXT,
  ADD COLUMN IF NOT EXISTS "phase_syst_app" TEXT;
