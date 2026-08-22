-- ⭐ Planification pédagogique MENSUELLE — table monthly_plans
--    Permet à chaque enseignant de planifier son mois pour sa classe, en se
--    basant sur la planification annuelle officielle (annual_plans) comme source.
--
--    Structure :
--    - Une ligne = une activité pédagogique hebdomadaire pour 1 semaine du mois
--    - weekNumber : 1, 2, 3, 4, 5 (semaine du mois)
--    - domain : "Français", "Mathématiques", etc. (primaire) OU domaine maternelle
--    - subDomain : "Lecture", "Écriture", etc. (optionnel, principalement maternelle)
--    - activityType : "SA" | "SEQUENCE" | "U" | "D" | null
--      (SA = Situation d'Apprentissage, U = Unité, D = Dossier)
--    - activityNumber : 1, 2, 3, etc. (ex: SA1, SA2, U1, U2, D1, D2)
--    - sequenceNumber : numéro de séquence dans la SA (1-N)
--    - content : description de l'activité
--    - isAutoProposed : true = proposé automatiquement depuis annual_plans
--    - isCustom : true = modifié par l'enseignant (ne sera pas écrasé par auto-propose)
--
--    ⭐ Relation avec annual_plans : annual_plan_id (FK optionnelle) pour tracer
--      l'origine de la planification mensuelle (auto-proposée depuis la planif annuelle).
--      Si annual_plan_id est NULL → planification mensuelle créée manuellement.

CREATE TABLE IF NOT EXISTS "monthly_plans" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "schoolLevelId"   TEXT NOT NULL,
    "classLevel"      TEXT NOT NULL,           -- "MATERNELLE_GRANDS" | "CI" | "CP" | "CE1" | "CE2" | "CM1" | "CM2"
    "teacherId"       TEXT,                    -- l'enseignant qui crée la planif (peut être null si direction)
    "academicClassId" TEXT,                    -- la classe physique (ex: "CM2 A")
    "trimester"       INTEGER NOT NULL,        -- 1, 2, 3
    "month"           TEXT NOT NULL,            -- "Septembre", "Octobre", ..., "Juin"
    "weekNumber"      INTEGER NOT NULL,        -- 1, 2, 3, 4, 5 (semaine du mois)
    "domain"          TEXT NOT NULL,            -- ex: "Français", "Mathématiques", "Education pour la santé"
    "subDomain"       TEXT,                    -- ex: "Lecture", "Passage aux toilettes"
    "activityType"    TEXT,                    -- "SA" | "SEQUENCE" | "U" | "D" | null
    "activityNumber"  INTEGER,                 -- 1, 2, 3 (ex: SA1 → activityType="SA", activityNumber=1)
    "sequenceNumber"  INTEGER,                 -- numéro de séquence (1-N) dans une SA
    "content"         TEXT NOT NULL,           -- description de l'activité pédagogique
    "isAutoProposed"  BOOLEAN NOT NULL DEFAULT false,  -- true = proposé depuis annual_plans
    "isCustom"        BOOLEAN NOT NULL DEFAULT false,  -- true = modifié par enseignant
    "annualPlanId"    TEXT,                    -- FK optionnelle vers annual_plans.id
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id")
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS "monthly_plans_tenant_academicYear_idx"
    ON "monthly_plans" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "monthly_plans_teacher_class_idx"
    ON "monthly_plans" ("tenantId", "teacherId", "classLevel", "month");
CREATE INDEX IF NOT EXISTS "monthly_plans_class_month_idx"
    ON "monthly_plans" ("tenantId", "classLevel", "month", "weekNumber");

-- FK vers tenants, academic_years, school_levels, annual_plans
ALTER TABLE "monthly_plans"
    ADD CONSTRAINT "monthly_plans_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monthly_plans"
    ADD CONSTRAINT "monthly_plans_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monthly_plans"
    ADD CONSTRAINT "monthly_plans_schoolLevelId_fkey"
    FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monthly_plans"
    ADD CONSTRAINT "monthly_plans_annualPlanId_fkey"
    FOREIGN KEY ("annualPlanId") REFERENCES "annual_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
