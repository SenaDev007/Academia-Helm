#!/usr/bin/env python3
"""
Academia Helm - Apply Finance Security + Multi-caisses Migrations
==================================================================
Applique les 2 nouvelles migrations sur la DB Neon :
1. 20260703090000_finance_security_triggers (4 nouveaux triggers SQL)
2. 20260703100000_extend_cash_registers (extension du modèle CashRegister)

Run:
  DATABASE_URL="postgresql://..." python3 apply-finance-migrations.py
"""

import os
import sys
import psycopg2

DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("ERROR: DATABASE_URL env var required")
    sys.exit(1)

MIGRATION_1 = """
-- ============================================================================
-- Migration: Finance Security Triggers (P0)
-- ============================================================================

-- 1. prevent_balance_update
CREATE OR REPLACE FUNCTION prevent_balance_update()
RETURNS TRIGGER AS $$
DECLARE
  allow_update text;
BEGIN
  allow_update := current_setting('app.allow_balance_update', true);
  IF allow_update IS NULL OR allow_update <> 'true' THEN
    IF (NEW."totalDue"   IS DISTINCT FROM OLD."totalDue") OR
       (NEW."totalPaid"  IS DISTINCT FROM OLD."totalPaid") OR
       (NEW."balance"    IS DISTINCT FROM OLD."balance") OR
       (NEW."arrearsAmount" IS DISTINCT FROM OLD."arrearsAmount") THEN
      RAISE EXCEPTION 'Direct modification of balance fields is forbidden.';
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

-- 2. prevent_manual_block_update
CREATE OR REPLACE FUNCTION prevent_manual_block_update()
RETURNS TRIGGER AS $$
DECLARE
  allow_update text;
BEGIN
  allow_update := current_setting('app.allow_block_update', true);
  IF allow_update IS NULL OR allow_update <> 'true' THEN
    IF (NEW."isBlocked" IS DISTINCT FROM OLD."isBlocked") THEN
      RAISE EXCEPTION 'Direct modification of isBlocked is forbidden.';
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

-- 3. verify_integrity_hash
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION verify_integrity_hash()
RETURNS TRIGGER AS $$
DECLARE
  expected_hash text;
  stored_hash text;
BEGIN
  stored_hash := NEW."integrityHash";
  IF (NEW."amount"            IS DISTINCT FROM OLD."amount") OR
     (NEW."type"              IS DISTINCT FROM OLD."type") OR
     (NEW."studentAccountId"  IS DISTINCT FROM OLD."studentAccountId") OR
     (NEW."tenantId"          IS DISTINCT FROM OLD."tenantId") THEN
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
    IF stored_hash IS NOT NULL AND stored_hash <> expected_hash THEN
      RAISE EXCEPTION 'Integrity hash mismatch on finance_transaction %. Tampering detected.', NEW."id";
    END IF;
    IF stored_hash IS NOT NULL THEN
      NEW."integrityHash" := expected_hash;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON "finance_transactions";
CREATE TRIGGER verify_integrity_hash_trigger
BEFORE UPDATE ON "finance_transactions"
FOR EACH ROW
EXECUTE FUNCTION verify_integrity_hash();

-- 4. prevent_fee_override_delete
CREATE OR REPLACE FUNCTION prevent_fee_override_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of fee overrides is forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_fee_override_delete_trigger ON "fee_overrides";
CREATE TRIGGER prevent_fee_override_delete_trigger
BEFORE DELETE ON "fee_overrides"
FOR EACH ROW
EXECUTE FUNCTION prevent_fee_override_delete();

-- 5. Mise à jour de update_account_balance_after_tx pour utiliser set_config (bypass prevent_balance_update)
CREATE OR REPLACE FUNCTION update_account_balance_after_tx()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM set_config('app.allow_balance_update', 'true', true);
  UPDATE "student_accounts"
  SET
    "totalPaid" = "totalPaid" + NEW.amount,
    "balance" = "balance" - NEW.amount,
    "updatedAt" = NOW()
  WHERE "id" = NEW."studentAccountId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

MIGRATION_2 = """
-- ============================================================================
-- Migration: Extend CashRegister for multi-caisses operations
-- ============================================================================

ALTER TABLE "cash_registers"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "responsibleUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "openingBalance" DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currentBalance" DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "openedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT;

UPDATE "cash_registers"
SET "code" = 'CAISSE-' || SUBSTRING("id"::text, 1, 8)
WHERE "code" IS NULL;

ALTER TABLE "cash_registers"
  ALTER COLUMN "code" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_registers_tenantId_code_key'
  ) THEN
    ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_tenantId_code_key" UNIQUE ("tenantId", "code");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cash_registers_tenantId_isActive_idx"
  ON "cash_registers" ("tenantId", "isActive");

CREATE INDEX IF NOT EXISTS "cash_registers_responsibleUserId_idx"
  ON "cash_registers" ("responsibleUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_registers_responsibleUserId_fkey'
  ) THEN
    ALTER TABLE "cash_registers"
      ADD CONSTRAINT "cash_registers_responsibleUserId_fkey"
      FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_registers_openedByUserId_fkey'
  ) THEN
    ALTER TABLE "cash_registers"
      ADD CONSTRAINT "cash_registers_openedByUserId_fkey"
      FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_registers_closedByUserId_fkey'
  ) THEN
    ALTER TABLE "cash_registers"
      ADD CONSTRAINT "cash_registers_closedByUserId_fkey"
      FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
"""


def apply_migration(name: str, sql: str, conn):
    print(f"\n{'='*60}")
    print(f"Applying: {name}")
    print(f"{'='*60}")
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print(f"✅ {name} applied successfully")
    except Exception as e:
        conn.rollback()
        print(f"❌ {name} failed: {e}")
        raise
    finally:
        cur.close()


def verify_triggers(conn):
    print(f"\n{'='*60}")
    print("Verification: triggers on student_accounts and finance_transactions")
    print(f"{'='*60}")
    cur = conn.cursor()
    cur.execute("""
        SELECT tgname, tgrelid::regclass AS table_name, tgtype
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND (tgrelid = 'student_accounts'::regclass
               OR tgrelid = 'finance_transactions'::regclass
               OR tgrelid = 'fee_overrides'::regclass)
        ORDER BY tgrelid::regclass::text, tgname;
    """)
    for tgname, table, tgtype in cur.fetchall():
        print(f"  • {table:<25} {tgname}")
    cur.close()


def verify_cash_registers(conn):
    print(f"\n{'='*60}")
    print("Verification: cash_registers columns")
    print(f"{'='*60}")
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cash_registers'
        ORDER BY ordinal_position;
    """)
    for col, dtype in cur.fetchall():
        print(f"  • {col}: {dtype}")
    cur.close()


def main():
    print(f"Connecting to: {DB_URL.split('@')[1].split('/')[0]}")
    conn = psycopg2.connect(DB_URL, connect_timeout=15)

    try:
        apply_migration("20260703090000_finance_security_triggers", MIGRATION_1, conn)
        apply_migration("20260703100000_extend_cash_registers", MIGRATION_2, conn)

        verify_triggers(conn)
        verify_cash_registers(conn)

        print(f"\n{'='*60}")
        print("✅ All migrations applied successfully!")
        print(f"{'='*60}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
