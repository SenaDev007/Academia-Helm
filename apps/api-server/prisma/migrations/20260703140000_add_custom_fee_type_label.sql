-- ============================================================================
-- Migration : Ajout colonne customFeeTypeLabel à fee_structures
-- ============================================================================
-- Objectif : Stocker le libellé personnalisé du type de frais quand feeType = OTHER.
-- Ex: "Transport", "Activités", "Examens"...
-- Le nom du frais (colonne "name") est auto-généré avec ce libellé.
-- ============================================================================

ALTER TABLE "fee_structures"
  ADD COLUMN IF NOT EXISTS "customFeeTypeLabel" TEXT;

COMMENT ON COLUMN "fee_structures"."customFeeTypeLabel" IS
  'Libellé personnalisé du type de frais (utilisé uniquement quand feeType = OTHER). Ex: "Transport".';
