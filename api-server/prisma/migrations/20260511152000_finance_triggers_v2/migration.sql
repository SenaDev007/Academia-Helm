-- =============================================================================
-- FINANCE TRIGGERS V2 - DATA INTEGRITY & AUDIT PROOFING
-- =============================================================================

-- 1. Trigger: Mise à jour automatique du solde du compte élève après une transaction
CREATE OR REPLACE FUNCTION update_student_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Pour un paiement (montant positif) ou une annulation (montant négatif)
  -- On met à jour totalPaid, balance et status.
  UPDATE "student_accounts"
  SET 
    "totalPaid" = "totalPaid" + NEW.amount,
    "balance" = "balance" - NEW.amount,
    "status" = CASE 
      WHEN ("balance" - NEW.amount) <= 0 THEN 'PAID'::"AccountStatus" 
      WHEN ("balance" - NEW.amount) < "totalDue" THEN 'PARTIAL'::"AccountStatus"
      ELSE 'ACTIVE'::"AccountStatus"
    END,
    "updatedAt" = NOW()
  WHERE "id" = NEW."studentAccountId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_balance_after_transaction ON "finance_transactions";
CREATE TRIGGER update_balance_after_transaction
AFTER INSERT ON "finance_transactions"
FOR EACH ROW EXECUTE PROCEDURE update_student_account_balance();


-- 2. Trigger: Interdire la modification de isBlocked manuellement sans audit
-- (On se contente de logger tout changement de statut de blocage)
CREATE OR REPLACE FUNCTION audit_student_account_block()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD."isBlocked" IS DISTINCT FROM NEW."isBlocked") THEN
    INSERT INTO "financial_audit_logs" (
      "id", "tenantId", "entityType", "entityId", "action", 
      "oldValue", "newValue", "performedAt", "performedById"
    )
    VALUES (
      gen_random_uuid(), NEW."tenantId", 'StudentAccount', NEW."id", 
      CASE WHEN NEW."isBlocked" THEN 'BLOCK' ELSE 'UNBLOCK' END, 
      jsonb_build_object('isBlocked', OLD."isBlocked"),
      jsonb_build_object('isBlocked', NEW."isBlocked"),
      NOW(),
      -- On utilise l'ID du cashier s'il est dispo dans une variable de session ou null (sera géré par le service)
      COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_block_update ON "student_accounts";
CREATE TRIGGER audit_block_update
AFTER UPDATE ON "student_accounts"
FOR EACH ROW EXECUTE PROCEDURE audit_student_account_block();


-- 3. Trigger: Interdire la suppression des frais (FeeStructure)
-- Déjà présent dans 20260228180000, mais on le renforce ici si besoin.
CREATE OR REPLACE FUNCTION prevent_fee_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of fee structure is forbidden. Use historisation (isActive=false).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_fee ON "fee_structures";
CREATE TRIGGER no_delete_fee 
BEFORE DELETE ON "fee_structures" 
FOR EACH ROW EXECUTE PROCEDURE prevent_fee_delete();


-- 4. Trigger: Interdire la suppression des dépenses
CREATE OR REPLACE FUNCTION prevent_expense_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of expenses is forbidden. Use status REJECTED if needed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_expense ON "finance_expenses";
CREATE TRIGGER no_delete_expense
BEFORE DELETE ON "finance_expenses"
FOR EACH ROW EXECUTE PROCEDURE prevent_expense_delete();
