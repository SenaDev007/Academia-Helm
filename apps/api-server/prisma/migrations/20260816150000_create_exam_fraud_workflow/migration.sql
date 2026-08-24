-- ============================================================================
-- Migration : Module Exam Fraud (Fraudes aux examens — workflow séparé)
-- ============================================================================
--
-- Contexte :
-- La spec dit : "Fraudes examens traitées dans un workflow distinct des
-- sanctions comportementales, avec sa propre sanction pédagogique
-- (annulation de note, reprise d'évaluation)."
--
-- Ce workflow est géré par le CENSEUR (pas le Surveillant Général).
-- Il est séparé du module Discipline (sanctions comportementales).
--
-- Tables créées :
--   1. exam_frauds : déclaration de fraude (élève + évaluation + description)
--   2. exam_fraud_sanctions : sanction pédagogique (annulation note, reprise, etc.)
-- ============================================================================

-- ============================================================================
-- 1. exam_frauds — Déclaration de fraude aux examens
-- ============================================================================
CREATE TABLE IF NOT EXISTS "exam_frauds" (
    "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"             TEXT NOT NULL,
    "academicYearId"       TEXT NOT NULL,
    "studentId"            TEXT NOT NULL,
    "evaluationId"         TEXT,
    "examId"               TEXT,
    "classId"              TEXT,
    "subjectId"            TEXT,
    "quarterId"            TEXT,

    -- Description de la fraude
    "fraudType"            TEXT NOT NULL,  -- COPYING | CHEAT_SHEET | IMPERSONATION | PHONE | COMMUNICATION | OTHER
    "description"          TEXT NOT NULL,
    "witnesses"            TEXT,           -- témoins (texte libre)
    "evidencePhotoUrl"     TEXT,           -- preuve photo (URL)
    "severity"             TEXT NOT NULL DEFAULT 'MAJOR',  -- MINOR | MAJOR | CRITICAL

    -- Statut du workflow
    "status"               TEXT NOT NULL DEFAULT 'REPORTED',  -- REPORTED | INVESTIGATING | SANCTIONED | APPEALED | CLOSED
    "reportedById"         TEXT NOT NULL,  -- censeur qui a déclaré la fraude
    "reportedAt"           TIMESTAMP NOT NULL DEFAULT now(),

    -- Investigation
    "investigatedById"     TEXT,
    "investigationNotes"   TEXT,
    "investigatedAt"       TIMESTAMP,

    -- Sanction appliquée (lien vers exam_fraud_sanctions)
    "sanctionId"           TEXT,

    -- Dates
    "incidentDate"         TIMESTAMP,     -- date de l'incident (pas forcément = reportedAt)
    "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT "fk_exam_frauds_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_exam_frauds_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_exam_frauds_year" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_frauds_tenant_year_idx" ON "exam_frauds"("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "exam_frauds_student_idx" ON "exam_frauds"("studentId");
CREATE INDEX IF NOT EXISTS "exam_frauds_status_idx" ON "exam_frauds"("status");
CREATE INDEX IF NOT EXISTS "exam_frauds_reportedAt_idx" ON "exam_frauds"("reportedAt" DESC);

-- ============================================================================
-- 2. exam_fraud_sanctions — Sanctions pédagogiques (distinctes des sanctions
--    comportementales du module Discipline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "exam_fraud_sanctions" (
    "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"             TEXT NOT NULL,
    "examFraudId"          TEXT NOT NULL,
    "studentId"            TEXT NOT NULL,

    -- Type de sanction pédagogique
    "sanctionType"         TEXT NOT NULL,  -- GRADE_NULLIFIED | RETAKE_EXAM | ZERO | WARNING | PARENT_SUMMONS
    "description"          TEXT,

    -- Détails (ex: nouvelle date de reprise, matière concernée)
    "newExamDate"          TIMESTAMP,      -- pour RETAKE_EXAM
    "nullifiedGrade"       DOUBLE PRECISION, -- pour GRADE_NULLIFIED (note remplacée par 0)

    -- Décision
    "decidedById"          TEXT NOT NULL,  -- censeur ou directeur
    "decidedAt"            TIMESTAMP NOT NULL DEFAULT now(),
    "approvedById"         TEXT,           -- directeur (validation si sanction grave)
    "approvedAt"           TIMESTAMP,

    "status"               TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | EXECUTED | CANCELLED
    "executedAt"           TIMESTAMP,

    "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT "fk_exam_fraud_sanctions_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_exam_fraud_sanctions_fraud" FOREIGN KEY ("examFraudId") REFERENCES "exam_frauds"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_exam_fraud_sanctions_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_fraud_sanctions_tenant_idx" ON "exam_fraud_sanctions"("tenantId");
CREATE INDEX IF NOT EXISTS "exam_fraud_sanctions_student_idx" ON "exam_fraud_sanctions"("studentId");
CREATE INDEX IF NOT EXISTS "exam_fraud_sanctions_fraud_idx" ON "exam_fraud_sanctions"("examFraudId");
CREATE INDEX IF NOT EXISTS "exam_fraud_sanctions_status_idx" ON "exam_fraud_sanctions"("status");

-- Lier exam_frauds.sanctionId vers exam_fraud_sanctions.id
ALTER TABLE "exam_frauds"
    ADD CONSTRAINT "fk_exam_frauds_sanction" FOREIGN KEY ("sanctionId") REFERENCES "exam_fraud_sanctions"("id") ON DELETE SET NULL;
