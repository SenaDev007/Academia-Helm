-- =============================================================================
-- Finance: Sous-modules 5 (Dépenses & Budget), 6 (Clôture), 7 (Rapports), 8 (Paramétrage), Extension (Audit, Anomalies, Caisses)
-- =============================================================================

-- Enums
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ClosureType" AS ENUM ('MANUAL', 'AUTO');

-- FinanceExpense (SM5)
CREATE TABLE "finance_expenses" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "finance_expenses_tenantId_academicYearId_idx" ON "finance_expenses"("tenantId", "academicYearId");
CREATE INDEX "finance_expenses_categoryId_idx" ON "finance_expenses"("categoryId");
CREATE INDEX "finance_expenses_status_idx" ON "finance_expenses"("status");
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FinanceBudget (SM5)
CREATE TABLE "finance_budgets" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "allocatedAmount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_budgets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_budgets_tenantId_academicYearId_categoryId_key" UNIQUE ("tenantId", "academicYearId", "categoryId")
);
CREATE INDEX "finance_budgets_tenantId_academicYearId_idx" ON "finance_budgets"("tenantId", "academicYearId");
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinanceDailyClosure (SM6)
CREATE TABLE "finance_daily_closures" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "totalIncome" DECIMAL(12,2) NOT NULL,
  "totalExpense" DECIMAL(12,2) NOT NULL,
  "netBalance" DECIMAL(12,2) NOT NULL,
  "closureType" "ClosureType" NOT NULL DEFAULT 'MANUAL',
  "validatedById" TEXT,
  "validatedAt" TIMESTAMP(3),
  "anomalyDetected" BOOLEAN NOT NULL DEFAULT false,
  "anomalyNote" TEXT,
  "physicalAmount" DECIMAL(12,2),
  "discrepancy" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_daily_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_daily_closures_tenantId_academicYearId_date_key" UNIQUE ("tenantId", "academicYearId", "date")
);
CREATE INDEX "finance_daily_closures_tenantId_academicYearId_idx" ON "finance_daily_closures"("tenantId", "academicYearId");
CREATE INDEX "finance_daily_closures_date_idx" ON "finance_daily_closures"("date");
ALTER TABLE "finance_daily_closures" ADD CONSTRAINT "finance_daily_closures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_daily_closures" ADD CONSTRAINT "finance_daily_closures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_daily_closures" ADD CONSTRAINT "finance_daily_closures_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FinancialReportExport (SM7)
CREATE TABLE "financial_report_exports" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "generatedById" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_report_exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "financial_report_exports_tenantId_academicYearId_idx" ON "financial_report_exports"("tenantId", "academicYearId");
ALTER TABLE "financial_report_exports" ADD CONSTRAINT "financial_report_exports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_report_exports" ADD CONSTRAINT "financial_report_exports_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_report_exports" ADD CONSTRAINT "financial_report_exports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinancialSettings (SM8)
CREATE TABLE "financial_settings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "blockingThreshold" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "allowPartialPayment" BOOLEAN NOT NULL DEFAULT true,
  "minimumInstallmentAmount" DECIMAL(12,2),
  "autoClosureEnabled" BOOLEAN NOT NULL DEFAULT true,
  "autoClosureTime" TEXT NOT NULL DEFAULT '23:59',
  "reminderWarningDays" INTEGER NOT NULL DEFAULT 3,
  "reminderUrgentDays" INTEGER NOT NULL DEFAULT 7,
  "reminderFinalDays" INTEGER NOT NULL DEFAULT 15,
  "cancellationDelayHours" INTEGER NOT NULL DEFAULT 24,
  "budgetAlertThreshold" INTEGER NOT NULL DEFAULT 85,
  "expenseReceiptThreshold" DECIMAL(12,2),
  "fedapayEnabled" BOOLEAN NOT NULL DEFAULT false,
  "fedapayPublicKey" TEXT,
  "fedapaySecretKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_settings_tenantId_key" UNIQUE ("tenantId")
);
CREATE INDEX "financial_settings_tenantId_idx" ON "financial_settings"("tenantId");
ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinancialAuditLog (Extension)
CREATE TABLE "financial_audit_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "performedById" TEXT NOT NULL,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "deviceId" TEXT,
  CONSTRAINT "financial_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "financial_audit_logs_tenantId_entityType_entityId_idx" ON "financial_audit_logs"("tenantId", "entityType", "entityId");
CREATE INDEX "financial_audit_logs_performedAt_idx" ON "financial_audit_logs"("performedAt");
ALTER TABLE "financial_audit_logs" ADD CONSTRAINT "financial_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_audit_logs" ADD CONSTRAINT "financial_audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinancialAnomaly (Extension)
CREATE TABLE "financial_anomalies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "financial_anomalies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "financial_anomalies_tenantId_type_idx" ON "financial_anomalies"("tenantId", "type");
CREATE INDEX "financial_anomalies_detectedAt_idx" ON "financial_anomalies"("detectedAt");
ALTER TABLE "financial_anomalies" ADD CONSTRAINT "financial_anomalies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CashRegister (Extension)
CREATE TABLE "cash_registers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cash_registers_tenantId_idx" ON "cash_registers"("tenantId");
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinanceTransaction: cashRegisterId, integrityHash
ALTER TABLE "finance_transactions" ADD COLUMN IF NOT EXISTS "cashRegisterId" TEXT;
ALTER TABLE "finance_transactions" ADD COLUMN IF NOT EXISTS "integrityHash" TEXT;
CREATE INDEX IF NOT EXISTS "finance_transactions_cashRegisterId_idx" ON "finance_transactions"("cashRegisterId");
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigger: empêcher suppression finance_expenses
CREATE OR REPLACE FUNCTION prevent_finance_expense_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of finance expense is forbidden';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS no_delete_finance_expense ON "finance_expenses";
CREATE TRIGGER no_delete_finance_expense
BEFORE DELETE ON "finance_expenses"
FOR EACH ROW EXECUTE PROCEDURE prevent_finance_expense_delete();

-- Trigger: interdire modification transaction après clôture (table finance_daily_closures)
CREATE OR REPLACE FUNCTION prevent_update_after_closure()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "finance_daily_closures" c
    WHERE c."tenantId" = NEW."tenantId"
      AND c."academicYearId" = NEW."academicYearId"
      AND c.date = (NEW."createdAt")::date
  ) THEN
    RAISE EXCEPTION 'Transaction locked after closure';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS lock_transaction_after_closure ON "finance_transactions";
CREATE TRIGGER lock_transaction_after_closure
BEFORE UPDATE ON "finance_transactions"
FOR EACH ROW EXECUTE PROCEDURE prevent_update_after_closure();
