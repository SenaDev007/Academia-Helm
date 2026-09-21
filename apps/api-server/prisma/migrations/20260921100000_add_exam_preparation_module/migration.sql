-- ============================================================================
-- PRÉPARATION D'EXAMEN — Module « Épreuves d'évaluation » (2026-09-21)
--
-- Pattern identique aux fiches pédagogiques / cahier journal, adapté à la
-- préparation des ÉPREUVES d'évaluation :
--
-- 1) exam_preparation_blocks : le BLOC d'épreuves d'UNE session d'évaluation
--    (classe × type d'évaluation × période). C'est le BLOC — et non chaque
--    épreuve individuelle — qui est transmis au directeur, puis après
--    validation, envoyé au secrétariat pour impression.
--    Workflow : DRAFT → SUBMITTED → VALIDATED | REJECTED → SENT_TO_SECRETARIAT
--
-- 2) exam_preparation_sheets : une ÉPREUVE par MATIÈRE au sein du bloc
--    (structure conforme aux modèles officiels fournis — CP/CE2/CM1) :
--    entête (école, classe, année, durée), situation d'évaluation, tâche,
--    consignes/items, clé + grille de correction — tous en HTML riche
--    (RichTextEditor avec tous les outils des fiches pédagogiques, y compris
--    les lignes calligraphiques script/cursive pour le graphisme).
--
-- Idempotent (IF NOT EXISTS) — rétro-compatible.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "exam_preparation_blocks" (
    "id"                      TEXT PRIMARY KEY,
    "tenantId"                TEXT NOT NULL,
    "academicYearId"          TEXT NOT NULL,
    "teacherId"               TEXT NOT NULL,
    "classId"                 TEXT NOT NULL,

    -- Référence à la session d'évaluation (1ère évaluation du groupe)
    "evaluationId"            TEXT,
    "periodId"                TEXT,
    "evaluationTypeId"        TEXT,

    -- Libellés dénormalisés (robustesse cross-year / affichage rapide)
    "title"                   TEXT,
    "className"               TEXT,
    "monthLabel"              TEXT,
    "trimesterLabel"          TEXT,
    "examDate"                DATE,

    -- Workflow : DRAFT | SUBMITTED | VALIDATED | REJECTED | SENT_TO_SECRETARIAT
    "status"                  TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt"             TIMESTAMP(3),
    "validatedAt"             TIMESTAMP(3),
    "validatedBy"             TEXT,
    "rejectionReason"         TEXT,
    "sentToSecretariatAt"     TIMESTAMP(3),
    "directorObservation"     TEXT,
    "secretariatNotes"        TEXT,

    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_preparation_blocks_tenant_year_class_type_period_key"
    ON "exam_preparation_blocks" ("tenantId", "academicYearId", "classId", "evaluationTypeId", "periodId");
CREATE INDEX IF NOT EXISTS "exam_preparation_blocks_tenant_year_teacher_idx"
    ON "exam_preparation_blocks" ("tenantId", "academicYearId", "teacherId");
CREATE INDEX IF NOT EXISTS "exam_preparation_blocks_status_idx"
    ON "exam_preparation_blocks" ("status");
CREATE INDEX IF NOT EXISTS "exam_preparation_blocks_class_idx"
    ON "exam_preparation_blocks" ("classId");

CREATE TABLE IF NOT EXISTS "exam_preparation_sheets" (
    "id"                      TEXT PRIMARY KEY,
    "tenantId"                TEXT NOT NULL,
    "academicYearId"          TEXT NOT NULL,
    "blockId"                 TEXT NOT NULL REFERENCES "exam_preparation_blocks"("id") ON DELETE CASCADE,
    "teacherId"               TEXT NOT NULL,
    "classId"                 TEXT NOT NULL,
    "subjectId"               TEXT,
    "evaluationId"            TEXT,

    -- Libellés dénormalisés
    "subjectName"             TEXT,
    "epreuveTitle"            TEXT,
    "durationLabel"           TEXT,
    "maxScoreLabel"           TEXT,
    "coefficient"             TEXT,
    "showIdentityFields"      BOOLEAN NOT NULL DEFAULT TRUE,

    -- Contenu riche (HTML — RichTextEditor, tous les outils fiches pédagogiques)
    "situation"               TEXT,
    "tache"                   TEXT,
    "consignes"               TEXT,
    "cleCorrection"           TEXT,
    "grilleCorrection"        TEXT,

    "teacherName"             TEXT,
    "orderIndex"              INTEGER NOT NULL DEFAULT 0,
    "status"                  TEXT NOT NULL DEFAULT 'DRAFT',

    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "exam_preparation_sheets_tenant_year_teacher_idx"
    ON "exam_preparation_sheets" ("tenantId", "academicYearId", "teacherId");
CREATE INDEX IF NOT EXISTS "exam_preparation_sheets_block_idx"
    ON "exam_preparation_sheets" ("blockId");
CREATE INDEX IF NOT EXISTS "exam_preparation_sheets_subject_idx"
    ON "exam_preparation_sheets" ("subjectId");
