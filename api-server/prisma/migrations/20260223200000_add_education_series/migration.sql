-- Série du 2nd cycle secondaire (Bénin) : A1, A2, B, C, D
-- + lien optionnel seriesId sur education_grades

-- CreateTable
CREATE TABLE "education_series" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_series_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "education_series_tenantId_code_key" ON "education_series"("tenantId", "code");
CREATE INDEX "education_series_tenantId_idx" ON "education_series"("tenantId");

ALTER TABLE "education_series" ADD CONSTRAINT "education_series_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn seriesId to education_grades (nullable)
ALTER TABLE "education_grades" ADD COLUMN "seriesId" TEXT;

CREATE INDEX "education_grades_seriesId_idx" ON "education_grades"("seriesId");

ALTER TABLE "education_grades" ADD CONSTRAINT "education_grades_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "education_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
