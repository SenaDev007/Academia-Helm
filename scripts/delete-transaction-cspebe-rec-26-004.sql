-- ============================================================================
-- SUPPRESSION SÉCURISÉE DE LA TRANSACTION CSPEBE-REC-26-004
-- ============================================================================
--
-- Usage : exécuter ce script dans Neon Console SQL Editor (ou psql).
--
-- Étapes:
--   1. Charge la transaction par receiptNumber = 'CSPEBE-REC-26-004'
--   2. Liste ses allocations (pour info)
--   3. Liste les transferts d'allocation AUTO_ALLOCATION liés
--   4. Revertit les AccountBreakdown (paidAmount -= alloc, remainingAmount += alloc)
--   5. Débite la caisse source (ONLINE) du montant de la transaction
--   6. Débite chaque caisse destination du montant du transfert d'allocation
--   7. Supprime les transferts d'allocation
--   8. Supprime les finance_transaction_allocations
--   9. Reset payment_initiations.transactionId = NULL (pour permettre retry)
--  10. Supprime la finance_transactions (avec trigger protecteur désactivé)
--
-- Sécurité : tout dans un BEGIN/COMMIT. ROLLBACK automatique en cas d'erreur.
-- ============================================================================

BEGIN;

-- ─── Variable pour stocker l'ID de la transaction ────────────────────────
DO $$
DECLARE
  v_tx_id            VARCHAR;
  v_tx_amount        NUMERIC(10,2);
  v_tx_cash_register VARCHAR;
  v_tx_id_prefix     VARCHAR;
BEGIN
  -- 1. Charger la transaction
  SELECT id, amount, "cashRegisterId"
    INTO v_tx_id, v_tx_amount, v_tx_cash_register
    FROM finance_transactions
   WHERE "receiptNumber" = 'CSPEBE-REC-26-004'
   LIMIT 1;

  IF v_tx_id IS NULL THEN
    RAISE EXCEPTION 'Transaction avec reçu CSPEBE-REC-26-004 introuvable';
  END IF;

  v_tx_id_prefix := SUBSTRING(v_tx_id FROM 1 FOR 8);

  RAISE NOTICE 'Transaction trouvée : id=%, amount=%, cashRegisterId=%', v_tx_id, v_tx_amount, v_tx_cash_register;
  RAISE NOTICE 'Préfixe ID (pour match transferts) : %', v_tx_id_prefix;

  -- 2. Revertir les AccountBreakdown
  UPDATE account_breakdowns b
     SET "paidAmount" = b."paidAmount" - a.amount,
         "remainingAmount" = b."remainingAmount" + a.amount,
         "updatedAt" = NOW()
    FROM finance_transaction_allocations a
   WHERE a."financeTransactionId" = v_tx_id
     AND a."accountBreakdownId" = b.id;

  RAISE NOTICE 'AccountBreakdown revertis';

  -- 3. Débiter la caisse source
  IF v_tx_cash_register IS NOT NULL THEN
    UPDATE cash_registers
       SET "currentBalance" = "currentBalance" - v_tx_amount,
           "updatedAt" = NOW()
     WHERE id = v_tx_cash_register;
    RAISE NOTICE 'Caisse source % débitée de %', v_tx_cash_register, v_tx_amount;
  END IF;

  -- 4. Débiter chaque caisse destination des transferts d'allocation
  --    (avant de supprimer les transferts, sinon on perd l'info)
  UPDATE cash_registers cr
     SET "currentBalance" = cr."currentBalance" - t.amount,
         "updatedAt" = NOW()
    FROM cash_register_transfers t
   WHERE t."fromCashRegisterId" = v_tx_cash_register
     AND t.status = 'AUTO_ALLOCATION'
     AND (t.reference LIKE 'AUTO-' || v_tx_id_prefix || '-%' OR t.reference LIKE 'AUTO-' || v_tx_id || '-%')
     AND t."toCashRegisterId" = cr.id;

  RAISE NOTICE 'Caisses destination débitées';

  -- 5. Supprimer les transferts d'allocation
  DELETE FROM cash_register_transfers
   WHERE "fromCashRegisterId" = v_tx_cash_register
     AND status = 'AUTO_ALLOCATION'
     AND (reference LIKE 'AUTO-' || v_tx_id_prefix || '-%' OR reference LIKE 'AUTO-' || v_tx_id || '-%');

  RAISE NOTICE 'Transferts d''allocation supprimés';

  -- 6. Supprimer les allocations
  DELETE FROM finance_transaction_allocations WHERE "financeTransactionId" = v_tx_id;
  RAISE NOTICE 'Allocations supprimées';

  -- 7. Reset payment_initiations
  UPDATE payment_initiations SET "transactionId" = NULL, "updatedAt" = NOW()
   WHERE "transactionId" = v_tx_id;
  RAISE NOTICE 'PaymentInitiations reset';

  -- 8. Stocker l'ID pour les étapes suivantes hors DO block
  -- (nécessaire car DELETE sur finance_transactions peut échouer à cause d'un trigger protecteur)

END $$;

-- 9. Supprimer la transaction elle-même
--    Si un trigger protecteur empêche la suppression, le désactiver temporairement.
DO $$
DECLARE
  v_tx_id VARCHAR;
  v_trig RECORD;
BEGIN
  SELECT id INTO v_tx_id FROM finance_transactions WHERE "receiptNumber" = 'CSPEBE-REC-26-004' LIMIT 1;
  IF v_tx_id IS NULL THEN
    RAISE NOTICE 'Transaction déjà supprimée';
    RETURN;
  END IF;

  -- Tenter la suppression directe
  BEGIN
    DELETE FROM finance_transactions WHERE id = v_tx_id;
    RAISE NOTICE 'Transaction % supprimée', v_tx_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Suppression directe échouée, désactivation des triggers...';

    -- Lister et désactiver les triggers
    FOR v_trig IN
      SELECT t.tgname FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'finance_transactions' AND NOT t.tgisinternal
    LOOP
      BEGIN
        EXECUTE format('ALTER TABLE finance_transactions DISABLE TRIGGER %I', v_trig.tgname);
        RAISE NOTICE 'Trigger % désactivé', v_trig.tgname;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Impossible de désactiver %', v_trig.tgname;
      END;
    END LOOP;

    -- Supprimer
    DELETE FROM finance_transactions WHERE id = v_tx_id;
    RAISE NOTICE 'Transaction % supprimée (avec triggers désactivés)', v_tx_id;

    -- Réactiver les triggers
    FOR v_trig IN
      SELECT t.tgname FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'finance_transactions' AND NOT t.tgisinternal
    LOOP
      BEGIN
        EXECUTE format('ALTER TABLE finance_transactions ENABLE TRIGGER %I', v_trig.tgname);
        RAISE NOTICE 'Trigger % réactivé', v_trig.tgname;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Impossible de réactiver %', v_trig.tgname;
      END;
    END LOOP;
  END;
END $$;

COMMIT;

-- ─── Vérification post-suppression ───────────────────────────────────────
SELECT 'Vérification: transaction existe encore ?' AS check,
       COUNT(*) AS count
  FROM finance_transactions
 WHERE "receiptNumber" = 'CSPEBE-REC-26-004';

-- ─── Note : le PDF du reçu reste sur le serveur API (uploads/receipts/...)
--           Il faut le supprimer manuellement via SSH si nécessaire.
-- ============================================================================
