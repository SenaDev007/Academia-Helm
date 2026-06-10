-- ============================================================================
-- Migration: Add extended columns to staff and schools tables
-- These columns may already exist (added manually or by previous scripts).
-- Uses IF NOT EXISTS for idempotency.
-- ============================================================================

-- Personal information
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "numberOfChildren" INTEGER;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;

-- Social / tax identifiers
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "cnssNumber" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "ifuNumber" TEXT;

-- Termination tracking
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationType" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationDetails" JSONB;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMP WITH TIME ZONE;

-- Schools: add missing city and department columns (referenced by contract generation queries)
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "department" TEXT;

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS "staff_nationalId_idx" ON "staff"("nationalId");
CREATE INDEX IF NOT EXISTS "staff_cnssNumber_idx" ON "staff"("cnssNumber");
