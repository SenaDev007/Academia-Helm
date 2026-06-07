-- Alignement schéma / base : colonnes manquantes sur academic_years
-- (isClosed, createdBy, closedAt, closedBy, subscription_id)

ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "isClosed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "closedBy" TEXT;
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "subscription_id" TEXT;
