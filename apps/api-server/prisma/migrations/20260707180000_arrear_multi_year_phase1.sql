-- Migration Phase 1: Accumulation arriérés multi-années
-- 1. Ajouter status à fee_arrears (OPEN | PARTIALLY_PAID | PAID | WRITTEN_OFF | TRANSFERRED)
-- 2. Ajouter carriedArrears à student_accounts
-- 3. Créer la table arrear_transfers

-- 1. fee_arrears.status
ALTER TABLE "fee_arrears" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN';
CREATE INDEX IF NOT EXISTS "fee_arrears_status_idx" ON "fee_arrears" ("status");

-- 2. student_accounts.carriedArrears
ALTER TABLE "student_accounts" ADD COLUMN IF NOT EXISTS "carriedArrears" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3. Table arrear_transfers
CREATE TABLE IF NOT EXISTS "arrear_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentAccountId" TEXT NOT NULL,
    "fromAcademicYearId" TEXT NOT NULL,
    "toAcademicYearId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "feeArrearId" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "arrear_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "arrear_transfers_tenantId_toAcademicYearId_idx" ON "arrear_transfers" ("tenantId", "toAcademicYearId");
CREATE INDEX IF NOT EXISTS "arrear_transfers_studentId_idx" ON "arrear_transfers" ("studentId");
CREATE INDEX IF NOT EXISTS "arrear_transfers_fromAcademicYearId_idx" ON "arrear_transfers" ("fromAcademicYearId");

ALTER TABLE "arrear_transfers"
    ADD CONSTRAINT "arrear_transfers_studentAccountId_fkey"
    FOREIGN KEY ("studentAccountId") REFERENCES "student_accounts"("id") ON DELETE CASCADE;

ALTER TABLE "arrear_transfers"
    ADD CONSTRAINT "arrear_transfers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "arrear_transfers"
    ADD CONSTRAINT "arrear_transfers_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;
