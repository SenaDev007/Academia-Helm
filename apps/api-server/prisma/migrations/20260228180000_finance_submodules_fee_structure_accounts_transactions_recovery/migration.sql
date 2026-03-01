-- =============================================================================
-- SOUS-MODULES FINANCE 1-4 : FeeStructure, StudentAccount, AccountBreakdown,
-- FinanceTransaction, RecoveryReminder + triggers (spec Academia Helm)
-- =============================================================================

-- FeeStructure (config frais institutionnelle)
CREATE TABLE IF NOT EXISTS "fee_structures" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "levelId" TEXT,
  "classId" TEXT,
  "name" TEXT NOT NULL,
  "feeType" TEXT NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "isInstallment" BOOLEAN NOT NULL DEFAULT false,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fee_structures_tenantId_academicYearId_idx" ON "fee_structures"("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "fee_structures_levelId_idx" ON "fee_structures"("levelId");
CREATE INDEX IF NOT EXISTS "fee_structures_classId_idx" ON "fee_structures"("classId");
CREATE INDEX IF NOT EXISTS "fee_structures_feeType_idx" ON "fee_structures"("feeType");
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FeeStructureInstallment
CREATE TABLE IF NOT EXISTS "fee_structure_installments" (
  "id" TEXT NOT NULL,
  "feeStructureId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "orderIndex" INTEGER NOT NULL,

  CONSTRAINT "fee_structure_installments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fee_structure_installments_feeStructureId_idx" ON "fee_structure_installments"("feeStructureId");
ALTER TABLE "fee_structure_installments" ADD CONSTRAINT "fee_structure_installments_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FeeOverride
CREATE TABLE IF NOT EXISTS "fee_overrides" (
  "id" TEXT NOT NULL,
  "feeStructureId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "customAmount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_overrides_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fee_overrides_feeStructureId_idx" ON "fee_overrides"("feeStructureId");
CREATE INDEX IF NOT EXISTS "fee_overrides_studentId_idx" ON "fee_overrides"("studentId");
ALTER TABLE "fee_overrides" ADD CONSTRAINT "fee_overrides_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_overrides" ADD CONSTRAINT "fee_overrides_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_overrides" ADD CONSTRAINT "fee_overrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigger: interdire suppression FeeStructure
CREATE OR REPLACE FUNCTION prevent_fee_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of fee structure is forbidden. Use historisation (désactiver + nouvelle version).';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS no_delete_fee ON "fee_structures";
CREATE TRIGGER no_delete_fee BEFORE DELETE ON "fee_structures" FOR EACH ROW EXECUTE PROCEDURE prevent_fee_delete();

-- StudentAccount
CREATE TABLE IF NOT EXISTS "student_accounts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "totalDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "arrearsAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_accounts_studentId_academicYearId_key" UNIQUE ("studentId", "academicYearId")
);
CREATE INDEX IF NOT EXISTS "student_accounts_tenantId_academicYearId_idx" ON "student_accounts"("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "student_accounts_studentId_idx" ON "student_accounts"("studentId");
CREATE INDEX IF NOT EXISTS "student_accounts_status_idx" ON "student_accounts"("status");
CREATE INDEX IF NOT EXISTS "student_accounts_isBlocked_idx" ON "student_accounts"("isBlocked");
ALTER TABLE "student_accounts" ADD CONSTRAINT "student_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_accounts" ADD CONSTRAINT "student_accounts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_accounts" ADD CONSTRAINT "student_accounts_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccountBreakdown
CREATE TABLE IF NOT EXISTS "account_breakdowns" (
  "id" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "feeStructureId" TEXT NOT NULL,
  "initialAmount" DECIMAL(10,2) NOT NULL,
  "adjustedAmount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "remainingAmount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_breakdowns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "account_breakdowns_studentAccountId_idx" ON "account_breakdowns"("studentAccountId");
CREATE INDEX IF NOT EXISTS "account_breakdowns_feeStructureId_idx" ON "account_breakdowns"("feeStructureId");
ALTER TABLE "account_breakdowns" ADD CONSTRAINT "account_breakdowns_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "student_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_breakdowns" ADD CONSTRAINT "account_breakdowns_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinanceTransaction
CREATE TABLE IF NOT EXISTS "finance_transactions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "reference" TEXT,
  "reversedFromId" TEXT,
  "cashierId" TEXT NOT NULL,
  "deviceId" TEXT,
  "receiptNumber" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_transactions_receiptNumber_key" UNIQUE ("receiptNumber")
);
CREATE INDEX IF NOT EXISTS "finance_transactions_tenantId_academicYearId_idx" ON "finance_transactions"("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "finance_transactions_studentAccountId_idx" ON "finance_transactions"("studentAccountId");
CREATE INDEX IF NOT EXISTS "finance_transactions_type_idx" ON "finance_transactions"("type");
CREATE INDEX IF NOT EXISTS "finance_transactions_reversedFromId_idx" ON "finance_transactions"("reversedFromId");
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "student_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_reversedFromId_fkey" FOREIGN KEY ("reversedFromId") REFERENCES "finance_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigger: interdire suppression FinanceTransaction
CREATE OR REPLACE FUNCTION prevent_finance_transaction_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of finance transactions is forbidden. Use reversal (écriture inverse).';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS no_delete_finance_transaction ON "finance_transactions";
CREATE TRIGGER no_delete_finance_transaction BEFORE DELETE ON "finance_transactions" FOR EACH ROW EXECUTE PROCEDURE prevent_finance_transaction_delete();

-- RecoveryReminder
CREATE TABLE IF NOT EXISTS "recovery_reminders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "reminderLevel" TEXT NOT NULL,
  "amountDue" DECIMAL(10,2) NOT NULL,
  "sentVia" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBySystem" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "recovery_reminders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recovery_reminders_tenantId_academicYearId_idx" ON "recovery_reminders"("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "recovery_reminders_studentAccountId_idx" ON "recovery_reminders"("studentAccountId");
CREATE INDEX IF NOT EXISTS "recovery_reminders_reminderLevel_idx" ON "recovery_reminders"("reminderLevel");
CREATE INDEX IF NOT EXISTS "recovery_reminders_sentAt_idx" ON "recovery_reminders"("sentAt");
ALTER TABLE "recovery_reminders" ADD CONSTRAINT "recovery_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_reminders" ADD CONSTRAINT "recovery_reminders_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_reminders" ADD CONSTRAINT "recovery_reminders_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "student_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Règle métier : totalDue/totalPaid/balance ne doivent être modifiés que par la logique métier (trigger sur FinanceTransaction ou service). Pas de trigger ici pour permettre le recalcul automatique du solde après INSERT transaction.

-- Règle métier : isBlocked ne doit être modifié que via les endpoints dédiés (blocage auto / levée directeur) avec audit log.
