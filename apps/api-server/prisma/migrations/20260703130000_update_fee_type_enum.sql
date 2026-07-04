-- ============================================================================
-- Migration : Évolution de l'enum FeeType
-- ============================================================================
-- Objectif :
--   - Remplacer ANNEX → CANTEEN (Cantine)
--   - Remplacer EXCEPTIONAL → AMANTS (Frais des amants)
--   - Ajouter OTHER (Autre — type personnalisé spécifié par l'utilisateur)
--
-- Note : PostgreSQL ne permet pas de RENAME VALUE sur un type enum directement.
-- On utilise ALTER TYPE ... ADD VALUE pour les nouvelles valeurs, puis on
-- migre les données existantes, puis on ne peut pas supprimer les anciennes
-- valeurs (PostgreSQL ne supporte pas DROP VALUE sur un enum).
-- Les anciennes valeurs ANNEX et EXCEPTIONAL restent dans le type mais ne
-- sont plus utilisées par l'application.
-- ============================================================================

-- 1. Ajouter les nouvelles valeurs à l'enum fee_type
ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'CANTEEN';
ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'AMANTS';
ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'OTHER';

-- 2. Migrer les données existantes
-- ATTENTION : on doit faire un UPDATE sur toutes les tables qui utilisent fee_type
UPDATE "fee_structures" SET "feeType" = 'CANTEEN' WHERE "feeType" = 'ANNEX';
UPDATE "fee_structures" SET "feeType" = 'AMANTS' WHERE "feeType" = 'EXCEPTIONAL';

-- Vérification
DO $$
DECLARE
  canteen_count INTEGER;
  amants_count INTEGER;
  other_count INTEGER;
  annex_count INTEGER;
  exceptional_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO canteen_count FROM "fee_structures" WHERE "feeType" = 'CANTEEN';
  SELECT COUNT(*) INTO amants_count FROM "fee_structures" WHERE "feeType" = 'AMANTS';
  SELECT COUNT(*) INTO other_count FROM "fee_structures" WHERE "feeType" = 'OTHER';
  SELECT COUNT(*) INTO annex_count FROM "fee_structures" WHERE "feeType" = 'ANNEX';
  SELECT COUNT(*) INTO exceptional_count FROM "fee_structures" WHERE "feeType" = 'EXCEPTIONAL';
  RAISE NOTICE 'Migration FeeType terminée : CANTEEN=%, AMANTS=%, OTHER=%, ANNEX (restant)=%, EXCEPTIONAL (restant)=%',
    canteen_count, amants_count, other_count, annex_count, exceptional_count;
END$$;
