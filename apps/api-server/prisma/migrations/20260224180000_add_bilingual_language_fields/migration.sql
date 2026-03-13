-- Option bilingue : colonnes language (FR|EN) et champs settings
-- Exécutable sans reset. Les colonnes sont ajoutées si elles n'existent pas.

-- settings_bilingual (création si absente, puis ajout de colonnes)
CREATE TABLE IF NOT EXISTS "settings_bilingual" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "separateSubjects" BOOLEAN NOT NULL DEFAULT true,
  "separateGrades" BOOLEAN NOT NULL DEFAULT true,
  "defaultUILanguage" TEXT NOT NULL DEFAULT 'FR',
  "migrationRequired" BOOLEAN NOT NULL DEFAULT false,
  "migrationStatus" TEXT,
  "migratedAt" TIMESTAMP(3),
  "billingImpactAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settings_bilingual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "settings_bilingual_tenantId_key" ON "settings_bilingual"("tenantId");
ALTER TABLE "settings_bilingual" DROP CONSTRAINT IF EXISTS "settings_bilingual_tenantId_fkey";
ALTER TABLE "settings_bilingual" ADD CONSTRAINT "settings_bilingual_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT DEFAULT 'FR';
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pricingSupplement" INTEGER DEFAULT 0;
UPDATE "settings_bilingual" SET "defaultLanguage" = COALESCE("defaultLanguage", 'FR') WHERE "defaultLanguage" IS NULL;

-- subjects
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- grades
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- exam_scores
ALTER TABLE "exam_scores" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- report_cards
ALTER TABLE "report_cards" ADD COLUMN IF NOT EXISTS "language" TEXT;
