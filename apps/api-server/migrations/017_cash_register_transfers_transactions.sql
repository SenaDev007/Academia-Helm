-- ============================================================================
-- Migration 017 : Création tables cash_register_transfers + cash_register_transactions
-- ============================================================================
-- Ces tables sont utilisées par cash-register.service.ts via $executeRaw et $queryRaw
-- mais n'ont jamais été créées en base → erreurs silencieuses sur transfers/stats.
-- ============================================================================

-- cash_register_transfers : transferts entre caisses
CREATE TABLE IF NOT EXISTS "cash_register_transfers" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  "fromCashRegisterId" TEXT NOT NULL,
  "toCashRegisterId" TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT,
  reference TEXT,
  "userId" TEXT,
  status TEXT DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_register_transfers_fromCashRegisterId_fkey"
    FOREIGN KEY ("fromCashRegisterId") REFERENCES "cash_registers"("id") ON DELETE CASCADE,
  CONSTRAINT "cash_register_transfers_toCashRegisterId_fkey"
    FOREIGN KEY ("toCashRegisterId") REFERENCES "cash_registers"("id") ON DELETE CASCADE,
  CONSTRAINT "cash_register_transfers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "cash_register_transfers_tenantId_idx" ON "cash_register_transfers"("tenantId");
CREATE INDEX IF NOT EXISTS "cash_register_transfers_fromCashRegisterId_idx" ON "cash_register_transfers"("fromCashRegisterId");
CREATE INDEX IF NOT EXISTS "cash_register_transfers_toCashRegisterId_idx" ON "cash_register_transfers"("toCashRegisterId");

-- cash_register_transactions : journal des mouvements de caisse
CREATE TABLE IF NOT EXISTS "cash_register_transactions" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  "cashRegisterId" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  direction TEXT NOT NULL,
  note TEXT,
  reference TEXT,
  "userId" TEXT,
  "relatedTransferId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_register_transactions_cashRegisterId_fkey"
    FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE CASCADE,
  CONSTRAINT "cash_register_transactions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "cash_register_transactions_relatedTransferId_fkey"
    FOREIGN KEY ("relatedTransferId") REFERENCES "cash_register_transfers"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "cash_register_transactions_tenantId_idx" ON "cash_register_transactions"("tenantId");
CREATE INDEX IF NOT EXISTS "cash_register_transactions_cashRegisterId_idx" ON "cash_register_transactions"("cashRegisterId");
CREATE INDEX IF NOT EXISTS "cash_register_transactions_createdAt_idx" ON "cash_register_transactions"("createdAt");
