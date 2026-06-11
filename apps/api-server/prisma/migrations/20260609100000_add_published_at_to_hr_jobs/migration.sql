-- Add publishedAt column to hr_jobs table
-- This field tracks when a job offer was published or republished.
-- When an offer is created with status PUBLIÉE, publishedAt is set to now().
-- When an offer is deactivated (DÉSACTIVÉE), publishedAt is preserved.
-- When an offer is republished, publishedAt is updated to now().

ALTER TABLE "hr_jobs" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Backfill: set publishedAt to createdAt for jobs that are already PUBLIÉE
UPDATE "hr_jobs" SET "publishedAt" = "createdAt" WHERE "status" = 'PUBLIÉE';
