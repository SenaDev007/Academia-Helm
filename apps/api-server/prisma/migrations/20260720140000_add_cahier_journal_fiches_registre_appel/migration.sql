-- ============================================================================
-- Phase 1, 2, 3 — Cahier Journal + Fiches Pédagogiques + Registre d'Appel
-- ============================================================================
-- Implémentation conforme aux templates officiels du primaire (Benin/Togo).
-- 5 nouvelles tables:
--   1. cahier_journal_entries    — grille hebdomadaire 5 jours × 8 matières
--   2. pedagogical_sheets        — fiches pédagogiques (5 types: MATH/FRANCAIS/EST/ES/EA)
--   3. attendance_registers      — registre d'appel mensuel (1 élève = 1 ligne, 25 cases)
--   4. monthly_evaluations       — évaluation certificative mensuelle (CM/CP/Total)
--   5. monthly_summaries        — tableau de relevés mensuels annuel
-- ============================================================================

-- 1. CAHIER JOURNAL — grille hebdomadaire (5 jours × 8 matières)
CREATE TABLE IF NOT EXISTS "cahier_journal_entries" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "teacherId"       TEXT              NOT NULL,
    "classId"         TEXT              NOT NULL,
    "weekStartDate"   DATE              NOT NULL,
    "weekEndDate"     DATE              NOT NULL,

    "className"             TEXT,
    "entries"               JSONB           NOT NULL DEFAULT '{}'::jsonb,
    "observations"          TEXT,
    "directorName"          TEXT,
    "directorValidatedAt"  TIMESTAMP(3),

    "status"                TEXT            NOT NULL DEFAULT 'DRAFT',
    "submittedAt"           TIMESTAMP(3),
    "validatedAt"           TIMESTAMP(3),
    "validatedBy"           TEXT,
    "rejectionReason"       TEXT,

    "createdAt"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "cahier_journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cahier_journal_entries_tenant_year_class_week_key"
    ON "cahier_journal_entries" ("tenantId", "academicYearId", "classId", "weekStartDate");

CREATE INDEX IF NOT EXISTS "cahier_journal_entries_tenant_year_teacher_idx"
    ON "cahier_journal_entries" ("tenantId", "academicYearId", "teacherId");

CREATE INDEX IF NOT EXISTS "cahier_journal_entries_status_idx"
    ON "cahier_journal_entries" ("status");

-- 2. FICHES PÉDAGOGIQUES PRIMAIRE — 5 types (MATH/FRANCAIS/EST/ES/EA)
CREATE TABLE IF NOT EXISTS "primary_pedagogical_fiches" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "teacherId"       TEXT              NOT NULL,
    "classId"         TEXT              NOT NULL,
    "subjectId"       TEXT,
    "sheetType"       TEXT              NOT NULL,

    -- En-tête
    "schoolName"           TEXT,
    "className"            TEXT,
    "academicYearLabel"    TEXT,
    "trimester"            INTEGER,
    "weekNumber"           INTEGER,
    "lessonDate"           DATE,
    "lessonTime"           TEXT,
    "durationMinutes"      INTEGER,
    "teacherName"          TEXT,

    -- Effectifs
    "boysCount"            INTEGER,
    "girlsCount"           INTEGER,
    "totalStudents"        INTEGER,
    "boysPresent"          INTEGER,
    "girlsPresent"         INTEGER,
    "totalPresent"         INTEGER,
    "boysAbsent"           INTEGER,
    "girlsAbsent"          INTEGER,
    "totalAbsent"          INTEGER,

    -- Ruban pédagogique
    "competence"           TEXT,
    "habilete"             TEXT,
    "prealable"            TEXT,
    "contenu"              TEXT,
    "methodes"             TEXT,
    "moyensDidactiques"    TEXT,
    "deroulement"          JSONB,
    "evaluation"           TEXT,
    "reference"            TEXT,

    -- Ruban administratif
    "adminDate"            DATE,
    "adminWeek"            INTEGER,
    "adminHoraire"         TEXT,
    "adminDuree"           INTEGER,

    -- Signatures
    "teacherSignature"     TEXT,
    "directorSignature"    TEXT,

    -- Workflow
    "status"               TEXT            NOT NULL DEFAULT 'DRAFT',
    "submittedAt"          TIMESTAMP(3),
    "validatedAt"          TIMESTAMP(3),
    "validatedBy"          TEXT,
    "rejectionReason"      TEXT,

    "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "primary_pedagogical_fiches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_tenant_year_teacher_idx"
    ON "primary_pedagogical_fiches" ("tenantId", "academicYearId", "teacherId");

CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_sheet_type_idx"
    ON "primary_pedagogical_fiches" ("sheetType");

CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_status_idx"
    ON "primary_pedagogical_fiches" ("status");

CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_class_idx"
    ON "primary_pedagogical_fiches" ("classId");

-- 3. REGISTRE D'APPEL — registre mensuel par classe
CREATE TABLE IF NOT EXISTS "attendance_registers" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "classId"         TEXT              NOT NULL,
    "teacherId"       TEXT              NOT NULL,
    "month"           INTEGER           NOT NULL,
    "year"            INTEGER           NOT NULL,

    "studentsData"         JSONB          NOT NULL DEFAULT '[]'::jsonb,

    -- Section récapitulative
    "demiJourneeMois"              INTEGER,
    "presencePossibleMois"         INTEGER,
    "totalAbsencesMois"            INTEGER,
    "totalPresencesEffectivesMois" INTEGER,
    "pourcentagePresences"         DOUBLE PRECISION,
    "pourcentageAbsences"          DOUBLE PRECISION,

    -- Phrase d'arrêt
    "arreteDate"          TIMESTAMP(3),
    "arreteHeure"         TEXT,
    "effectifJourFilles"  INTEGER,
    "effectifJourGarcons" INTEGER,

    -- Signatures
    "directeurSignatureDate" TIMESTAMP(3),
    "titulaireSignatureDate" TIMESTAMP(3),

    -- Workflow
    "status"               TEXT            NOT NULL DEFAULT 'DRAFT',
    "submittedAt"          TIMESTAMP(3),
    "validatedAt"          TIMESTAMP(3),
    "validatedBy"          TEXT,
    "rejectionReason"      TEXT,

    "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "attendance_registers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_registers_tenant_year_class_month_year_key"
    ON "attendance_registers" ("tenantId", "academicYearId", "classId", "month", "year");

CREATE INDEX IF NOT EXISTS "attendance_registers_tenant_year_idx"
    ON "attendance_registers" ("tenantId", "academicYearId");

CREATE INDEX IF NOT EXISTS "attendance_registers_teacher_idx"
    ON "attendance_registers" ("teacherId");

-- 4. ÉVALUATION CERTIFICATIVE MENSUELLE (page 2 du registre)
CREATE TABLE IF NOT EXISTS "monthly_evaluations" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "classId"         TEXT              NOT NULL,
    "attendanceRegisterId" TEXT         NOT NULL,
    "month"           INTEGER           NOT NULL,
    "year"            INTEGER           NOT NULL,

    "evaluationNumber" INTEGER,
    "etapeNumber"     INTEGER,

    "subjectsConfig"  JSONB          NOT NULL DEFAULT '[]'::jsonb,
    "studentScores"   JSONB          NOT NULL DEFAULT '[]'::jsonb,

    "seuilReussite"   DOUBLE PRECISION NOT NULL DEFAULT 10.0,

    -- Section récapitulative
    "effectifTotalGarcons" INTEGER,
    "effectifTotalFilles"  INTEGER,
    "effectifTotalClasse"  INTEGER,

    "ayantComposeG"        INTEGER,
    "ayantComposeF"        INTEGER,
    "ayantComposeTotal"    INTEGER,

    "ayantAtteintSeuilG"    INTEGER,
    "ayantAtteintSeuilF"    INTEGER,
    "ayantAtteintSeuilTotal" INTEGER,

    "nAyantPasAtteintG"     INTEGER,
    "nAyantPasAtteintF"     INTEGER,
    "nAyantPasAtteintTotal" INTEGER,

    "pourcentageReussiteG"     DOUBLE PRECISION,
    "pourcentageReussiteF"     DOUBLE PRECISION,
    "pourcentageReussiteTotal" DOUBLE PRECISION,

    -- Signatures
    "teacherSignatureDate"  TIMESTAMP(3),
    "directorSignatureDate" TIMESTAMP(3),

    -- Workflow
    "status"               TEXT            NOT NULL DEFAULT 'DRAFT',
    "submittedAt"          TIMESTAMP(3),
    "validatedAt"          TIMESTAMP(3),
    "validatedBy"          TEXT,
    "rejectionReason"      TEXT,

    "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "monthly_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_evaluations_register_key"
    ON "monthly_evaluations" ("attendanceRegisterId");

CREATE INDEX IF NOT EXISTS "monthly_evaluations_tenant_year_class_idx"
    ON "monthly_evaluations" ("tenantId", "academicYearId", "classId");

-- 5. TABLEAU DE RELEVÉS MENSUELS — synthèse annuelle par classe
CREATE TABLE IF NOT EXISTS "monthly_summaries" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "classId"         TEXT              NOT NULL,

    "monthlyData"     JSONB          NOT NULL DEFAULT '[]'::jsonb,

    "createdAt"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_summaries_tenant_year_class_key"
    ON "monthly_summaries" ("tenantId", "academicYearId", "classId");
