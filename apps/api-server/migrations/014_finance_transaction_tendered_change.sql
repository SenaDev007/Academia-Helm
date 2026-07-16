-- ============================================================================
-- Migration 014 : Ajout des champs tenderedAmount + changeGiven à FinanceTransaction
-- ============================================================================
--
-- Objectif : Tracer le montant remis par le client en espèces (tenderedAmount)
-- et le reliquat rendu (changeGiven) pour les paiements en espèces (CASH).
--
-- Ces infos seront affichées dans le reçu PDF, WhatsApp et SMS.
--
-- Champs optionnels (Decimal nullable) — n'affecte pas les transactions existantes.
-- ============================================================================

ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS tendered_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS change_given NUMERIC(10, 2);

-- Commentaire pour documentation
COMMENT ON COLUMN finance_transactions.tendered_amount IS 'Montant remis par le client en espèces (uniquement pour paymentMethod = CASH). Permet de tracer le reliquat dans le reçu PDF, WhatsApp et SMS.';
COMMENT ON COLUMN finance_transactions.change_given IS 'Reliquat / monnaie rendue au client (calculé côté frontend : tenderedAmount - amount, re-vérifié côté backend).';
