-- =============================================================================
-- Sous-modules Finance : enums (spec institutionnelle) + table allocations
-- =============================================================================

-- FeeType (sous-module 1)
DO $$ BEGIN
  CREATE TYPE "FeeType" AS ENUM ('INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'ANNEX', 'EXCEPTIONAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "fee_structures" ALTER COLUMN "feeType" TYPE "FeeType" USING "feeType"::"FeeType";

-- AccountStatus (sous-module 2)
DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PARTIAL', 'PAID', 'OVERDUE', 'BLOCKED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- Supprimer la valeur par défaut avant conversion, puis la rétablir (évite erreur 42804)
ALTER TABLE "student_accounts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "student_accounts" ALTER COLUMN "status" TYPE "AccountStatus" USING "status"::text::"AccountStatus";
ALTER TABLE "student_accounts" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"AccountStatus";

-- TransactionType & PaymentMethod (sous-module 3)
DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REVERSAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "finance_transactions" ALTER COLUMN "type" TYPE "TransactionType" USING (CASE WHEN "type" = 'REVERSAL' THEN 'REVERSAL'::"TransactionType" ELSE 'PAYMENT'::"TransactionType" END);
ALTER TABLE "finance_transactions" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING (CASE WHEN "paymentMethod" IN ('CASH','MOBILE_MONEY','WIRE','FEDAPAY') THEN "paymentMethod"::"PaymentMethod" ELSE 'CASH'::"PaymentMethod" END);

-- ReminderLevel & ReminderChannel (sous-module 4)
DO $$ BEGIN
  CREATE TYPE "ReminderLevel" AS ENUM ('WARNING', 'URGENT', 'FINAL_NOTICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "recovery_reminders" ALTER COLUMN "reminderLevel" TYPE "ReminderLevel" USING (CASE WHEN "reminderLevel" IN ('WARNING','URGENT','FINAL_NOTICE') THEN "reminderLevel"::"ReminderLevel" ELSE 'WARNING'::"ReminderLevel" END);
ALTER TABLE "recovery_reminders" ALTER COLUMN "sentVia" TYPE "ReminderChannel" USING (CASE WHEN "sentVia" IN ('SMS','WHATSAPP','EMAIL') THEN "sentVia"::"ReminderChannel" ELSE 'SMS'::"ReminderChannel" END);

-- Table allocations (imputation par transaction, pour annulation correcte)
CREATE TABLE IF NOT EXISTS "finance_transaction_allocations" (
  "id" TEXT NOT NULL,
  "financeTransactionId" TEXT NOT NULL,
  "accountBreakdownId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,

  CONSTRAINT "finance_transaction_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_transaction_allocations_financeTransactionId_accountBreakdownId_key" UNIQUE ("financeTransactionId", "accountBreakdownId")
);
CREATE INDEX IF NOT EXISTS "finance_transaction_allocations_financeTransactionId_idx" ON "finance_transaction_allocations"("financeTransactionId");
CREATE INDEX IF NOT EXISTS "finance_transaction_allocations_accountBreakdownId_idx" ON "finance_transaction_allocations"("accountBreakdownId");
ALTER TABLE "finance_transaction_allocations" ADD CONSTRAINT "finance_transaction_allocations_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_transaction_allocations" ADD CONSTRAINT "finance_transaction_allocations_accountBreakdownId_fkey" FOREIGN KEY ("accountBreakdownId") REFERENCES "account_breakdowns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
