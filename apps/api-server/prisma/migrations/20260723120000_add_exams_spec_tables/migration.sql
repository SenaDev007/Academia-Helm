-- ============================================================================
-- Phase 2 — Tables spec manquantes pour onglets 2, 6, 7, 9
-- ============================================================================
--
-- Tables créées :
--   1. qualitative_scales          — échelles qualitatives maternelle (TS/S/PS/NS)
--   2. level_evaluation_policies   — politique d'évaluation par niveau (MATERNELLE=qualitative, PRIMAIRE=coef 1, SECONDAIRE=coef)
--   3. bilingual_pedagogy_policies — politique bilingue pédagogique FR/EN
--   4. bulletin_templates          — modèles de bulletins PDF
--   5. bulletin_publication_policies — politiques de publication
--   6. exam_advanced_settings      — paramètres avancés (arrondis, ex aequo, blocage finance)
--   7. academic_mention_rules      — règles de mentions (echelle configurable)
--   8. academic_decision_rules     — règles de décisions (admis, redouble, etc.)
--   9. academic_analytics_snapshots — snapshots analytique (pour stats historisées)
-- ============================================================================

-- 1. qualitative_scales
CREATE TABLE IF NOT EXISTS "qualitative_scales" (
    "id"        TEXT      NOT NULL,
    "tenantId"  TEXT      NOT NULL,
    "code"      TEXT      NOT NULL,
    "label"     TEXT      NOT NULL,
    "rank"      INTEGER   NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN   NOT NULL DEFAULT false,
    "isActive"  BOOLEAN   NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "qualitative_scales_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "qualitative_scales_tenantId_code_key"
    ON "qualitative_scales" ("tenantId", "code");

-- 2. level_evaluation_policies
CREATE TABLE IF NOT EXISTS "level_evaluation_policies" (
    "id"                      TEXT      NOT NULL,
    "tenantId"                TEXT      NOT NULL,
    "academicYearId"          TEXT      NOT NULL,
    "schoolStage"             TEXT      NOT NULL,
    "levelId"                 TEXT,
    "classId"                 TEXT,
    "seriesId"                TEXT,
    "evaluationMode"          TEXT      NOT NULL,
    "defaultCoefficient"      DOUBLE PRECISION,
    "qualitativeScaleId"      TEXT,
    "calculationRuleId"       TEXT,
    "defaultEvaluationCount"  INTEGER,
    "isActive"                BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,
    CONSTRAINT "level_evaluation_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "level_evaluation_policies_tenant_academicYear_idx"
    ON "level_evaluation_policies" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "level_evaluation_policies_stage_level_class_series_idx"
    ON "level_evaluation_policies" ("schoolStage", "levelId", "classId", "seriesId");

-- 3. bilingual_pedagogy_policies
CREATE TABLE IF NOT EXISTS "bilingual_pedagogy_policies" (
    "id"                                TEXT      NOT NULL,
    "tenantId"                          TEXT      NOT NULL,
    "academicYearId"                    TEXT,
    "isEnabled"                         BOOLEAN   NOT NULL DEFAULT false,
    "allowFrenchSubjects"               BOOLEAN   NOT NULL DEFAULT true,
    "allowEnglishSubjects"              BOOLEAN   NOT NULL DEFAULT true,
    "allowBilingualSubjects"            BOOLEAN   NOT NULL DEFAULT true,
    "separateLanguageAverages"          BOOLEAN   NOT NULL DEFAULT false,
    "showLanguageSectionsOnBulletin"    BOOLEAN   NOT NULL DEFAULT true,
    "allowBilingualAppreciations"       BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"                         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bilingual_pedagogy_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bilingual_pedagogy_policies_tenant_academicYear_idx"
    ON "bilingual_pedagogy_policies" ("tenantId", "academicYearId");

-- 4. bulletin_templates
CREATE TABLE IF NOT EXISTS "bulletin_templates" (
    "id"          TEXT      NOT NULL,
    "tenantId"    TEXT      NOT NULL,
    "name"        TEXT      NOT NULL,
    "levelId"     TEXT,
    "classId"     TEXT,
    "seriesId"    TEXT,
    "language"    TEXT      NOT NULL DEFAULT 'FR',
    "layoutJson"  JSONB     NOT NULL,
    "isDefault"   BOOLEAN   NOT NULL DEFAULT false,
    "isActive"    BOOLEAN   NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bulletin_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bulletin_templates_tenant_level_class_series_idx"
    ON "bulletin_templates" ("tenantId", "levelId", "classId", "seriesId");

-- 5. bulletin_publication_policies
CREATE TABLE IF NOT EXISTS "bulletin_publication_policies" (
    "id"                       TEXT      NOT NULL,
    "tenantId"                 TEXT      NOT NULL,
    "academicYearId"           TEXT,
    "requireGradeValidation"   BOOLEAN   NOT NULL DEFAULT true,
    "requireClassCouncil"      BOOLEAN   NOT NULL DEFAULT true,
    "requireDirectorApproval"  BOOLEAN   NOT NULL DEFAULT true,
    "blockIfFinanceDebt"       BOOLEAN   NOT NULL DEFAULT false,
    "allowParentDownload"      BOOLEAN   NOT NULL DEFAULT true,
    "allowStudentDownload"     BOOLEAN   NOT NULL DEFAULT false,
    "publicationMode"          TEXT      NOT NULL DEFAULT 'MANUAL',
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bulletin_publication_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bulletin_publication_policies_tenant_academicYear_idx"
    ON "bulletin_publication_policies" ("tenantId", "academicYearId");

-- 6. exam_advanced_settings
CREATE TABLE IF NOT EXISTS "exam_advanced_settings" (
    "id"                                  TEXT      NOT NULL,
    "tenantId"                            TEXT      NOT NULL,
    "academicYearId"                      TEXT,
    "allowTeacherGradeEditAfterSubmit"    BOOLEAN   NOT NULL DEFAULT false,
    "allowGradeCorrectionAfterLock"       BOOLEAN   NOT NULL DEFAULT false,
    "requireCorrectionApproval"           BOOLEAN   NOT NULL DEFAULT true,
    "allowExcelImport"                    BOOLEAN   NOT NULL DEFAULT true,
    "allowExcelExport"                    BOOLEAN   NOT NULL DEFAULT true,
    "roundingPrecision"                   INTEGER   NOT NULL DEFAULT 2,
    "roundingMode"                        TEXT      NOT NULL DEFAULT 'HALF_UP',
    "showClassAverageOnBulletin"          BOOLEAN   NOT NULL DEFAULT true,
    "showSubjectRankOnBulletin"           BOOLEAN   NOT NULL DEFAULT true,
    "showGeneralRankOnBulletin"           BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"                           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_advanced_settings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "exam_advanced_settings_tenant_academicYear_idx"
    ON "exam_advanced_settings" ("tenantId", "academicYearId");

-- 7. academic_mention_rules
CREATE TABLE IF NOT EXISTS "academic_mention_rules" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT,
    "name"           TEXT      NOT NULL,
    "minAverage"     DOUBLE PRECISION NOT NULL,
    "maxAverage"     DOUBLE PRECISION NOT NULL,
    "appreciation"   TEXT,
    "language"       TEXT      NOT NULL DEFAULT 'FR',
    "isActive"       BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "academic_mention_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "academic_mention_rules_tenant_academicYear_idx"
    ON "academic_mention_rules" ("tenantId", "academicYearId");

-- 8. academic_decision_rules
CREATE TABLE IF NOT EXISTS "academic_decision_rules" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT,
    "code"           TEXT      NOT NULL,
    "label"          TEXT      NOT NULL,
    "description"    TEXT,
    "minAverage"     DOUBLE PRECISION,
    "maxAverage"     DOUBLE PRECISION,
    "requiresCouncil" BOOLEAN   NOT NULL DEFAULT true,
    "isPositive"     BOOLEAN   NOT NULL DEFAULT false,
    "isActive"       BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "academic_decision_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "academic_decision_rules_tenantId_code_key"
    ON "academic_decision_rules" ("tenantId", "code");

-- 9. academic_analytics_snapshots
CREATE TABLE IF NOT EXISTS "academic_analytics_snapshots" (
    "id"             TEXT      NOT NULL,
    "tenantId"       TEXT      NOT NULL,
    "academicYearId" TEXT      NOT NULL,
    "periodId"       TEXT,
    "scopeType"      TEXT      NOT NULL,
    "scopeId"        TEXT,
    "dataJson"       JSONB     NOT NULL,
    "calculatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "academic_analytics_snapshots_tenant_academicYear_period_idx"
    ON "academic_analytics_snapshots" ("tenantId", "academicYearId", "periodId");
