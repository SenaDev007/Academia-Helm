-- Module 1: students (identite/regime), student_enrollments (previousArrears), national_export_logs

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "placeOfBirth" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "legalDocumentType" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "legalDocumentNumber" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "regimeType" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "previousArrears" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "national_export_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "national_export_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "national_export_logs_tenantId_idx" ON "national_export_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "national_export_logs_studentId_idx" ON "national_export_logs"("studentId");
CREATE INDEX IF NOT EXISTS "national_export_logs_exportType_exportedAt_idx" ON "national_export_logs"("exportType", "exportedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'national_export_logs_tenantId_fkey') THEN
    ALTER TABLE "national_export_logs" ADD CONSTRAINT "national_export_logs_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'national_export_logs_studentId_fkey') THEN
    ALTER TABLE "national_export_logs" ADD CONSTRAINT "national_export_logs_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "students_regimeType_idx" ON "students"("tenantId", "regimeType");
CREATE INDEX IF NOT EXISTS "students_isActive_idx" ON "students"("tenantId", "isActive");
