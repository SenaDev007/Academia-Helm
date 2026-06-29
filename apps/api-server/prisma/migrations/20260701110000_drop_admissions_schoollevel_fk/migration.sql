-- ============================================================================
-- Migration: drop ALL FK constraints on admissions.schoolLevelId
-- ============================================================================
--
-- PROBLÈME : Le modèle Admission a une relation @relation vers SchoolLevel
-- (table school_levels), mais le frontend envoie des IDs de EducationLevel
-- (table education_levels) via /api/school-levels → /settings/education/structure.
--
-- Ces deux tables ont des IDs DIFFÉRENTS → l'INSERT échoue avec erreur 500
-- (foreign key violation sur admissions_schoolLevelId_fkey).
--
-- C'est le même bug que celui corrigé pour timetable_configs (migration
-- 20260701090000) : le header selector utilise education_levels, pas
-- school_levels.
--
-- FIX : Supprimer dynamiquement TOUTE contrainte FK sur la colonne
-- schoolLevelId de la table admissions, quel que soit son nom exact.
-- La relation @relation est aussi retirée du schema Prisma.
-- ============================================================================

DO $$
DECLARE
  fk_constraint_name text;
BEGIN
  -- Trouver le nom de la contrainte FK sur la colonne schoolLevelId
  SELECT c.conname
  INTO fk_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'admissions'
    AND c.contype = 'f'
    AND a.attname = 'schoolLevelId';

  -- Si une contrainte existe, la supprimer
  IF fk_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "admissions" DROP CONSTRAINT IF EXISTS %I', fk_constraint_name);
    RAISE NOTICE 'Dropped FK constraint: %', fk_constraint_name;
  ELSE
    RAISE NOTICE 'No FK constraint found on admissions.schoolLevelId';
  END IF;
END $$;
