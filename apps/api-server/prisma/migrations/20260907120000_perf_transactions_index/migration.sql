-- PERF 2026-09-07 : index composite pour la pagination des transactions
-- (module Finance > Encaissement : WHERE tenantId+academicYearId ORDER BY createdAt DESC LIMIT)
-- Créé également de façon idempotente par le bootstrap main.ts (CREATE INDEX IF NOT EXISTS).

-- DropIndex
-- DROP INDEX "finance_transactions_tenantId_academicYearId_idx"; -- conservé (utilisé par COUNT et autres filtres)

-- CreateIndex
CREATE INDEX IF NOT EXISTS "finance_transactions_tenant_year_created_idx" ON "finance_transactions"("tenantId", "academicYearId", "createdAt" DESC);
