-- ============================================================================
-- Migration : Correction enum FeeType — remplacer AMANTS par EXAMEN
-- ============================================================================
-- L'utilisateur a demandé "Frais d'examen" (et non "Frais des amants").
-- On retire AMANTS et on ajoute EXAMEN.
-- Note : PostgreSQL ne supporte pas DROP VALUE sur un enum. AMANTS reste dans
-- le type mais n'est plus utilisé par l'application. Les données existantes
-- (s'il y en a) sont migrées vers EXAMEN.
-- ============================================================================

-- 1. Ajouter EXAMEN à l'enum
ALTER TYPE "FeeType" ADD VALUE IF NOT EXISTS 'EXAMEN';

-- 2. Migrer les données existantes AMANTS → EXAMEN
UPDATE "fee_structures" SET "feeType" = 'EXAMEN' WHERE "feeType" = 'AMANTS';

-- Vérification
DO $$
DECLARE
  examen_count INTEGER;
  amants_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO examen_count FROM "fee_structures" WHERE "feeType" = 'EXAMEN';
  SELECT COUNT(*) INTO amants_count FROM "fee_structures" WHERE "feeType" = 'AMANTS';
  RAISE NOTICE 'Correction FeeType : EXAMEN=%, AMANTS (restant)=%', examen_count, amants_count;
END$$;
