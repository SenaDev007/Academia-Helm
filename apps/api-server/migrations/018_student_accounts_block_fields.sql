-- ============================================================================
-- Migration 018 : Ajout des colonnes blockReason, blockDate, unblockDate à student_accounts
-- ============================================================================
-- Le modèle Prisma StudentAccount (schema.prisma ~10468) a ces colonnes mais
-- elles n'existent pas en base → erreur P2022 "colonne manquante" sur TOUTES
-- les requêtes qui incluent studentAccount (transactions, accounts, etc.)
-- ============================================================================

ALTER TABLE "student_accounts"
  ADD COLUMN IF NOT EXISTS "blockReason" TEXT,
  ADD COLUMN IF NOT EXISTS "blockDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unblockDate" TIMESTAMP(3);
