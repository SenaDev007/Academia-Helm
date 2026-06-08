-- Appliquer uniquement la colonne seriesId sur education_grades (si la table education_series existe déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'education_grades' AND column_name = 'seriesId'
  ) THEN
    ALTER TABLE "education_grades" ADD COLUMN "seriesId" TEXT;
    CREATE INDEX "education_grades_seriesId_idx" ON "education_grades"("seriesId");
    ALTER TABLE "education_grades" ADD CONSTRAINT "education_grades_seriesId_fkey"
      FOREIGN KEY ("seriesId") REFERENCES "education_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
