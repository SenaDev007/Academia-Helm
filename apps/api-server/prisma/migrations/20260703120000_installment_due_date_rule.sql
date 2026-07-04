-- ============================================================================
-- Migration : Règles d'échéance dynamiques pour les tranches de frais
-- ============================================================================
-- Objectif : Permettre de lier une tranche à la date d'inscription de l'élève
--   au lieu d'une date fixe. Cas d'usage principal : la première tranche est
--   généralement due à l'inscription (règle métier écoles privées).
--
-- Trois modes possibles :
--   - AT_ENROLLMENT        : échéance = date d'inscription de l'élève
--   - DAYS_AFTER_ENROLLMENT : échéance = date d'inscription + X jours
--   - FIXED                : date fixe (comportement historique, défaut)
--
-- La colonne dueDate reste utilisée pour le mode FIXED et comme fallback.
-- Pour les modes dynamiques, dueDate est NULL ou contient une valeur indicative.
-- La résolution effective se fait au runtime dans student-account.service.ts
-- au moment de la création du compte élève.
-- ============================================================================

-- 1. Type enum pour le mode d'échéance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'installment_due_date_type') THEN
    CREATE TYPE installment_due_date_type AS ENUM ('FIXED', 'AT_ENROLLMENT', 'DAYS_AFTER_ENROLLMENT');
  END IF;
END$$;

-- 2. Colonnes sur fee_structure_installments
ALTER TABLE "fee_structure_installments"
  ADD COLUMN IF NOT EXISTS "dueDateType" installment_due_date_type NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS "daysOffset" INTEGER;

-- 3. Rendre dueDate nullable (pour les tranches AT_ENROLLMENT/DAYS_AFTER_ENROLLMENT)
-- Note : on garde dueDate pour le mode FIXED ; pour les autres modes, on accepte NULL.
ALTER TABLE "fee_structure_installments"
  ALTER COLUMN "dueDate" DROP NOT NULL;

-- 4. Index pour faciliter la résolution
CREATE INDEX IF NOT EXISTS idx_fee_installments_due_date_type
  ON "fee_structure_installments" ("dueDateType");

-- 5. Commentaires
COMMENT ON COLUMN "fee_structure_installments"."dueDateType" IS
  'Mode de calcul de l''échéance : FIXED (date fixe), AT_ENROLLMENT (à l''inscription), DAYS_AFTER_ENROLLMENT (X jours après inscription).';
COMMENT ON COLUMN "fee_structure_installments"."daysOffset" IS
  'Nombre de jours après l''inscription (utilisé uniquement quand dueDateType = DAYS_AFTER_ENROLLMENT).';
