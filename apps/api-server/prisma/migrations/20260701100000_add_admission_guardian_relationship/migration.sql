-- Add mainGuardianRelationship column to admissions
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "mainGuardianRelationship" TEXT;
