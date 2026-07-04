-- ============================================================================
-- Migration: Extend CashRegister for multi-caisses operations
-- Date: 2026-07-03
-- Purpose: Add fields needed for real multi-caisse management
--   - code (unique per tenant)
--   - responsibleUserId (caissier attitré)
--   - location (emplacement physique)
--   - openingBalance, currentBalance (suivi solde)
--   - isOpen, openedAt, openedByUserId, closedAt, closedByUserId (cycle ouverture/fermeture)
--   - description, isActive (already exists)
-- ============================================================================

-- 1. Add new columns (idempotent)
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

-- 2. Backfill code for existing rows (use id prefix if null)
UPDATE "cash_registers"
SET "code" = 'CAISSE-' || SUBSTRING("id"::text, 1, 8)
WHERE "code" IS NULL;

-- 3. Make code NOT NULL now that all rows have a value
ALTER TABLE "cash_registers"
  ALTER COLUMN "code" SET NOT NULL;

-- 4. Add unique constraint on (tenantId, code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_registers_tenantId_code_key'
  ) THEN
    ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_tenantId_code_key" UNIQUE ("tenantId", "code");
  END IF;
END $$;

-- 5. Add indexes (idempotent)
CREATE INDEX IF NOT EXISTS "cash_registers_tenantId_isActive_idx"
  ON "cash_registers" ("tenantId", "isActive");

CREATE INDEX IF NOT EXISTS "cash_registers_responsibleUserId_idx"
  ON "cash_registers" ("responsibleUserId");

-- 6. Add foreign keys (idempotent — use DO block to check existence)
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

-- ============================================================================
-- Notes:
-- - Existing rows get a default code derived from their UUID
-- - All new fields have defaults so existing code keeps working
-- - The unique constraint (tenantId, code) prevents duplicate codes per school
-- - FKs use ON DELETE SET NULL to avoid blocking user deletion
-- ============================================================================
