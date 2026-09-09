-- =============================================================================
-- ÉDITION / SUPPRESSION D'UN ENCAISSEMENT (sept. 2026 — PROMOTEUR uniquement)
-- =============================================================================
-- Le promoteur doit pouvoir aligner les encaissements saisis sur les documents
-- papier fournis par les écoles. Le service FinanceTransactionService.remove()
-- (garant PROMOTEUR côté controller) supprime physiquement une transaction
-- erronée en réversant imputations / soldes / caisses, avec trace d'audit.
--
-- Le trigger prevent_finance_transaction_delete bloquait TOUTE suppression.
-- On lui ajoute un bypass contrôlé : le flag session
-- app.allow_transaction_delete = 'true' — posé uniquement par le service,
-- dans la MÊME transaction SQL que le DELETE (SET LOCAL → auto-révoqué au
-- COMMIT/ROLLBACK). Aucune autre voie (API, SQL externe) ne peut l'activer.
-- Miroir exact de DatabaseTriggersBootstrapService.getFinanceTriggerStatements().
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_finance_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
  allow_delete text;
BEGIN
  allow_delete := current_setting('app.allow_transaction_delete', true);
  IF allow_delete IS NOT NULL AND allow_delete = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Suppression de transaction interdite. Academia Hub impose l''immutabilité financière. Utilisez une écriture inverse (REVERSAL).';
END;
$$ LANGUAGE plpgsql;
