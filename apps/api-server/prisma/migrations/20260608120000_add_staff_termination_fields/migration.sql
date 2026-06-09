-- Migration: Add termination tracking fields to staff table
-- Date: 2026-06-08
-- Description: Professional employee departure/termination tracking

-- Add termination type column
ALTER TABLE staff ADD COLUMN IF NOT EXISTS "terminationType" TEXT;

-- Add termination details JSONB column (stores structured termination data)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS "terminationDetails" JSONB;

-- Add terminated at timestamp
ALTER TABLE staff ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMPTZ;

-- Add notice period days
ALTER TABLE staff ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER;

-- Add last working date
ALTER TABLE staff ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMPTZ;

-- Add index on terminationType for filtering
CREATE INDEX IF NOT EXISTS "staff_terminationType_idx" ON staff("terminationType");

-- Add index on terminatedAt for reporting
CREATE INDEX IF NOT EXISTS "staff_terminatedAt_idx" ON staff("terminatedAt");
