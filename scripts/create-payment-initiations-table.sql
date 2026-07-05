-- Table: payment_initiations
-- Stocke les métadonnées des initiations de paiement en ligne (FeexPay/Fedapay)
-- pour que les webhooks puissent créer les FinanceTransactions après confirmation.

CREATE TABLE IF NOT EXISTS "payment_initiations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "studentAccountId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "phone" TEXT,
    "operator" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "payment_initiations_pkey" PRIMARY KEY ("id")
);

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS "payment_initiations_reference_key" ON "payment_initiations"("reference");
CREATE INDEX IF NOT EXISTS "payment_initiations_tenantId_idx" ON "payment_initiations"("tenantId");
CREATE INDEX IF NOT EXISTS "payment_initiations_reference_idx" ON "payment_initiations"("reference");
CREATE INDEX IF NOT EXISTS "payment_initiations_status_idx" ON "payment_initiations"("status");
CREATE INDEX IF NOT EXISTS "payment_initiations_studentAccountId_idx" ON "payment_initiations"("studentAccountId");

-- Contrainte de clé étrangère vers Tenant
ALTER TABLE "payment_initiations" 
  ADD CONSTRAINT "payment_initiations_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
