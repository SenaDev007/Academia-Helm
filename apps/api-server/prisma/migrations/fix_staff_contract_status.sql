-- ============================================================
-- Migration: Fix Staff & Contract status for existing data
-- Date: 2025-06-13
-- Description:
--   1. Staff without a signed contract should be PENDING_SIGNATURE, not ACTIVE
--   2. Contracts without a signature should be PENDING, not ACTIVE
--   3. This aligns existing data with the new application logic
-- ============================================================

-- Step 1: Fix Contracts — unsigned contracts should be PENDING
UPDATE employment_contracts
SET status = 'PENDING'
WHERE status = 'ACTIVE'
  AND "signedAt" IS NULL;

-- Step 2: Fix Staff — staff without any signed contract should be PENDING_SIGNATURE
UPDATE staff s
SET status = 'PENDING_SIGNATURE'
WHERE s.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM employment_contracts c
    WHERE c."staffId" = s.id
      AND c.status = 'ACTIVE'
      AND c."signedAt" IS NOT NULL
  );

-- Step 3: Staff who HAVE a signed contract but are PENDING_SIGNATURE should be ACTIVE
UPDATE staff s
SET status = 'ACTIVE'
WHERE s.status = 'PENDING_SIGNATURE'
  AND EXISTS (
    SELECT 1 FROM employment_contracts c
    WHERE c."staffId" = s.id
      AND c.status = 'ACTIVE'
      AND c."signedAt" IS NOT NULL
  );
