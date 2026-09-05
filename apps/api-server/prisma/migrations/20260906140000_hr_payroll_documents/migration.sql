-- ============================================================================
-- RH Bénin — Documents de paie officiels FP / EP (fiches + états de paiement)
-- Migration 20260906140000 — idempotent (CREATE TABLE IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
--
--   payroll_documents          : snapshot figé + SHA-256 + numérotation FP/EP
--   payroll_document_sequences : allocation atomique des numéros (UPSERT RETURNING)
--   payroll_fiscal_rates       : + joursCongesParMois (congés payés / mois, barème)
--
-- Le type de document (FICHE_DE_PAIE / ETAT_DE_PAIEMENT) est TOUJOURS dérivé du
-- statut contractuel — jamais saisi. Un document émis est immuable : pas
-- d'UPDATE de contenu, une seule émission par ligne de paie (unique), et le
-- PDF archivé est scellé par son SHA-256 (contentHash).
-- ============================================================================

-- ── 1. Barème : jours de congés payés par mois (1,5 par défaut — à confirmer 2) ──
ALTER TABLE "payroll_fiscal_rates" ADD COLUMN IF NOT EXISTS "joursCongesParMois" DECIMAL(4,2) NOT NULL DEFAULT 1.5;
UPDATE "payroll_fiscal_rates" SET "joursCongesParMois" = 1.5 WHERE "joursCongesParMois" IS NULL;

-- ── 2. Table : payroll_documents (documents émis, immuables) ──────────────
CREATE TABLE IF NOT EXISTS "payroll_documents" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT,
    "staffId"         TEXT NOT NULL,
    "payrollItemId"   TEXT,
    "documentType"    TEXT NOT NULL,
    "documentNumber"  TEXT NOT NULL,
    "periodYear"      INTEGER NOT NULL,
    "periodMonth"     INTEGER NOT NULL,
    "fiscalYear"      INTEGER NOT NULL,
    "periodLabel"     TEXT NOT NULL,
    "statutContractuel" TEXT,
    "snapshot"        JSONB NOT NULL,
    "contentHash"     TEXT NOT NULL,
    "filePath"        TEXT,
    "issuedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy"        TEXT,
    "issuedByName"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_pd_staff" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_pd_payroll_item" FOREIGN KEY ("payrollItemId") REFERENCES "payroll_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_pd_academic_year" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_pd_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Un numéro de document par tenant (FP-2026-000001 / EP-2026-000045)
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_documents_documentNumber_key" ON "payroll_documents"("documentNumber");
-- Une seule émission par ligne de paie → immuabilité garantie par la contrainte
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_documents_payrollItemId_key" ON "payroll_documents"("payrollItemId");
CREATE INDEX IF NOT EXISTS "payroll_documents_tenantId_fiscalYear_documentType_idx" ON "payroll_documents"("tenantId", "fiscalYear", "documentType");
CREATE INDEX IF NOT EXISTS "payroll_documents_tenantId_periodYear_periodMonth_idx" ON "payroll_documents"("tenantId", "periodYear", "periodMonth");
CREATE INDEX IF NOT EXISTS "payroll_documents_staffId_idx" ON "payroll_documents"("staffId");
CREATE INDEX IF NOT EXISTS "payroll_documents_documentType_idx" ON "payroll_documents"("documentType");
CREATE INDEX IF NOT EXISTS "payroll_documents_issuedAt_idx" ON "payroll_documents"("issuedAt");

-- ── 3. Table : payroll_document_sequences (numérotation atomique) ─────────
CREATE TABLE IF NOT EXISTS "payroll_document_sequences" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "tenantId"     TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fiscalYear"   INTEGER NOT NULL,
    "lastNumber"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_pds_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_document_sequences_tenantId_documentType_fiscalYear_key" ON "payroll_document_sequences"("tenantId", "documentType", "fiscalYear");
