-- ============================================================================
-- Migration: 20260814160000_add_is_enabled_to_education_grades
-- ============================================================================
-- ⭐ Ajoute la colonne "isEnabled" à education_grades pour permettre l'activation
--    granulaire des classes/séries au niveau Secondaire.
--
--    Avant : quand on active le niveau SECONDAIRE, toutes les classes (6e, 5e,
--    4e, 3e, 2nde, 1ère, Terminale) sont visibles d'un coup.
--    Après : l'utilisateur peut activer/désactiver individuellement chaque
--    classe selon ce que l'école propose réellement.
--
--    Default: TRUE (toutes les classes existantes restent activées — pas de
--    changement de comportement pour les tenants existants).
-- ============================================================================

ALTER TABLE education_grades
  ADD COLUMN IF NOT EXISTS "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE;

-- ⭐ Mettre à jour les grades existants à TRUE (ils sont tous actifs par défaut)
UPDATE education_grades SET "isEnabled" = TRUE WHERE "isEnabled" IS NULL;

-- ⭐ Index pour filtrer rapidement les grades actifs
CREATE INDEX IF NOT EXISTS idx_education_grades_is_enabled
  ON education_grades ("isEnabled");

-- ⭐ Commentaire pour documentation
COMMENT ON COLUMN education_grades."isEnabled" IS
  'Active/désactive individuellement cette classe pédagogique. Permet à l''école de n''afficher que les classes réellement disponibles (ex: activer 6e+5e mais pas 2nde si pas de 2nd cycle).';
