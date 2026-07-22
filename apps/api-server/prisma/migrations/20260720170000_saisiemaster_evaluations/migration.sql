-- ============================================================================
-- Migration: SaisieMaster — 4 types d'évaluations (EF1, ES1, ES2, ES3)
-- ============================================================================
-- Ajoute les colonnes evaluationType, evaluationLabel
-- Migre les anciennes données testType → evaluationType
-- Supprime les anciennes colonnes testType, testNumber
-- ============================================================================

-- 1) Ajouter les nouvelles colonnes
ALTER TABLE "cahier_de_textes"
  ADD COLUMN IF NOT EXISTS "evaluationType" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluationLabel" TEXT;

-- 2) Migrer les données : convertir testType → evaluationType
UPDATE "cahier_de_textes"
SET "evaluationType" = CASE
  WHEN "testType" = 'COMPOSITION' THEN 'ES1'
  WHEN "testType" = 'DEVOIR' THEN 'EF1'
  WHEN "testType" = 'INTERROGATION' THEN 'EF1'
  WHEN "testType" = 'TEST' THEN 'EF1'
  ELSE COALESCE("evaluationType", 'EF1')
END,
"evaluationLabel" = CASE
  WHEN "testType" = 'COMPOSITION' THEN 'Évaluation Sommative 1'
  WHEN "testType" = 'DEVOIR' THEN 'Évaluation Formative 1'
  WHEN "testType" = 'INTERROGATION' THEN 'Évaluation Formative 1'
  WHEN "testType" = 'TEST' THEN 'Évaluation Formative 1'
  ELSE COALESCE("evaluationLabel", 'Évaluation Formative 1')
END
WHERE "evaluationType" IS NULL OR "evaluationLabel" IS NULL;

-- 3) Si evaluationType est encore NULL, mettre EF1 par défaut
UPDATE "cahier_de_textes" SET "evaluationType" = 'EF1' WHERE "evaluationType" IS NULL;
UPDATE "cahier_de_textes" SET "evaluationLabel" = 'Évaluation Formative 1' WHERE "evaluationLabel" IS NULL;

-- 4) Rendre evaluationType NOT NULL
ALTER TABLE "cahier_de_textes" ALTER COLUMN "evaluationType" SET NOT NULL;

-- 5) Supprimer l'ancienne colonne testType et testNumber
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "testType";
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "testNumber";

-- 6) Supprimer l'ancien index testType et créer le nouveau sur evaluationType
DROP INDEX IF EXISTS "cahier_de_textes_test_type_idx";
CREATE INDEX IF NOT EXISTS "cahier_de_textes_evaluation_type_idx"
  ON "cahier_de_textes" ("evaluationType");

-- 7) Créer l'index unique sur (tenantId, academicYearId, classId, subjectId, trimester, evaluationType)
CREATE UNIQUE INDEX IF NOT EXISTS "cahier_de_textes_tenant_year_class_subj_trim_eval_key"
  ON "cahier_de_textes" ("tenantId", "academicYearId", "classId", "subjectId", "trimester", "evaluationType");
