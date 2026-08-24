-- ⭐ Planification pédagogique annuelle — table annual_plans
--    Permet de stocker la planification officielle ministérielle (Bénin)
--    pour chaque niveau (Maternelle Grands, CI, CP, CE1, CE2, CM1, CM2).
--
--    Structure :
--    - Une ligne = une activité pédagogique pour une semaine donnée
--    - classLevel : "MATERNELLE_GRANDS" | "CI" | "CP" | "CE1" | "CE2" | "CM1" | "CM2"
--    - trimester : 1, 2, 3
--    - month : "Septembre", "Octobre", ..., "Juin"
--    - week : "1ère semaine", "2ème semaine", ..., "5ème semaine"
--    - domain : "Education pour la santé", "Français", "Maths", etc.
--    - subDomain : "Passage aux toilettes", "Morale", "Civisme", etc.
--    - content : le contenu pédagogique (ex: "J'apprends à boire de l'eau potable")
--    - isCustom : false = contenu officiel, true = modifié par la direction
--
--    Toutes les écoles (tenants) ont ces données par défaut (seed automatique
--    lors du déploiement). La direction peut modifier → isCustom = true.

CREATE TABLE IF NOT EXISTS "annual_plans" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "schoolLevelId"   TEXT NOT NULL,
    "classLevel"      TEXT NOT NULL,
    "trimester"       INTEGER NOT NULL,
    "month"           TEXT NOT NULL,
    "week"            TEXT NOT NULL,
    "domain"          TEXT NOT NULL,
    "subDomain"       TEXT,
    "content"         TEXT NOT NULL,
    "isCustom"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_plans_pkey" PRIMARY KEY ("id")
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS "annual_plans_tenant_academicYear_idx"
    ON "annual_plans" ("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "annual_plans_classLevel_trimester_idx"
    ON "annual_plans" ("tenantId", "classLevel", "trimester");
CREATE INDEX IF NOT EXISTS "annual_plans_schoolLevel_idx"
    ON "annual_plans" ("tenantId", "schoolLevelId", "academicYearId");

-- FK vers tenants, academic_years, school_levels
ALTER TABLE "annual_plans"
    ADD CONSTRAINT "annual_plans_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "annual_plans"
    ADD CONSTRAINT "annual_plans_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "annual_plans"
    ADD CONSTRAINT "annual_plans_schoolLevelId_fkey"
    FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
