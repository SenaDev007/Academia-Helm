-- ============================================================================
-- Migration: Admission full spec — missing fields + AdmissionDocument + AdmissionInterview
-- ============================================================================

-- ─── Ajouter colonnes manquantes à admissions ───────────────────────────────
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "previousLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "changeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "mainGuardianAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "mainGuardianProfession" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewComment" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionComment" TEXT,
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

-- ─── Créer table admission_documents ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "admission_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admission_documents_tenantId_idx" ON "admission_documents"("tenantId");
CREATE INDEX IF NOT EXISTS "admission_documents_admissionId_idx" ON "admission_documents"("admissionId");
CREATE INDEX IF NOT EXISTS "admission_documents_documentType_idx" ON "admission_documents"("documentType");
CREATE INDEX IF NOT EXISTS "admission_documents_status_idx" ON "admission_documents"("status");

ALTER TABLE "admission_documents"
  ADD CONSTRAINT "admission_documents_admissionId_fkey"
  FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE;

ALTER TABLE "admission_documents"
  ADD CONSTRAINT "admission_documents_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

-- ─── Créer table admission_interviews ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "admission_interviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "scheduledAt" TIMESTAMP(3),
    "conductedAt" TIMESTAMP(3),
    "responsibleId" TEXT,
    "result" TEXT,
    "score" DOUBLE PRECISION,
    "comment" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_interviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admission_interviews_tenantId_idx" ON "admission_interviews"("tenantId");
CREATE INDEX IF NOT EXISTS "admission_interviews_admissionId_idx" ON "admission_interviews"("admissionId");
CREATE INDEX IF NOT EXISTS "admission_interviews_type_idx" ON "admission_interviews"("type");
CREATE INDEX IF NOT EXISTS "admission_interviews_status_idx" ON "admission_interviews"("status");

ALTER TABLE "admission_interviews"
  ADD CONSTRAINT "admission_interviews_admissionId_fkey"
  FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE;

ALTER TABLE "admission_interviews"
  ADD CONSTRAINT "admission_interviews_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
