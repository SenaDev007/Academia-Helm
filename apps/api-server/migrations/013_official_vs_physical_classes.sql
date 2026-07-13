-- ============================================================================
-- 013_official_vs_physical_classes.sql
-- ============================================================================
-- Met en place la séparation entre "classe officielle" (AcademicClass) et
-- "classe physique" (Class) dans le module Élèves :
--   - Admission          : nouvel champ requestedAcademicClassId
--   - StudentEnrollment  : nouvel champ academicClassId
--   - ClassTransfer      : nouvelle colonne transferType + fromSeriesId/toSeriesId
--                          + fromClassId/toClassId deviennent NULLABLES (pour
--                          les changements de série qui ne touchent pas la classe)
--
-- Permet le workflow métier :
--   1. Admission  → parent choisit la classe OFFICIELLE (CP, CE1, 6ème…)
--   2. Inscription→ élève inscrit dans classe OFFICIELLE
--   3. Affectation→ école affecte l'élève à une classe PHYSIQUE (CE1-A, CE1-B)
--   4. Changements→ classes PHYSIQUES + series OFFICIELLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. admissions.requestedAcademicClassId
-- ----------------------------------------------------------------------------
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "requestedAcademicClassId" TEXT;

CREATE INDEX IF NOT EXISTS "admissions_requestedAcademicClassId_idx"
  ON "admissions" ("requestedAcademicClassId");

-- ----------------------------------------------------------------------------
-- 2. student_enrollments.academicClassId
-- ----------------------------------------------------------------------------
ALTER TABLE "student_enrollments"
  ADD COLUMN IF NOT EXISTS "academicClassId" TEXT;

CREATE INDEX IF NOT EXISTS "student_enrollments_academicClassId_idx"
  ON "student_enrollments" ("academicClassId");

-- ----------------------------------------------------------------------------
-- 3. class_transfers : transferType + fromSeriesId/toSeriesId
--    + fromClassId/toClassId deviennent NULLABLES
-- ----------------------------------------------------------------------------
-- Rendre fromClassId et toClassId NULLABLES (pour SERIES_CHANGE sans changement de classe)
ALTER TABLE "class_transfers"
  ALTER COLUMN "fromClassId" DROP NOT NULL;

ALTER TABLE "class_transfers"
  ALTER COLUMN "toClassId" DROP NOT NULL;

-- Ajouter les nouvelles colonnes
ALTER TABLE "class_transfers"
  ADD COLUMN IF NOT EXISTS "transferType" TEXT NOT NULL DEFAULT 'CLASS_CHANGE';

ALTER TABLE "class_transfers"
  ADD COLUMN IF NOT EXISTS "fromSeriesId" TEXT;

ALTER TABLE "class_transfers"
  ADD COLUMN IF NOT EXISTS "toSeriesId" TEXT;

CREATE INDEX IF NOT EXISTS "class_transfers_transferType_idx"
  ON "class_transfers" ("transferType");

-- ----------------------------------------------------------------------------
-- 4. CONTRAINTES DE CLÉ ÉTRANGÈRE (FK)
-- ----------------------------------------------------------------------------

-- admissions.requestedAcademicClassId → pedagogy_academic_classes.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admissions_requestedAcademicClassId_fkey'
  ) THEN
    ALTER TABLE "admissions"
      ADD CONSTRAINT "admissions_requestedAcademicClassId_fkey"
      FOREIGN KEY ("requestedAcademicClassId")
      REFERENCES "pedagogy_academic_classes" ("id")
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK admissions.requestedAcademicClassId : %', SQLERRM;
END $$;

-- student_enrollments.academicClassId → pedagogy_academic_classes.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_academicClassId_fkey'
  ) THEN
    ALTER TABLE "student_enrollments"
      ADD CONSTRAINT "student_enrollments_academicClassId_fkey"
      FOREIGN KEY ("academicClassId")
      REFERENCES "pedagogy_academic_classes" ("id")
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK student_enrollments.academicClassId : %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 5. BACKFILL : remonter les élèves existants vers leur classe officielle
-- ----------------------------------------------------------------------------
-- Pour chaque inscription qui a une classe physique (classId) mais pas encore
-- de classe officielle (academicClassId), on remonte via Class.officialClassId.
-- L'utilisateur pourra ensuite faire l'affectation manuelle vers les classes
-- physiques lui-même.
--
-- ⚠️ IMPORTANT : ce backfill NE SUPPRIME PAS le classId existant — l'élève
-- conserve sa classe physique actuelle, mais on renseigne aussi la classe
-- officielle pour permettre le nouveau workflow.
-- ----------------------------------------------------------------------------

UPDATE "student_enrollments" se
SET "academicClassId" = c."officialClassId",
    "updatedAt" = NOW()
FROM "classes" c
WHERE se."classId" = c."id"
  AND se."academicClassId" IS NULL
  AND c."officialClassId" IS NOT NULL;

-- Backfill des admissions : si requestedClassId (physique) est renseigné
-- mais requestedAcademicClassId est NULL, on remonte via officialClassId.
UPDATE "admissions" a
SET "requestedAcademicClassId" = c."officialClassId"
FROM "classes" c
WHERE a."requestedClassId" = c."id"
  AND a."requestedAcademicClassId" IS NULL
  AND c."officialClassId" IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. VÉRIFICATION
-- ----------------------------------------------------------------------------
-- Compter combien d'inscriptions ont été backfillées
DO $$
DECLARE
  total_enrollments INTEGER;
  with_academic INTEGER;
  total_admissions INTEGER;
  with_academic_adm INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_enrollments FROM "student_enrollments";
  SELECT COUNT(*) INTO with_academic FROM "student_enrollments" WHERE "academicClassId" IS NOT NULL;
  SELECT COUNT(*) INTO total_admissions FROM "admissions";
  SELECT COUNT(*) INTO with_academic_adm FROM "admissions" WHERE "requestedAcademicClassId" IS NOT NULL;

  RAISE NOTICE 'Backfill terminé :';
  RAISE NOTICE '  - student_enrollments avec academicClassId : % / %', with_academic, total_enrollments;
  RAISE NOTICE '  - admissions avec requestedAcademicClassId : % / %', with_academic_adm, total_admissions;
  RAISE NOTICE '  - Les élèves sans classe officielle (academicClassId NULL) restent à affecter manuellement.';
END $$;
