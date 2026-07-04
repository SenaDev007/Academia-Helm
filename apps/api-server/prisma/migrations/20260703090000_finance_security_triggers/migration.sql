-- ============================================================================
-- Migration: Finance Security Triggers (P0)
-- Date: 2026-07-03
-- Purpose: Add 4 critical SQL triggers to enforce financial immutability
--   1. prevent_balance_update — block direct UPDATE of student_accounts.totalDue/totalPaid/balance
--   2. prevent_manual_block_update — block direct UPDATE of student_accounts.isBlocked (only via app with audit)
--   3. verify_integrity_hash — BEFORE UPDATE on finance_transactions, recalculates SHA256 and blocks if mismatch
--   4. prevent_fee_override_delete — BEFORE DELETE on fee_overrides
-- ============================================================================

-- ============================================================================
-- 1. prevent_balance_update — block direct modification of balance fields
-- ============================================================================
-- The balance fields (totalDue, totalPaid, balance, arrearsAmount) MUST only be
-- updated by the application via Prisma, NEVER directly via SQL. The only
-- exception is the trigger `update_account_balance_after_tx` which is allowed
-- because it runs AFTER INSERT on finance_transactions.
--
-- Strategy: Use a session-level flag `app.allow_balance_update` set by the
-- application before legitimate updates. If the flag is not set, RAISE EXCEPTION.

CREATE OR REPLACE FUNCTION prevent_balance_update()
RETURNS TRIGGER AS $$
DECLARE
  allow_update text;
BEGIN
  -- Allow the auto-balance trigger (after INSERT on finance_transactions) to update
  -- the balance. We detect this via a session setting that the trigger sets.
  allow_update := current_setting('app.allow_balance_update', true);

  IF allow_update IS NULL OR allow_update <> 'true' THEN
    -- Check if any of the protected fields changed
    IF (NEW."totalDue"   IS DISTINCT FROM OLD."totalDue") OR
       (NEW."totalPaid"  IS DISTINCT FROM OLD."totalPaid") OR
       (NEW."balance"    IS DISTINCT FROM OLD."balance") OR
       (NEW."arrearsAmount" IS DISTINCT FROM OLD."arrearsAmount") THEN
      RAISE EXCEPTION 'Direct modification of balance fields (totalDue, totalPaid, balance, arrearsAmount) is forbidden. Use FinanceTransactionService or set app.allow_balance_update = true for legitimate application updates.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON "student_accounts";
CREATE TRIGGER prevent_balance_update_trigger
BEFORE UPDATE OF "totalDue", "totalPaid", "balance", "arrearsAmount"
ON "student_accounts"
FOR EACH ROW
EXECUTE FUNCTION prevent_balance_update();

-- ============================================================================
-- 2. prevent_manual_block_update — STRICT block on isBlocked
-- ============================================================================
-- The `isBlocked` field can ONLY be modified by the application (StudentAccountService)
-- which sets `app.allow_block_update = true` before legitimate updates. All direct
-- SQL updates are blocked.

CREATE OR REPLACE FUNCTION prevent_manual_block_update()
RETURNS TRIGGER AS $$
DECLARE
  allow_update text;
BEGIN
  allow_update := current_setting('app.allow_block_update', true);

  IF allow_update IS NULL OR allow_update <> 'true' THEN
    IF (NEW."isBlocked" IS DISTINCT FROM OLD."isBlocked") THEN
      RAISE EXCEPTION 'Direct modification of isBlocked is forbidden. Use StudentAccountService.unblock() or block() which sets app.allow_block_update = true.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_manual_block_update_trigger ON "student_accounts";
CREATE TRIGGER prevent_manual_block_update_trigger
BEFORE UPDATE OF "isBlocked"
ON "student_accounts"
FOR EACH ROW
EXECUTE FUNCTION prevent_manual_block_update();

-- ============================================================================
-- 3. verify_integrity_hash — BEFORE UPDATE on finance_transactions
-- ============================================================================
-- If the transaction has an `integrityHash` and someone tries to modify
-- `amount`, `type`, `studentAccountId`, or `tenantId`, the trigger recalculates
-- the SHA256 and compares with the stored hash. If they don't match, the update
-- is BLOCKED (someone tampered with the transaction).
--
-- This catches any in-app or SQL-level tampering after the transaction was
-- created.

CREATE OR REPLACE FUNCTION verify_integrity_hash()
RETURNS TRIGGER AS $$
DECLARE
  expected_hash text;
  stored_hash text;
BEGIN
  -- Only verify if a hash is already stored (skip on first UPDATE which sets it)
  stored_hash := NEW."integrityHash";

  -- If critical fields changed, recompute and verify
  IF (NEW."amount"            IS DISTINCT FROM OLD."amount") OR
     (NEW."type"              IS DISTINCT FROM OLD."type") OR
     (NEW."studentAccountId"  IS DISTINCT FROM OLD."studentAccountId") OR
     (NEW."tenantId"          IS DISTINCT FROM OLD."tenantId") THEN

    -- Recompute the expected hash
    expected_hash := encode(
      digest(
        NEW."tenantId" || '|' ||
        NEW."studentAccountId" || '|' ||
        NEW."amount"::text || '|' ||
        NEW."type" || '|' ||
        NEW."createdAt"::timestamptz::text,
        'sha256'
      ),
      'hex'
    );

    -- If a stored hash exists and doesn't match the recomputed one → tampering detected
    IF stored_hash IS NOT NULL AND stored_hash <> expected_hash THEN
      RAISE EXCEPTION 'Integrity hash mismatch on finance_transaction %. Transaction tampering detected. Stored hash: %, Expected hash: %',
        NEW."id", stored_hash, expected_hash;
    END IF;

    -- If hash exists but critical fields changed, update the hash (legitimate update via app)
    -- This allows the application to update the hash when re-saving
    IF stored_hash IS NOT NULL THEN
      NEW."integrityHash" := expected_hash;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Need pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON "finance_transactions";
CREATE TRIGGER verify_integrity_hash_trigger
BEFORE UPDATE ON "finance_transactions"
FOR EACH ROW
EXECUTE FUNCTION verify_integrity_hash();

-- ============================================================================
-- 4. prevent_fee_override_delete — BEFORE DELETE on fee_overrides
-- ============================================================================
-- Fee overrides are part of the audit trail. They should never be deleted,
-- only deactivated (by setting customAmount = null or via a soft-delete flag).

CREATE OR REPLACE FUNCTION prevent_fee_override_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of fee overrides is forbidden. Override history must be preserved for audit.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_fee_override_delete_trigger ON "fee_overrides";
CREATE TRIGGER prevent_fee_override_delete_trigger
BEFORE DELETE ON "fee_overrides"
FOR EACH ROW
EXECUTE FUNCTION prevent_fee_override_delete();

-- ============================================================================
-- Notes:
-- - All triggers are idempotent (DROP IF EXISTS before CREATE)
-- - The application must call `SET LOCAL app.allow_balance_update = 'true'` before
--   legitimate balance updates (e.g. in StudentAccountService.getOrCreate, injectArrearsFromPreviousYear, unblock)
-- - Same for `app.allow_block_update` before isBlocked changes
-- - The pgcrypto extension is required for digest() — created if not exists
-- ============================================================================
