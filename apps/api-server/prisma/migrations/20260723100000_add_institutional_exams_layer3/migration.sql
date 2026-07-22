-- ============================================================================
-- Phase 1 — Migration des 14 tables Layer 3 (institutional-exams)
-- ============================================================================
--
-- Ces tables sont définies dans schema.prisma mais n'ont jamais eu de
-- migration SQL. La production plante à la 1ère requête les utilisant.
--
-- Tables créées :
--   1. academic_periods
--   2. school_academic_settings
--   3. academic_settings_audit_logs
--   4. evaluations
--   5. evaluation_types
--   6. grade_scales
--   7. exam_calculation_rules
--   8. grade_validation_batches
--   9. grade_locks
--  10. student_period_averages
--  11. student_subject_averages
--  12. student_council_decisions
--  13. academic_audit_logs
--  14. grade_correction_requests
-- ============================================================================

-- ============================================================================
-- 1. academic_periods
-- ============================================================================
CREATE TABLE IF NOT EXISTS "academic_periods" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT      NOT NULL,
    "name"           TEXT      NOT NULL,
    "type"           TEXT      NOT NULL,
    "periodOrder"    INTEGER   NOT NULL,
    "startDate"      TIMESTAMP(3) NOT NULL,
    "endDate"        TIMESTAMP(3) NOT NULL,
    "isActive"       BOOLEAN   NOT NULL DEFAULT false,
    "isClosed"       BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "academic_periods_academicYearId_periodOrder_key"
    ON "academic_periods" ("academicYearId", "periodOrder");
CREATE INDEX IF NOT EXISTS "academic_periods_tenantId_academicYearId_idx"
    ON "academic_periods" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "academic_periods_academicYearId_isActive_idx"
    ON "academic_periods" ("academicYearId", "isActive");

