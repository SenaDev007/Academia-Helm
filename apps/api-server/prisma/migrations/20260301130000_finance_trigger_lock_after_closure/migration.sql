-- Trigger SM6: interdire modification d'une transaction dont le jour est déjà clôturé (finance_daily_closures)
CREATE OR REPLACE FUNCTION prevent_update_after_closure()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "finance_daily_closures" c
    WHERE c."tenantId" = NEW."tenantId"
      AND c."academicYearId" = NEW."academicYearId"
      AND c.date = DATE(NEW."createdAt")
  ) THEN
    RAISE EXCEPTION 'Transaction locked after daily closure';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_transaction_after_closure ON "finance_transactions";
CREATE TRIGGER lock_transaction_after_closure
BEFORE UPDATE ON "finance_transactions"
FOR EACH ROW EXECUTE PROCEDURE prevent_update_after_closure();
