-- Option bilingue : colonnes language (FR|EN) et champs settings
-- Exécutable sans reset. Les colonnes sont ajoutées si elles n'existent pas.

-- settings_bilingual
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
