-- ============================================================================
-- Migration: Fix staff/contract status for unsigned contracts
-- ============================================================================
-- Problem: Staff hired via recruitment were set to ACTIVE status and their
-- contracts were also ACTIVE, even though the contracts were not signed yet.
-- Fix: Unsigned contracts should be DRAFT, and their staff should be
-- PENDING_SIGNATURE until the contract is signed.
-- ============================================================================

-- Step 1: Update unsigned contracts from ACTIVE → DRAFT
UPDATE employment_contracts
SET status = 'DRAFT', "updatedAt" = NOW()
WHERE status = 'ACTIVE'
  AND "signedAt" IS NULL;

-- Step 2: Update staff whose only contracts are now DRAFT (unsigned)
-- from ACTIVE → PENDING_SIGNATURE
UPDATE staff s
SET status = 'PENDING_SIGNATURE', "updatedAt" = NOW()
WHERE s.status = 'ACTIVE'
  AND NOT EXISTS (
    -- Has at least one signed (ACTIVE) contract
    SELECT 1 FROM employment_contracts c
    WHERE c."staffId" = s.id
      AND c.status = 'ACTIVE'
      AND c."signedAt" IS NOT NULL
  )
  AND EXISTS (
    -- Has at least one DRAFT (unsigned) contract
    SELECT 1 FROM employment_contracts c
    WHERE c."staffId" = s.id
      AND c.status = 'DRAFT'
      AND c."signedAt" IS NULL
  );
