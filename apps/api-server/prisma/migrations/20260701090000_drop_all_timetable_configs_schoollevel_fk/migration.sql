-- ============================================================================
-- Migration: drop ALL FK constraints on timetable_configs.schoolLevelId
-- ============================================================================
--
-- PROBLÈME : La migration précédente (20260630100000) a tenté de supprimer
-- la contrainte nommée "timetable_configs_schoolLevelId_fkey", mais en
-- production la contrainte s'appelle "timetable_configs_schoolId" (nom
-- différent). L'INSERT/UPDATE échoue toujours avec :
--   "violates foreign key constraint timetable_configs_schoolId"
--
-- FIX : Utiliser une requête dynamique pour trouver ET supprimer TOUTE
-- contrainte de type foreign key (contype='f') sur la colonne "schoolLevelId"
-- de la table "timetable_configs", quel que soit son nom exact.
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
  WHERE t.relname = 'timetable_configs'
    AND c.contype = 'f'
    AND a.attname = 'schoolLevelId';

  -- Si une contrainte existe, la supprimer
  IF fk_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "timetable_configs" DROP CONSTRAINT IF EXISTS %I', fk_constraint_name);
    RAISE NOTICE 'Dropped FK constraint: %', fk_constraint_name;
  ELSE
    RAISE NOTICE 'No FK constraint found on timetable_configs.schoolLevelId';
  END IF;
END $$;
