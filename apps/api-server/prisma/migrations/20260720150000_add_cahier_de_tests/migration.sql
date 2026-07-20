-- ============================================================================
-- CAHIER DE TEST — Évaluations et compositions (SECONDAIRE)
-- ============================================================================
-- Table pour les cahiers de test des enseignants du secondaire.
-- Permet de saisir les notes des élèves pour chaque évaluation par matière.
-- Workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED
-- ============================================================================

CREATE TABLE IF NOT EXISTS "cahier_de_tests" (
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
    "testType"             TEXT              NOT NULL,
    "testNumber"           INTEGER           NOT NULL DEFAULT 1,
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

    CONSTRAINT "cahier_de_tests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cahier_de_tests_tenant_year_teacher_idx"
    ON "cahier_de_tests" ("tenantId", "academicYearId", "teacherId");

CREATE INDEX IF NOT EXISTS "cahier_de_tests_class_idx"
    ON "cahier_de_tests" ("classId");

CREATE INDEX IF NOT EXISTS "cahier_de_tests_subject_idx"
    ON "cahier_de_tests" ("subjectId");

CREATE INDEX IF NOT EXISTS "cahier_de_tests_status_idx"
    ON "cahier_de_tests" ("status");

CREATE INDEX IF NOT EXISTS "cahier_de_tests_trimester_idx"
    ON "cahier_de_tests" ("trimester");

CREATE INDEX IF NOT EXISTS "cahier_de_tests_test_type_idx"
    ON "cahier_de_tests" ("testType");
