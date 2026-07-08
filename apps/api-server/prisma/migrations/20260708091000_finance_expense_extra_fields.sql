-- ============================================================================
-- Migration : Ajout champs rejectReason, overBudget, expenseDate, vendor, invoiceRef
--             à FinanceExpense
-- ============================================================================

-- Motif du rejet (obligatoire si status = REJECTED)
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;

-- Indique si la dépense dépasse le budget de sa catégorie (flag ORION)
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS "overBudget" BOOLEAN NOT NULL DEFAULT false;

-- Date de la dépense (peut être antérieure à createdAt pour saisie rétroactive)
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Fournisseur / bénéficiaire (optionnel)
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS "vendor" TEXT;

-- Référence facture (optionnel)
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;

-- Index sur expenseDate pour les requêtes par période
CREATE INDEX IF NOT EXISTS finance_expenses_expenseDate_idx ON finance_expenses ("expenseDate");

-- ============================================================================
-- Backfill : expenseDate = createdAt pour les dépenses existantes
-- ============================================================================
UPDATE finance_expenses
SET "expenseDate" = "createdAt"
WHERE "expenseDate" IS NULL OR "expenseDate" = "createdAt";
