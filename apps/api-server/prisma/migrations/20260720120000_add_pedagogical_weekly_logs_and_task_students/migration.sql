-- ============================================================================
-- Espace Pédagogique — Tables pour le semainier et le suivi des devoirs par élève
-- ============================================================================

-- 1. Cahier du semainier (vue hebdomadaire, soumission au directeur)
CREATE TABLE IF NOT EXISTS "pedagogical_weekly_logs" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "teacherId"       TEXT              NOT NULL,
    "classId"         TEXT,
    "weekStartDate"   DATE              NOT NULL,
    "weekEndDate"     DATE              NOT NULL,
    "status"          TEXT              NOT NULL DEFAULT 'DRAFT',
    "summary"         TEXT,
    "submittedAt"     TIMESTAMP(3),
    "validatedAt"     TIMESTAMP(3),
    "validatedBy"     TEXT,
    "rejectionReason" TEXT,
    "classLogIds"     TEXT[]            NOT NULL DEFAULT '{}',
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "pedagogical_weekly_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pedagogical_weekly_logs_teacherId_classId_weekStart_key"
    ON "pedagogical_weekly_logs" ("teacherId", "classId", "weekStartDate");

CREATE INDEX IF NOT EXISTS "pedagogical_weekly_logs_tenant_year_teacher_idx"
    ON "pedagogical_weekly_logs" ("tenantId", "academicYearId", "teacherId");

CREATE INDEX IF NOT EXISTS "pedagogical_weekly_logs_status_idx"
    ON "pedagogical_weekly_logs" ("status");

-- 2. Suivi par élève des devoirs/activités pédagogiques
CREATE TABLE IF NOT EXISTS "pedagogical_task_students" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "homeworkEntryId" TEXT              NOT NULL,
    "studentId"       TEXT              NOT NULL,
    "teacherId"       TEXT              NOT NULL,
    "status"          TEXT              NOT NULL DEFAULT 'PENDING',
    "score"           DOUBLE PRECISION,
    "appreciation"    TEXT,
    "observation"     TEXT,
    "submittedAt"     TIMESTAMP(3),
    "evaluatedAt"     TIMESTAMP(3),
    "parentNotified"  BOOLEAN           NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "pedagogical_task_students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pedagogical_task_students_homework_student_key"
    ON "pedagogical_task_students" ("homeworkEntryId", "studentId");

CREATE INDEX IF NOT EXISTS "pedagogical_task_students_tenant_year_student_idx"
    ON "pedagogical_task_students" ("tenantId", "academicYearId", "studentId");

CREATE INDEX IF NOT EXISTS "pedagogical_task_students_homework_idx"
    ON "pedagogical_task_students" ("homeworkEntryId");

CREATE INDEX IF NOT EXISTS "pedagogical_task_students_teacher_idx"
    ON "pedagogical_task_students" ("teacherId");
