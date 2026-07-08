-- ============================================================================
-- Migration : Trigger no_delete_expense
-- ============================================================================
-- Empêche la suppression physique d'une dépense (FinanceExpense).
-- Conformément au cahier des charges SOUS-MODULE 5 — DÉPENSES & BUDGET :
--   "Aucun delete destructif — Annulation = changement statut REJECTED"
--
-- Toute suppression doit passer par un changement de statut (REJECTED),
-- l'historique est conservé pour audit.
-- ============================================================================

-- Fonction qui lève une exception si on tente de DELETE
CREATE OR REPLACE FUNCTION prevent_expense_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Suppression des dépenses interdite. Utiliser le statut REJECTED à la place.';
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE DELETE sur finance_expenses
DROP TRIGGER IF EXISTS no_delete_expense ON finance_expenses;
CREATE TRIGGER no_delete_expense
BEFORE DELETE ON finance_expenses
FOR EACH ROW
EXECUTE FUNCTION prevent_expense_delete();

-- ============================================================================
-- Note : idem pour l'ancienne table expenses (legacy) si elle existe
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_old_expense_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Suppression des dépenses interdite. Utiliser le statut REJECTED à la place.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_expense ON expenses;
CREATE TRIGGER no_delete_expense
BEFORE DELETE ON expenses
FOR EACH ROW
EXECUTE FUNCTION prevent_old_expense_delete();
