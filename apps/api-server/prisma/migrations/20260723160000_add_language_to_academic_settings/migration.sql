-- ============================================================================
-- Ajout de la colonne language + secondaryCycle à school_academic_settings
-- ============================================================================
-- Permet le scoping strict à 4 dimensions :
--   1. tenantId (multi-tenant)
--   2. schoolYearId (par année scolaire)
--   3. levelCode + cycleCode (par niveau scolaire)
--   4. language (par piste linguistique FR/EN/null=commun)
--
-- secondaryCycle : distinction 1er cycle vs 2nd cycle au SECONDAIRE
-- ============================================================================

ALTER TABLE "school_academic_settings"
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "secondaryCycle" TEXT;

COMMENT ON COLUMN "school_academic_settings"."language" IS
  'Piste linguistique : FR (francophone), EN (anglophone), NULL (commun aux deux pistes)';
COMMENT ON COLUMN "school_academic_settings"."secondaryCycle" IS
  'Cycle secondaire : CYCLE_I (6ème→3ème), CYCLE_II (2nde→Terminale), NULL pour maternelle/primaire';

-- Index pour le filtrage multi-dimensionnel
CREATE INDEX IF NOT EXISTS "school_academic_settings_levelCode_idx"
  ON "school_academic_settings" ("levelCode");
CREATE INDEX IF NOT EXISTS "school_academic_settings_language_idx"
  ON "school_academic_settings" ("language");
CREATE INDEX IF NOT EXISTS "school_academic_settings_secondaryCycle_idx"
  ON "school_academic_settings" ("secondaryCycle");

-- Index composite pour la recherche par scope
CREATE INDEX IF NOT EXISTS "school_academic_settings_scope_idx"
  ON "school_academic_settings" ("tenantId", "schoolYearId", "levelCode", "language", "secondaryCycle");
