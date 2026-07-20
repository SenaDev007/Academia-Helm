-- ============================================================================
-- Cahier de Semaine — Tables pour les rapports journaliers et synthèses hebdo
-- ============================================================================

-- 1. Rapport journalier (8 sections par jour, Lundi à Vendredi)
CREATE TABLE IF NOT EXISTS "weekly_log_daily_reports" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "weeklyLogId"     TEXT,
    "weekNumber"      INTEGER           NOT NULL,
    "trimester"       INTEGER           NOT NULL,
    "dayOfWeek"       INTEGER           NOT NULL,
    "reportDate"      DATE              NOT NULL,

    "staffAttendance"        JSONB,
    "staffSummary"           TEXT,

    "studentAttendanceRate"  DOUBLE PRECISION,
    "highAbsenceClasses"     TEXT,
    "parentNotifiedAbsences" TEXT,
    "lateCount"              INTEGER,
    "specialCases"           TEXT,

    "scheduleRespected"      TEXT,
    "modifiedCourses"        TEXT,
    "remarkableActivities"   TEXT,
    "classClimate"           TEXT,

    "positiveBehaviors"      TEXT,
    "problematicBehaviors"   TEXT,
    "correctiveMeasures"    TEXT,

    "roomCleanliness"        TEXT,
    "toiletsCondition"       TEXT,
    "waterStatus"            TEXT,
    "electricityStatus"      TEXT,
    "urgentRepairs"          TEXT,

    "adminVisit"             BOOLEAN           NOT NULL DEFAULT false,
    "pedagoVisit"            BOOLEAN           NOT NULL DEFAULT false,
    "parentVisit"            BOOLEAN           NOT NULL DEFAULT false,
    "visitDetails"           TEXT,

    "directorInstructions"   TEXT,
    "urgentNeeds"            TEXT,

    "strengths"              TEXT,
    "improvements"           TEXT,
    "recommendations"        TEXT,

    "status"                 TEXT              NOT NULL DEFAULT 'DRAFT',
    "filledBy"               TEXT,
    "createdAt"              TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "weekly_log_daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_log_daily_reports_tenant_year_week_day_key"
    ON "weekly_log_daily_reports" ("tenantId", "academicYearId", "weekNumber", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "weekly_log_daily_reports_tenant_year_week_idx"
    ON "weekly_log_daily_reports" ("tenantId", "academicYearId", "weekNumber");

CREATE INDEX IF NOT EXISTS "weekly_log_daily_reports_date_idx"
    ON "weekly_log_daily_reports" ("reportDate");

-- 2. Rapport de fin de semaine (7 sections, validé par le directeur)
CREATE TABLE IF NOT EXISTS "weekly_log_summaries" (
    "id"              TEXT              NOT NULL,
    "tenantId"        TEXT              NOT NULL,
    "academicYearId"  TEXT              NOT NULL,
    "weekNumber"      INTEGER           NOT NULL,
    "trimester"       INTEGER           NOT NULL,
    "weekStartDate"   DATE              NOT NULL,
    "weekEndDate"     DATE              NOT NULL,

    "globalLevel"           TEXT,
    "generalObservations"   TEXT,

    "scheduleRespect"         TEXT,
    "engagedTeachers"         TEXT,
    "recurringDifficulties"  TEXT,

    "studentBehavior"     TEXT,
    "specialFollowUp"     TEXT,

    "criticalPoints"      TEXT,
    "urgentInterventions" TEXT,

    "weeklyVisits"             TEXT,
    "visitorRecommendations"   TEXT,

    "weeklyStats"      JSONB,

    "priorityActions"  TEXT,

    "status"           TEXT              NOT NULL DEFAULT 'DRAFT',
    "submittedAt"      TIMESTAMP(3),
    "validatedAt"      TIMESTAMP(3),
    "validatedBy"      TEXT,
    "rejectionReason"  TEXT,
    "filledBy"         TEXT,
    "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "weekly_log_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_log_summaries_tenant_year_week_key"
    ON "weekly_log_summaries" ("tenantId", "academicYearId", "weekNumber");

CREATE INDEX IF NOT EXISTS "weekly_log_summaries_tenant_year_idx"
    ON "weekly_log_summaries" ("tenantId", "academicYearId");

CREATE INDEX IF NOT EXISTS "weekly_log_summaries_status_idx"
    ON "weekly_log_summaries" ("status");
