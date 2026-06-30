-- ============================================================================
-- Migration: drop wrong FK on timetable_configs.schoolLevelId
-- ============================================================================
--
-- PROBLÈME : La contrainte FK `timetable_configs_schoolLevelId_fkey` référence
-- la table `school_levels` (modèle SchoolLevel). Mais le frontend envoie des
-- IDs de la table `education_levels` (modèle EducationLevel) via le sélecteur
-- de niveau du header (/api/school-levels → /settings/education/structure).
--
-- Ces DEUX tables ont des IDs DIFFÉRENTS — l'INSERT/UPDATE échoue avec
-- PostgreSQL 23503 (foreign_key_violation).
--
-- FIX : Supprimer la FK sur schoolLevelId. La colonne reste (pour stocker
-- l'ID du niveau), mais sans contrainte d'intégrité — c'est l'application
-- qui valide l'existence du niveau via validateForeignKeys() côté backend.
--
-- On garde la FK sur academicYearId (qui est correcte) et tenantId.
-- ============================================================================

-- Supprimer la FK sur schoolLevelId (référence la mauvaise table)
ALTER TABLE "timetable_configs"
DROP CONSTRAINT IF EXISTS "timetable_configs_schoolLevelId_fkey";
