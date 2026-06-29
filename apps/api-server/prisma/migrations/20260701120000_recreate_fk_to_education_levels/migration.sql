-- ============================================================================
-- Migration: recréer les FK vers education_levels (au lieu de school_levels)
-- ============================================================================
--
-- CONTEXTE :
-- Les migrations précédentes (20260701090000 et 20260701110000) ont
-- supprimé les FK sur schoolLevelId pour timetable_configs et admissions
-- car elles référençaient school_levels (mauvaise table).
--
-- Le frontend envoie des IDs de education_levels (via /api/school-levels
-- → /settings/education/structure). C'est la BONNE table.
--
-- PROBLÈME : Sans FK, on perd l'intégrité référentielle → données
-- orphelines possibles, IDs invalides acceptés silencieusement.
--
-- SOLUTION : Recréer les FK vers education_levels (la bonne table)
-- avec ON DELETE SET NULL (si on supprime un niveau, les enregistrements
-- gardent leurs autres données mais perdent le lien niveau).
--
-- Avant de recréer la FK, on nettoie les données orphelines existantes
-- (schoolLevelId qui ne correspond à aucun education_levels → NULL).
-- ============================================================================

-- ─── admissions.schoolLevelId → education_levels ───────────────────────────

-- 1. Nettoyer les orphelins (avant la FK, sinon ALTER peut échouer)
UPDATE "admissions" SET "schoolLevelId" = NULL
WHERE "schoolLevelId" IS NOT NULL
  AND "schoolLevelId" NOT IN (SELECT "id" FROM "education_levels");

-- 2. Recréer la FK vers la BONNE table
ALTER TABLE "admissions"
  ADD CONSTRAINT "admissions_schoolLevelId_fkey"
  FOREIGN KEY ("schoolLevelId") REFERENCES "education_levels"("id")
  ON DELETE SET NULL;

-- ─── timetable_configs.schoolLevelId → education_levels ────────────────────

-- 1. Nettoyer les orphelins
UPDATE "timetable_configs" SET "schoolLevelId" = NULL
WHERE "schoolLevelId" IS NOT NULL
  AND "schoolLevelId" NOT IN (SELECT "id" FROM "education_levels");

-- 2. Recréer la FK vers la BONNE table
ALTER TABLE "timetable_configs"
  ADD CONSTRAINT "timetable_configs_schoolLevelId_fkey"
  FOREIGN KEY ("schoolLevelId") REFERENCES "education_levels"("id")
  ON DELETE SET NULL;
