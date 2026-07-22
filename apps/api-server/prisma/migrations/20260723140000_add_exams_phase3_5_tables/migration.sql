-- ============================================================================
-- Phase 3-5 — Tables spec pour onglets 3, 4, 5, 6, 7, 8
-- ============================================================================
--
-- Onglet 3 — Évaluations & Sessions :
--   1. evaluation_sessions
--   2. evaluation_participants
--   3. kindergarten_evaluation_domains
--   4. evaluation_competencies
--
-- Onglet 4 — Saisie des résultats :
--   5. evaluation_results (modèle dédié aux résultats, distinct de grades)
--   6. result_correction_requests
--   7. result_import_batches
--
-- Onglet 6 — Bulletins :
--   8. bulletins (table dédiée, distincte de report_cards)
-- ============================================================================

-- 1. evaluation_sessions
CREATE TABLE IF NOT EXISTS "evaluation_sessions" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT      NOT NULL,
    "name"           TEXT      NOT NULL,
    "code"           TEXT,
    "description"    TEXT,
    "periodId"       TEXT      NOT NULL,
    "schoolStage"    TEXT      NOT NULL,
    "levelId"        TEXT,
    "classId"        TEXT,
    "seriesId"       TEXT,
    "startDate"      TIMESTAMP(3),
    "endDate"        TIMESTAMP(3),
    "status"         TEXT      NOT NULL DEFAULT 'DRAFT',
    "createdById"    TEXT,
    "validatedById"  TEXT,
    "lockedById"     TEXT,
    "validatedAt"    TIMESTAMP(3),
    "lockedAt"       TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluation_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "evaluation_sessions_tenant_academicYear_idx"
    ON "evaluation_sessions" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "evaluation_sessions_period_stage_class_idx"
    ON "evaluation_sessions" ("periodId", "schoolStage", "classId", "seriesId");

-- 2. evaluation_participants
CREATE TABLE IF NOT EXISTS "evaluation_participants" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "evaluationId"   TEXT      NOT NULL,
    "studentId"      TEXT      NOT NULL,
    "isEligible"     BOOLEAN   NOT NULL DEFAULT true,
    "exclusionReason" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluation_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_participants_eval_student_key"
    ON "evaluation_participants" ("evaluationId", "studentId");
CREATE INDEX IF NOT EXISTS "evaluation_participants_student_idx"
    ON "evaluation_participants" ("studentId");

-- 3. kindergarten_evaluation_domains
CREATE TABLE IF NOT EXISTS "kindergarten_evaluation_domains" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT      NOT NULL,
    "name"           TEXT      NOT NULL,
    "code"           TEXT      NOT NULL,
    "description"    TEXT,
    "isDefault"      BOOLEAN   NOT NULL DEFAULT false,
    "isActive"       BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kindergarten_evaluation_domains_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "kindergarten_evaluation_domains_tenant_year_code_key"
    ON "kindergarten_evaluation_domains" ("tenantId", "academicYearId", "code");

-- 4. evaluation_competencies
CREATE TABLE IF NOT EXISTS "evaluation_competencies" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "evaluationId"   TEXT      NOT NULL,
    "domainId"       TEXT,
    "label"          TEXT      NOT NULL,
    "description"    TEXT,
    "expectedLevel"  TEXT,
    "orderIndex"     INTEGER   NOT NULL DEFAULT 0,
    "isActive"       BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluation_competencies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "evaluation_competencies_eval_idx"
    ON "evaluation_competencies" ("evaluationId");
CREATE INDEX IF NOT EXISTS "evaluation_competencies_domain_idx"
    ON "evaluation_competencies" ("domainId");

