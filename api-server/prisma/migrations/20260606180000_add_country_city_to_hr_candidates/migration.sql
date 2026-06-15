-- AlterTable: Add country and city fields to hr_candidates
ALTER TABLE "hr_candidates" ADD COLUMN "country" TEXT;
ALTER TABLE "hr_candidates" ADD COLUMN "city" TEXT;

-- CreateIndex: Add indexes for country and city (used for application statistics aggregation)
CREATE INDEX "hr_candidates_country_idx" ON "hr_candidates"("country");
CREATE INDEX "hr_candidates_city_idx" ON "hr_candidates"("city");
