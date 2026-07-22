-- ============================================================================
-- Migration: Séparation SaisieMaster et restauration Cahier de Texte
-- ============================================================================
-- 1) Revertir cahier_de_textes à son état original (testType, testNumber)
-- 2) Créer la nouvelle table saisie_master_evaluations
-- ============================================================================

-- ============================================================================
-- 1) RESTAURER cahier_de_textes avec testType + testNumber
-- ============================================================================

-- Ajouter à nouveau les colonnes testType et testNumber
ALTER TABLE "cahier_de_textes"
  ADD COLUMN IF NOT EXISTS "testType" TEXT,
  ADD COLUMN IF NOT EXISTS "testNumber" INTEGER;

-- Migrer les données : evaluationType → testType (mapping inverse)
UPDATE "cahier_de_textes"
SET "testType" = CASE
  WHEN "evaluationType" = 'ES1' THEN 'COMPOSITION'
  WHEN "evaluationType" = 'ES2' THEN 'COMPOSITION'
  WHEN "evaluationType" = 'ES3' THEN 'COMPOSITION'
  WHEN "evaluationType" = 'EF1' THEN 'DEVOIR'
  ELSE 'DEVOIR'
END,
"testNumber" = 1
WHERE "testType" IS NULL;

-- Si testType est encore NULL, valeur par défaut
UPDATE "cahier_de_textes" SET "testType" = 'DEVOIR' WHERE "testType" IS NULL;
UPDATE "cahier_de_textes" SET "testNumber" = 1 WHERE "testNumber" IS NULL;

-- Rendre testType NOT NULL
ALTER TABLE "cahier_de_textes" ALTER COLUMN "testType" SET NOT NULL;

-- Supprimer les colonnes evaluationType et evaluationLabel (elles vont dans saisie_master_evaluations)
DROP INDEX IF EXISTS "cahier_de_textes_tenant_year_class_subj_trim_eval_key";
DROP INDEX IF EXISTS "cahier_de_textes_evaluation_type_idx";
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "evaluationType";
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "evaluationLabel";

-- Restaurer l'index sur testType
CREATE INDEX IF NOT EXISTS "cahier_de_textes_test_type_idx"
  ON "cahier_de_textes" ("testType");

-- ============================================================================
-- 2) CRÉER la table saisie_master_evaluations (module dédié)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "saisie_master_evaluations" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "teacherId"       TEXT              NOT NULL,
    "classId"         TEXT              NOT NULL,
    "subjectId"       TEXT,

    -- En-tête
    "schoolName"           TEXT,
    "className"            TEXT,
    "academicYearLabel"    TEXT,
    "trimester"            INTEGER           NOT NULL,
    "evaluationType"       TEXT              NOT NULL,
    "evaluationLabel"      TEXT,
    "testTitle"            TEXT              NOT NULL,
    "testDate"             DATE,
    "durationMinutes"      INTEGER,
    "teacherName"          TEXT,

    -- Configuration des notes
    "maxScore"             DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "passingScore"         DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "coefficient"         DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    -- Notes des élèves (JSON)
    "studentScores"        JSONB           NOT NULL DEFAULT '[]'::jsonb,

    -- Statistiques calculées
    "totalStudents"        INTEGER,
    "totalPresent"        INTEGER,
    "totalAbsent"         INTEGER,
    "averageScore"        DOUBLE PRECISION,
    "highestScore"        DOUBLE PRECISION,
    "lowestScore"         DOUBLE PRECISION,
    "passedCount"         INTEGER,
    "failedCount"         INTEGER,
    "passRate"            DOUBLE PRECISION,

    -- Répartition par sexe
    "boysCount"           INTEGER,
    "girlsCount"          INTEGER,
    "boysAverage"         DOUBLE PRECISION,
    "girlsAverage"        DOUBLE PRECISION,
    "boysPassed"          INTEGER,
    "girlsPassed"         INTEGER,

    -- Observations pédagogiques
    "pedagogicalObservations" TEXT,
    "recommandations"        TEXT,

    -- Signatures
    "teacherSignature"     TEXT,
    "directorSignature"   TEXT,

    -- Workflow
    "status"               TEXT            NOT NULL DEFAULT 'DRAFT',
    "submittedAt"          TIMESTAMP(3),
    "validatedAt"          TIMESTAMP(3),
    "validatedBy"          TEXT,
    "rejectionReason"      TEXT,

    "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "saisie_master_evaluations_pkey" PRIMARY KEY ("id")
);

-- Index unique : une seule évaluation par classe × matière × trimestre × type
CREATE UNIQUE INDEX IF NOT EXISTS "saisie_master_evaluations_tenant_year_class_subj_trim_eval_key"
    ON "saisie_master_evaluations" ("tenantId", "academicYearId", "classId", "subjectId", "trimester", "evaluationType");

CREATE INDEX IF NOT EXISTS "saisie_master_evaluations_tenant_year_teacher_idx"
    ON "saisie_master_evaluations" ("tenantId", "academicYearId", "teacherId");

CREATE INDEX IF NOT EXISTS "saisie_master_evaluations_class_idx"
    ON "saisie_master_evaluations" ("classId");

CREATE INDEX IF NOT EXISTS "saisie_master_evaluations_subject_idx"
    ON "saisie_master_evaluations" ("subjectId");

CREATE INDEX IF NOT EXISTS "saisie_master_evaluations_status_idx"
    ON "saisie_master_evaluations" ("status");

CREATE INDEX IF NOT EXISTS "saisie_master_evaluations_trimester_idx"
    ON "saisie_master_evaluations" ("trimester");

CREATE INDEX IF NOT EXISTS "saisie_master_evaluations_evaluation_type_idx"
    ON "saisie_master_evaluations" ("evaluationType");
