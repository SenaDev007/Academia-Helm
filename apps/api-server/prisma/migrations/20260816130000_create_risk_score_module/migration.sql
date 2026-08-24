-- ============================================================================
-- Migration : Module Risk Score (Score de risque croisé Directeur)
-- ============================================================================
--
-- Contexte :
-- Le Directeur a besoin d'une vue globale croisant 3 signaux par élève :
--   1. Conduite (Vie Scolaire — conduct_ledger)
--   2. Pédagogie (Censeur — StudentPeriodAverage)
--   3. Assiduité (Présences — AttendanceRecord)
--
-- Ce score est le différenciateur central face à SuccèsSco et Pronote,
-- aucun des deux ne croise ces données au niveau élève.
--
-- Tables créées :
--   1. student_risk_scores : cache des scores calculés (par élève + trimestre)
--   2. risk_score_settings : configuration des pondérations et seuils (par tenant)
-- ============================================================================

-- ============================================================================
-- 1. student_risk_scores — Cache des scores calculés par élève + trimestre
-- ============================================================================
CREATE TABLE IF NOT EXISTS "student_risk_scores" (
    "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"             TEXT NOT NULL,
    "academicYearId"       TEXT NOT NULL,
    "quarterId"            TEXT NOT NULL,
    "studentId"            TEXT NOT NULL,

    -- Scores par dimension (0-40, 0-40, 0-20)
    "conductScore"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pedagogyScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attendanceScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Score total (0-100)
    "totalScore"           DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Catégorie calculée
    "riskLevel"            TEXT NOT NULL DEFAULT 'LOW',  -- LOW | MODERATE | HIGH | CRITICAL

    -- Indicateur de décrochage (true si dégradation vs trimestre précédent)
    "dropoutRiskFlag"      BOOLEAN NOT NULL DEFAULT false,

    -- Données sources (pour audit + transparence)
    "sourceData"           JSONB,
    -- Exemple : {
    --   "conduct": { "reference": 20, "deducted": 5, "final": 15, "sanctionCount": 3 },
    --   "pedagogy": { "generalAverage": 8.5, "classAverage": 11.2, "rank": 28, "classSize": 32 },
    --   "attendance": { "totalDays": 45, "absent": 5, "late": 8, "excused": 2, "absenceRate": 0.111, "lateRate": 0.178 }
    -- }

    -- Différence vs trimestre précédent (pour détecter dégradation)
    "previousQuarterScore" DOUBLE PRECISION,
    "scoreDelta"           DOUBLE PRECISION,  -- totalScore - previousQuarterScore (négatif = dégradation)

    "calculatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
    "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT "fk_student_risk_scores_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_student_risk_scores_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_student_risk_scores_year" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_student_risk_scores_quarter" FOREIGN KEY ("quarterId") REFERENCES "quarters"("id") ON DELETE CASCADE
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS "student_risk_scores_tenant_year_quarter_idx"
    ON "student_risk_scores"("tenantId", "academicYearId", "quarterId");
CREATE INDEX IF NOT EXISTS "student_risk_scores_student_idx"
    ON "student_risk_scores"("studentId");
CREATE INDEX IF NOT EXISTS "student_risk_scores_riskLevel_idx"
    ON "student_risk_scores"("riskLevel");
CREATE INDEX IF NOT EXISTS "student_risk_scores_dropout_idx"
    ON "student_risk_scores"("dropoutRiskFlag") WHERE "dropoutRiskFlag" = true;

-- Un seul score par élève + trimestre (upsert)
CREATE UNIQUE INDEX IF NOT EXISTS "student_risk_scores_unique_idx"
    ON "student_risk_scores"("tenantId", "studentId", "quarterId");

-- ============================================================================
-- 2. risk_score_settings — Configuration des pondérations et seuils par tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS "risk_score_settings" (
    "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"             TEXT NOT NULL UNIQUE,

    -- Pondérations des 3 dimensions (doivent sommer à 100)
    "conductWeight"        INTEGER NOT NULL DEFAULT 40,    -- 0-100
    "pedagogyWeight"       INTEGER NOT NULL DEFAULT 40,    -- 0-100
    "attendanceWeight"     INTEGER NOT NULL DEFAULT 20,    -- 0-100

    -- Seuils de catégorisation (en points sur 100)
    "lowThreshold"         INTEGER NOT NULL DEFAULT 20,    -- 0-19 = LOW
    "moderateThreshold"    INTEGER NOT NULL DEFAULT 40,    -- 20-39 = MODERATE
    "highThreshold"        INTEGER NOT NULL DEFAULT 70,    -- 40-69 = HIGH
                                                            -- 70+ = CRITICAL

    -- Seuils d'alerte décrochage
    "dropoutScoreDeltaThreshold" DOUBLE PRECISION NOT NULL DEFAULT 10,  -- dégradation > 10 pts vs N-1
    "dropoutAbsenceRateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15, -- > 15% d'absences
    "dropoutConductDropThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5,   -- conduite baisse de 5+ pts

    -- Référence pédagogique (moyenne attendue, ex: 10/20)
    "pedagogyReferenceAverage" DOUBLE PRECISION NOT NULL DEFAULT 10,

    "isEnabled"            BOOLEAN NOT NULL DEFAULT true,
    "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT "fk_risk_score_settings_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- Insérer une config par défaut pour tous les tenants existants
INSERT INTO "risk_score_settings" ("tenantId")
SELECT "id" FROM "tenants"
WHERE "id" NOT IN (SELECT "tenantId" FROM "risk_score_settings")
ON CONFLICT ("tenantId") DO NOTHING;
