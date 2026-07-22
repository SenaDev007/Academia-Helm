-- ============================================================================
-- Cahier du Semainier — Tables de configuration et rapports journaliers
--
-- Tables requises par PedagogicalSpaceService (méthodes getSeminarConfigs,
-- autoGenerateSeminarConfigs, updateSeminarConfig, getOrCreateDailyReport,
-- updateDailyReport).
--
-- Structure conforme au document officiel (222 pages, 36 semaines × 6 pages) :
--  - weekly_seminar_config : une entrée par semaine (1..36), avec rotation
--    automatique des enseignants (PROMOTER/DIRECTOR), trimestre (1/2/3), et
--    statut (PENDING / FILLED / SUBMITTED / VALIDATED / REJECTED).
--  - weekly_seminar_daily_report : une entrée par jour (Lun..Ven) avec les
--    8 sections officielles : (1) Présence enseignants, (2) Présence élèves,
--    (3) Pédagogie / respect programme, (4) Discipline, (5) Hygiène,
--    (6) Visites, (7) Communication, (8) Résumé journalier.
-- ============================================================================

-- 1. Configuration du Cahier du Semainier (une entrée par semaine)
CREATE TABLE IF NOT EXISTS "weekly_seminar_config" (
    "id"               TEXT              NOT NULL,
    "tenantId"         TEXT              NOT NULL,
    "academicYearId"   TEXT              NOT NULL,
    "weekNumber"       INTEGER           NOT NULL,
    "trimester"        INTEGER           NOT NULL DEFAULT 1,
    "weekStartDate"    DATE              NOT NULL,
    "weekEndDate"      DATE              NOT NULL,
    "teacherId"        TEXT,
    "classIds"         JSONB             NOT NULL DEFAULT '[]'::jsonb,
    "status"           TEXT              NOT NULL DEFAULT 'PENDING',
    "teacherSignature" TEXT,
    "directorSignature" TEXT,
    "rejectionReason"  TEXT,
    "submittedAt"      TIMESTAMP(3),
    "validatedAt"      TIMESTAMP(3),
    "validatedBy"      TEXT,
    "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "weekly_seminar_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_seminar_config_tenant_year_week_key"
    ON "weekly_seminar_config" ("tenantId", "academicYearId", "weekNumber");

CREATE INDEX IF NOT EXISTS "weekly_seminar_config_tenant_year_idx"
    ON "weekly_seminar_config" ("tenantId", "academicYearId");

CREATE INDEX IF NOT EXISTS "weekly_seminar_config_teacher_idx"
    ON "weekly_seminar_config" ("teacherId");

CREATE INDEX IF NOT EXISTS "weekly_seminar_config_status_idx"
    ON "weekly_seminar_config" ("status");

-- 2. Rapport journalier (8 sections, Lun..Ven = 5 jours par semaine)
CREATE TABLE IF NOT EXISTS "weekly_seminar_daily_report" (
    "id"                          TEXT              NOT NULL,
    "tenantId"                    TEXT              NOT NULL,
    "academicYearId"              TEXT              NOT NULL,
    "seminarConfigId"             TEXT              NOT NULL,
    "dayOfWeek"                   INTEGER           NOT NULL,
    "date"                        DATE              NOT NULL,

    -- Section 1 : Présence enseignants
    "teacherAttendance"           JSONB,
    "teacherAttendanceSynthesis"  TEXT,

    -- Section 2 : Présence élèves
    "studentPresence"             JSONB,

    -- Section 3 : Pédagogie / respect du programme
    "pedagogy"                    JSONB,

    -- Section 4 : Discipline
    "discipline"                  JSONB,

    -- Section 5 : Hygiène
    "hygiene"                     JSONB,

    -- Section 6 : Visites (admin, pédago, parent)
    "visits"                      JSONB,

    -- Section 7 : Communication
    "communication"               JSONB,

    -- Section 8 : Résumé journalier
    "dailySummary"                JSONB,

    "filledBy"                    TEXT,
    "createdAt"                   TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "weekly_seminar_daily_report_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "weekly_seminar_daily_report_config_day_key"
        UNIQUE ("seminarConfigId", "dayOfWeek")
);

CREATE INDEX IF NOT EXISTS "weekly_seminar_daily_report_tenant_year_idx"
    ON "weekly_seminar_daily_report" ("tenantId", "academicYearId");

CREATE INDEX IF NOT EXISTS "weekly_seminar_daily_report_config_idx"
    ON "weekly_seminar_daily_report" ("seminarConfigId");

CREATE INDEX IF NOT EXISTS "weekly_seminar_daily_report_date_idx"
    ON "weekly_seminar_daily_report" ("date");

-- 3. Rapport hebdomadaire (synthèse de fin de semaine)
-- Table预留 pour la Phase 7 (synthèse hebdo + statistiques + signatures).
CREATE TABLE IF NOT EXISTS "weekly_seminar_weekly_report" (
    "id"                     TEXT              NOT NULL,
    "tenantId"               TEXT              NOT NULL,
    "academicYearId"         TEXT              NOT NULL,
    "seminarConfigId"        TEXT              NOT NULL,
    "weekNumber"             INTEGER           NOT NULL,

    -- Section 1 : Statistiques présence enseignants (synthèse)
    "staffAttendanceStats"   JSONB,

    -- Section 2 : Statistiques présence élèves
    "studentAttendanceStats" JSONB,

    -- Section 3 : Bilan pédagogique
    "pedagogySummary"        TEXT,

    -- Section 4 : Bilan discipline
    "disciplineSummary"      TEXT,

    -- Section 5 : Bilan hygiène
    "hygieneSummary"         TEXT,

    -- Section 6 : Visites et communications
    "visitsAndCommsSummary"  TEXT,

    -- Section 7 : Recommandations
    "recommendations"        TEXT,

    -- Signatures
    "teacherSignature"       TEXT,
    "directorSignature"      TEXT,
    "filledBy"               TEXT,
    "submittedAt"            TIMESTAMP(3),
    "validatedAt"            TIMESTAMP(3),
    "validatedBy"            TEXT,

    "createdAt"              TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "weekly_seminar_weekly_report_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "weekly_seminar_weekly_report_config_key"
        UNIQUE ("seminarConfigId")
);

CREATE INDEX IF NOT EXISTS "weekly_seminar_weekly_report_tenant_year_idx"
    ON "weekly_seminar_weekly_report" ("tenantId", "academicYearId");

CREATE INDEX IF NOT EXISTS "weekly_seminar_weekly_report_config_idx"
    ON "weekly_seminar_weekly_report" ("seminarConfigId");

-- ============================================================================
-- Contraintes FK (ajoutées après création des tables pour permettre la
-- restauration depuis un dump même si l'ordre n'est pas respecté).
-- ============================================================================
ALTER TABLE "weekly_seminar_daily_report"
    ADD CONSTRAINT "weekly_seminar_daily_report_seminarConfigId_fkey"
    FOREIGN KEY ("seminarConfigId") REFERENCES "weekly_seminar_config"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_seminar_weekly_report"
    ADD CONSTRAINT "weekly_seminar_weekly_report_seminarConfigId_fkey"
    FOREIGN KEY ("seminarConfigId") REFERENCES "weekly_seminar_config"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