-- 5. evaluation_results
CREATE TABLE IF NOT EXISTS "evaluation_results" (
    "id"                  TEXT      NOT NULL,
    "tenantId"            TEXT      NOT NULL,
    "evaluationId"        TEXT      NOT NULL,
    "studentId"           TEXT      NOT NULL,
    "numericScore"        DOUBLE PRECISION,
    "qualitativeCode"     TEXT,
    "appreciation"        TEXT,
    "teacherComment"      TEXT,
    "directorComment"     TEXT,
    "isAbsent"            BOOLEAN   NOT NULL DEFAULT false,
    "isExempted"          BOOLEAN   NOT NULL DEFAULT false,
    "absenceReason"       TEXT,
    "status"              TEXT      NOT NULL DEFAULT 'NOT_STARTED',
    "enteredById"         TEXT,
    "submittedById"       TEXT,
    "validatedById"       TEXT,
    "lockedById"          TEXT,
    "enteredAt"           TIMESTAMP(3),
    "submittedAt"         TIMESTAMP(3),
    "validatedAt"         TIMESTAMP(3),
    "lockedAt"            TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_results_eval_student_key"
    ON "evaluation_results" ("evaluationId", "studentId");
CREATE INDEX IF NOT EXISTS "evaluation_results_status_idx"
    ON "evaluation_results" ("status");

-- 6. result_correction_requests
CREATE TABLE IF NOT EXISTS "result_correction_requests" (
    "id"                  TEXT      NOT NULL,
    "tenantId"            TEXT      NOT NULL,
    "resultId"            TEXT      NOT NULL,
    "evaluationId"        TEXT      NOT NULL,
    "studentId"           TEXT      NOT NULL,
    "requestedById"       TEXT      NOT NULL,
    "approvedById"        TEXT,
    "reason"              TEXT      NOT NULL,
    "oldNumericScore"     DOUBLE PRECISION,
    "newNumericScore"     DOUBLE PRECISION,
    "oldQualitativeCode"  TEXT,
    "newQualitativeCode"  TEXT,
    "oldAppreciation"     TEXT,
    "newAppreciation"     TEXT,
    "status"              TEXT      NOT NULL DEFAULT 'PENDING',
    "requestedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"          TIMESTAMP(3),
    "rejectedAt"          TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_correction_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "result_correction_requests_eval_idx"
    ON "result_correction_requests" ("evaluationId");
CREATE INDEX IF NOT EXISTS "result_correction_requests_result_idx"
    ON "result_correction_requests" ("resultId");

-- 7. result_import_batches
CREATE TABLE IF NOT EXISTS "result_import_batches" (
    "id"              TEXT      NOT NULL,
    "tenantId"        TEXT      NOT NULL,
    "evaluationId"    TEXT      NOT NULL,
    "fileName"        TEXT      NOT NULL,
    "totalRows"       INTEGER   NOT NULL DEFAULT 0,
    "successRows"     INTEGER   NOT NULL DEFAULT 0,
    "errorRows"       INTEGER   NOT NULL DEFAULT 0,
    "status"          TEXT      NOT NULL DEFAULT 'PENDING',
    "errorReportUrl"  TEXT,
    "importedById"    TEXT,
    "importedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "result_import_batches_eval_idx"
    ON "result_import_batches" ("evaluationId");

-- 8. bulletins (table dédiée, distincte de report_cards)
CREATE TABLE IF NOT EXISTS "bulletins" (
    "id"              TEXT      NOT NULL,
    "tenantId"        TEXT      NOT NULL,
    "academicYearId"  TEXT      NOT NULL,
    "periodId"        TEXT      NOT NULL,
    "studentId"       TEXT      NOT NULL,
    "classId"         TEXT      NOT NULL,
    "bulletinNumber"  TEXT      NOT NULL,
    "status"          TEXT      NOT NULL DEFAULT 'DRAFT',
    "averageSnapshot" JSONB     NOT NULL,
    "decisionSnapshot" JSONB,
    "pdfUrl"          TEXT,
    "qrToken"         TEXT,
    "generatedById"   TEXT,
    "generatedAt"     TIMESTAMP(3),
    "publishedById"   TEXT,
    "publishedAt"     TIMESTAMP(3),
    "isLocked"        BOOLEAN   NOT NULL DEFAULT false,
    "templateId"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bulletins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bulletins_tenant_year_period_student_key"
    ON "bulletins" ("tenantId", "academicYearId", "periodId", "studentId");
CREATE INDEX IF NOT EXISTS "bulletins_class_idx"
    ON "bulletins" ("classId");
CREATE INDEX IF NOT EXISTS "bulletins_status_idx"
    ON "bulletins" ("status");
