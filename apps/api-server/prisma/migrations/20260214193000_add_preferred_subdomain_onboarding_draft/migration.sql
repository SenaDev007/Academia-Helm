-- AlterTable (IF NOT EXISTS pour réexécution sans erreur)
ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "preferred_subdomain" TEXT;
