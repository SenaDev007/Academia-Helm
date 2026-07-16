-- ============================================================================
-- Migration 016 : Ajout cashRegisterId + pendingApproverId à finance_expenses
-- ============================================================================
-- Le modèle Prisma FinanceExpense référence ces colonnes (schema.prisma lignes 5011-5013)
-- mais aucune migration ne les a créées en base → erreur P2022 quand cash-register.service.ts
-- fait un include: { expenseDebits: { where: { status: 'APPROVED' } } } dans findOne().
-- ============================================================================

ALTER TABLE "finance_expenses"
  ADD COLUMN IF NOT EXISTS "cashRegisterId" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingApproverId" TEXT;

-- FK vers cash_registers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_expenses_cashRegisterId_fkey') THEN
    ALTER TABLE "finance_expenses"
      ADD CONSTRAINT "finance_expenses_cashRegisterId_fkey"
      FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_expenses_pendingApproverId_fkey') THEN
    ALTER TABLE "finance_expenses"
      ADD CONSTRAINT "finance_expenses_pendingApproverId_fkey"
      FOREIGN KEY ("pendingApproverId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "finance_expenses_cashRegisterId_idx" ON "finance_expenses"("cashRegisterId");
CREATE INDEX IF NOT EXISTS "finance_expenses_pendingApproverId_idx" ON "finance_expenses"("pendingApproverId");
