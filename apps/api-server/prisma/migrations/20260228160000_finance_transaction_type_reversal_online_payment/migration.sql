-- AlterTable: Payment — annulation = écriture inverse (REVERSAL), jamais suppression
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "transactionType" TEXT NOT NULL DEFAULT 'PAYMENT';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversedFromId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

-- FK pour reversedFromId (self)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_reversedFromId_fkey'
  ) THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_reversedFromId_fkey"
      FOREIGN KEY ("reversedFromId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payments_transactionType_idx" ON "payments"("transactionType");
CREATE INDEX IF NOT EXISTS "payments_reversedFromId_idx" ON "payments"("reversedFromId");

-- CreateTable: OnlinePayment (Fedapay / paiements en ligne)
CREATE TABLE IF NOT EXISTS "online_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "online_payments_idempotencyKey_key" ON "online_payments"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "online_payments_tenantId_idx" ON "online_payments"("tenantId");
CREATE INDEX IF NOT EXISTS "online_payments_studentId_idx" ON "online_payments"("studentId");
CREATE INDEX IF NOT EXISTS "online_payments_providerRef_idx" ON "online_payments"("providerRef");
CREATE INDEX IF NOT EXISTS "online_payments_status_idx" ON "online_payments"("status");

ALTER TABLE "online_payments" DROP CONSTRAINT IF EXISTS "online_payments_tenantId_fkey";
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "online_payments" DROP CONSTRAINT IF EXISTS "online_payments_studentId_fkey";
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger: interdire la suppression des paiements (audit-proof)
CREATE OR REPLACE FUNCTION prevent_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of financial transactions (payments) is forbidden. Use reversal (écriture inverse) instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_payment ON "payments";
CREATE TRIGGER no_delete_payment
  BEFORE DELETE ON "payments"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_payment_delete();
