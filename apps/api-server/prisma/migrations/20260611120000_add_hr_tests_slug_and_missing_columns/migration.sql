-- ============================================================================
-- Add missing columns to hr_jobs, hr_tests, and hr_test_results
-- These columns exist in the Prisma schema but were never created in the DB.
-- ============================================================================

-- ─── hr_jobs: add slug column ─────────────────────────────────────────────
ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill slug from ref for existing rows (slug must be unique & non-null)
UPDATE "hr_jobs" SET "slug" = "ref" WHERE "slug" IS NULL;

-- Make slug NOT NULL now that all rows have a value
ALTER TABLE "hr_jobs" ALTER COLUMN "slug" SET NOT NULL;

-- Add unique constraint on slug
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_jobs_slug_key') THEN
        ALTER TABLE "hr_jobs" ADD CONSTRAINT "hr_jobs_slug_key" UNIQUE ("slug");
    END IF;
END $$;

-- ─── hr_tests: add missing columns ────────────────────────────────────────
ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "maxScore" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "passingScore" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIF';
ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── hr_test_results: add missing columns ─────────────────────────────────
ALTER TABLE "hr_test_results" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "hr_test_results" ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3);
