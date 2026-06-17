-- ============================================================================
-- Migration : add_school_calendar_config
-- ============================================================================
-- Crée la table `school_calendar_configs` qui stocke la configuration du
-- calendrier scolaire par tenant (règles de calcul des dates d'année scolaire
-- et de trimestres).
--
-- Si un tenant n'a pas d'enregistrement dans cette table, les services
-- utilisent les valeurs par défaut (calendrier type Bénin :
-- pré-rentrée 2e lundi sept, rentrée 3e lundi sept, fin dernier vendredi juin,
-- T1 sept→déc, T2 janv→mars, T3 avr→juin).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "school_calendar_configs" (
    "id"                  TEXT            NOT NULL,
    "tenantId"            TEXT            NOT NULL,
    "startMonth"          INTEGER         NOT NULL DEFAULT 8,
    "preEntryWeekNumber"  INTEGER         NOT NULL DEFAULT 2,
    "preEntryDayOfWeek"   INTEGER         NOT NULL DEFAULT 1,
    "entryWeekOffset"     INTEGER         NOT NULL DEFAULT 1,
    "endMonth"            INTEGER         NOT NULL DEFAULT 5,
    "endDayOfWeek"        INTEGER         NOT NULL DEFAULT 5,
    "quarter1EndMonth"    INTEGER         NOT NULL DEFAULT 11,
    "quarter1EndDay"      INTEGER         NOT NULL DEFAULT 31,
    "quarter2EndMonth"    INTEGER         NOT NULL DEFAULT 2,
    "quarter2EndDay"      INTEGER         NOT NULL DEFAULT 31,
    "quarter3EndMonth"    INTEGER         NOT NULL DEFAULT 5,
    "quarter3EndDay"      INTEGER         NOT NULL DEFAULT 30,
    "createdAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "school_calendar_configs_pkey" PRIMARY KEY ("id")
);

-- Contrainte d'unicité : un seul enregistrement par tenant
CREATE UNIQUE INDEX IF NOT EXISTS "school_calendar_configs_tenantId_key"
    ON "school_calendar_configs" ("tenantId");

-- Contrainte de clé étrangère vers tenants (avec cascade au delete)
ALTER TABLE "school_calendar_configs"
    ADD CONSTRAINT "school_calendar_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