-- ============================================================================
-- 2. school_academic_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS "school_academic_settings" (
    "id"            TEXT      NOT NULL,
    "tenantId"      TEXT      NOT NULL,
    "schoolYearId"  TEXT      NOT NULL,
    "countryCode"   TEXT      NOT NULL,
    "systemCode"    TEXT,
    "cycleCode"     TEXT,
    "levelCode"     TEXT,
    "classId"       TEXT,
    "name"          TEXT      NOT NULL,
    "description"   TEXT,
    "status"        TEXT      NOT NULL DEFAULT 'DRAFT',
    "version"       INTEGER   NOT NULL DEFAULT 1,
    "isActive"      BOOLEAN   NOT NULL DEFAULT false,
    "isLocked"      BOOLEAN   NOT NULL DEFAULT false,
    "config"        JSONB     NOT NULL,
    "createdById"   TEXT,
    "activatedById" TEXT,
    "lockedById"    TEXT,
    "activatedAt"   TIMESTAMP(3),
    "lockedAt"      TIMESTAMP(3),
    "archivedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_academic_settings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_academic_settings_tenantId_idx"
    ON "school_academic_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "school_academic_settings_schoolYearId_idx"
    ON "school_academic_settings" ("schoolYearId");
CREATE INDEX IF NOT EXISTS "school_academic_settings_tenantId_schoolYearId_idx"
    ON "school_academic_settings" ("tenantId", "schoolYearId");
CREATE INDEX IF NOT EXISTS "school_academic_settings_countryCode_idx"
    ON "school_academic_settings" ("countryCode");
CREATE INDEX IF NOT EXISTS "school_academic_settings_status_idx"
    ON "school_academic_settings" ("status");
CREATE INDEX IF NOT EXISTS "school_academic_settings_isActive_idx"
    ON "school_academic_settings" ("isActive");

-- ============================================================================
-- 3. academic_settings_audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS "academic_settings_audit_logs" (
    "id"         TEXT      NOT NULL,
    "tenantId"   TEXT      NOT NULL,
    "settingsId" TEXT      NOT NULL,
    "userId"     TEXT      NOT NULL,
    "action"     TEXT      NOT NULL,
    "field"      TEXT,
    "oldValue"   JSONB,
    "newValue"   JSONB,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_settings_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "academic_settings_audit_logs_tenantId_settingsId_idx"
    ON "academic_settings_audit_logs" ("tenantId", "settingsId");
CREATE INDEX IF NOT EXISTS "academic_settings_audit_logs_settingsId_idx"
    ON "academic_settings_audit_logs" ("settingsId");
CREATE INDEX IF NOT EXISTS "academic_settings_audit_logs_userId_idx"
    ON "academic_settings_audit_logs" ("userId");

-- ============================================================================
-- 4. evaluations
-- ============================================================================
CREATE TABLE IF NOT EXISTS "evaluations" (
    "id"               TEXT      NOT NULL,
    "tenantId"         TEXT      NOT NULL,
    "academicYearId"   TEXT      NOT NULL,
    "classId"          TEXT      NOT NULL,
    "subjectId"        TEXT      NOT NULL,
    "periodId"         TEXT      NOT NULL,
    "evaluationTypeId" TEXT      NOT NULL,
    "title"            TEXT,
    "evaluationDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxScore"         DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "coefficient"      DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status"           TEXT      NOT NULL DEFAULT 'PLANNED',
    "createdBy"        TEXT,
    "validatedById"    TEXT,
    "validatedAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "evaluations_tenantId_academicYearId_idx"
    ON "evaluations" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "evaluations_classId_idx"
    ON "evaluations" ("classId");
CREATE INDEX IF NOT EXISTS "evaluations_subjectId_idx"
    ON "evaluations" ("subjectId");
CREATE INDEX IF NOT EXISTS "evaluations_periodId_idx"
    ON "evaluations" ("periodId");
CREATE INDEX IF NOT EXISTS "evaluations_status_idx"
    ON "evaluations" ("status");

-- ============================================================================
-- 5. evaluation_types
-- ============================================================================
CREATE TABLE IF NOT EXISTS "evaluation_types" (
    "id"                 TEXT      NOT NULL,
    "tenantId"           TEXT      NOT NULL,
    "name"               TEXT      NOT NULL,
    "defaultMaxScore"    DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "defaultCoefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluation_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_types_tenantId_name_key"
    ON "evaluation_types" ("tenantId", "name");

-- ============================================================================
-- 6. grade_scales
-- ============================================================================
CREATE TABLE IF NOT EXISTS "grade_scales" (
    "id"        TEXT      NOT NULL,
    "tenantId"  TEXT      NOT NULL,
    "minGrade"  DOUBLE PRECISION NOT NULL,
    "maxGrade"  DOUBLE PRECISION,
    "mention"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grade_scales_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "grade_scales_tenantId_idx"
    ON "grade_scales" ("tenantId");

-- ============================================================================
-- 7. exam_calculation_rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS "exam_calculation_rules" (
    "id"          TEXT      NOT NULL,
    "tenantId"    TEXT      NOT NULL,
    "name"        TEXT      NOT NULL,
    "description" TEXT,
    "ruleType"    TEXT      NOT NULL,
    "config"      JSONB     NOT NULL,
    "isActive"    BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_calculation_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_calculation_rules_tenantId_name_key"
    ON "exam_calculation_rules" ("tenantId", "name");
CREATE INDEX IF NOT EXISTS "exam_calculation_rules_tenantId_idx"
    ON "exam_calculation_rules" ("tenantId");

-- ============================================================================
-- 8. grade_validation_batches
-- ============================================================================
CREATE TABLE IF NOT EXISTS "grade_validation_batches" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT      NOT NULL,
    "periodId"       TEXT      NOT NULL,
    "evaluationId"   TEXT      NOT NULL,
    "classId"        TEXT      NOT NULL,
    "subjectId"      TEXT,
    "status"         TEXT      NOT NULL DEFAULT 'PENDING',
    "submittedById"  TEXT      NOT NULL,
    "submittedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById"   TEXT,
    "reviewedAt"     TIMESTAMP(3),
    "reviewComment"  TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grade_validation_batches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "grade_validation_batches_evaluationId_key"
    ON "grade_validation_batches" ("evaluationId");
CREATE INDEX IF NOT EXISTS "grade_validation_batches_tenantId_academicYearId_idx"
    ON "grade_validation_batches" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "grade_validation_batches_status_idx"
    ON "grade_validation_batches" ("status");

-- ============================================================================
-- 9. grade_locks
-- ============================================================================
CREATE TABLE IF NOT EXISTS "grade_locks" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT      NOT NULL,
    "periodId"       TEXT      NOT NULL,
    "classId"        TEXT      NOT NULL,
    "subjectId"      TEXT,
    "lockType"       TEXT      NOT NULL,
    "lockedById"     TEXT      NOT NULL,
    "reason"         TEXT      NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grade_locks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "grade_locks_tenantId_period_class_subject_lockType"
    ON "grade_locks" ("tenantId", "academicYearId", "periodId", "classId", "subjectId", "lockType");
CREATE INDEX IF NOT EXISTS "grade_locks_tenantId_academicYearId_idx"
    ON "grade_locks" ("tenantId", "academicYearId");

-- ============================================================================
-- 10. student_period_averages
-- ============================================================================
CREATE TABLE IF NOT EXISTS "student_period_averages" (
    "id"               TEXT      NOT NULL,
    "tenantId"         TEXT      NOT NULL,
    "academicYearId"   TEXT      NOT NULL,
    "periodId"         TEXT      NOT NULL,
    "studentId"        TEXT      NOT NULL,
    "classId"          TEXT      NOT NULL,
    "totalWeighted"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCoefficient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generalAverage"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classRank"        INTEGER   NOT NULL DEFAULT 0,
    "isPublished"      BOOLEAN   NOT NULL DEFAULT false,
    "calculatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_period_averages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_period_averages_tenantId_academicYearId_periodId_studentId"
    ON "student_period_averages" ("tenantId", "academicYearId", "periodId", "studentId");
CREATE INDEX IF NOT EXISTS "student_period_averages_tenantId_academicYearId_idx"
    ON "student_period_averages" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "student_period_averages_classId_idx"
    ON "student_period_averages" ("classId");

-- ============================================================================
-- 11. student_subject_averages
-- ============================================================================
CREATE TABLE IF NOT EXISTS "student_subject_averages" (
    "id"              TEXT      NOT NULL,
    "tenantId"        TEXT      NOT NULL,
    "academicYearId"  TEXT      NOT NULL,
    "periodId"        TEXT      NOT NULL,
    "studentId"       TEXT      NOT NULL,
    "subjectId"       TEXT      NOT NULL,
    "classId"         TEXT      NOT NULL,
    "average"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coefficient"     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "weightedAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "appreciation"    TEXT,
    "calculatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_subject_averages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_subject_averages_tenantId_academicYearId_periodId_studentId_subjectId"
    ON "student_subject_averages" ("tenantId", "academicYearId", "periodId", "studentId", "subjectId");
CREATE INDEX IF NOT EXISTS "student_subject_averages_tenantId_academicYearId_idx"
    ON "student_subject_averages" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "student_subject_averages_classId_idx"
    ON "student_subject_averages" ("classId");

-- ============================================================================
-- 12. student_council_decisions
-- ============================================================================
CREATE TABLE IF NOT EXISTS "student_council_decisions" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "councilId"      TEXT      NOT NULL,
    "studentId"      TEXT      NOT NULL,
    "decision"       TEXT      NOT NULL,
    "appreciation"   TEXT,
    "recommendation" TEXT,
    "sanctions"      TEXT,
    "decidedById"    TEXT      NOT NULL,
    "decidedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_council_decisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_council_decisions_tenantId_councilId_studentId"
    ON "student_council_decisions" ("tenantId", "councilId", "studentId");
CREATE INDEX IF NOT EXISTS "student_council_decisions_councilId_idx"
    ON "student_council_decisions" ("councilId");
CREATE INDEX IF NOT EXISTS "student_council_decisions_studentId_idx"
    ON "student_council_decisions" ("studentId");

-- ============================================================================
-- 13. academic_audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS "academic_audit_logs" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT,
    "entityType"     TEXT      NOT NULL,
    "entityId"       TEXT,
    "action"         TEXT      NOT NULL,
    "oldValue"       JSONB,
    "newValue"       JSONB,
    "performedById"  TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "academic_audit_logs_tenantId_academicYearId_idx"
    ON "academic_audit_logs" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "academic_audit_logs_entityType_idx"
    ON "academic_audit_logs" ("entityType");

-- ============================================================================
-- 14. grade_correction_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS "grade_correction_requests" (
    "id"        TEXT      NOT NULL,
    "tenantId"  TEXT      NOT NULL,
    "gradeId"   TEXT      NOT NULL,
    "reason"    TEXT      NOT NULL,
    "status"    TEXT      NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grade_correction_requests_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- FK CONSTRAINTs
-- ============================================================================
ALTER TABLE "academic_periods"
    ADD CONSTRAINT "academic_periods_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "academic_periods_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "school_academic_settings"
    ADD CONSTRAINT "school_academic_settings_schoolYearId_fkey"
    FOREIGN KEY ("schoolYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "school_academic_settings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "academic_settings_audit_logs"
    ADD CONSTRAINT "academic_settings_audit_logs_settingsId_fkey"
    FOREIGN KEY ("settingsId") REFERENCES "school_academic_settings"("id") ON DELETE CASCADE;

ALTER TABLE "evaluations"
    ADD CONSTRAINT "evaluations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "evaluations_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
    ADD CONSTRAINT "evaluations_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id"),
    ADD CONSTRAINT "evaluations_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id"),
    ADD CONSTRAINT "evaluations_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "quarters"("id"),
    ADD CONSTRAINT "evaluations_evaluationTypeId_fkey"
    FOREIGN KEY ("evaluationTypeId") REFERENCES "evaluation_types"("id");

ALTER TABLE "evaluation_types"
    ADD CONSTRAINT "evaluation_types_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "grade_scales"
    ADD CONSTRAINT "grade_scales_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "exam_calculation_rules"
    ADD CONSTRAINT "exam_calculation_rules_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "grade_validation_batches"
    ADD CONSTRAINT "grade_validation_batches_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "grade_validation_batches_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
    ADD CONSTRAINT "grade_validation_batches_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id"),
    ADD CONSTRAINT "grade_validation_batches_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "quarters"("id"),
    ADD CONSTRAINT "grade_validation_batches_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id"),
    ADD CONSTRAINT "grade_validation_batches_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id");

ALTER TABLE "grade_locks"
    ADD CONSTRAINT "grade_locks_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "grade_locks_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
    ADD CONSTRAINT "grade_locks_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id"),
    ADD CONSTRAINT "grade_locks_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "quarters"("id"),
    ADD CONSTRAINT "grade_locks_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id"),
    ADD CONSTRAINT "grade_locks_lockedById_fkey"
    FOREIGN KEY ("lockedById") REFERENCES "users"("id");

ALTER TABLE "student_period_averages"
    ADD CONSTRAINT "student_period_averages_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "student_period_averages_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
    ADD CONSTRAINT "student_period_averages_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id"),
    ADD CONSTRAINT "student_period_averages_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "quarters"("id"),
    ADD CONSTRAINT "student_period_averages_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;

ALTER TABLE "student_subject_averages"
    ADD CONSTRAINT "student_subject_averages_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "student_subject_averages_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
    ADD CONSTRAINT "student_subject_averages_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id"),
    ADD CONSTRAINT "student_subject_averages_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "quarters"("id"),
    ADD CONSTRAINT "student_subject_averages_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "student_subject_averages_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id");

ALTER TABLE "student_council_decisions"
    ADD CONSTRAINT "student_council_decisions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "student_council_decisions_councilId_fkey"
    FOREIGN KEY ("councilId") REFERENCES "class_councils"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "student_council_decisions_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "student_council_decisions_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "users"("id");

ALTER TABLE "academic_audit_logs"
    ADD CONSTRAINT "academic_audit_logs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "academic_audit_logs_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id"),
    ADD CONSTRAINT "academic_audit_logs_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "users"("id");

ALTER TABLE "grade_correction_requests"
    ADD CONSTRAINT "grade_correction_requests_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "grade_correction_requests_gradeId_fkey"
    FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE CASCADE;
