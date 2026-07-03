-- ============================================================================
-- Migration : Ajout des champs bancaires à cash_registers
-- ============================================================================
-- Objectif : Permettre de stocker les informations bancaires pour les caisses
-- de type "banque" (nom contenant "banque" ou code = BANQUE).
-- ============================================================================

ALTER TABLE "cash_registers"
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankIBAN" TEXT,
  ADD COLUMN IF NOT EXISTS "bankBranch" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountType" TEXT,
  ADD COLUMN IF NOT EXISTS "bankContact" TEXT;

COMMENT ON COLUMN "cash_registers"."bankName" IS 'Nom de la banque (ex: Ecobank Bénin). Utilisé seulement pour les caisses de type banque.';
COMMENT ON COLUMN "cash_registers"."bankAccountNumber" IS 'Numéro de compte bancaire.';
COMMENT ON COLUMN "cash_registers"."bankIBAN" IS 'IBAN du compte bancaire.';
COMMENT ON COLUMN "cash_registers"."bankBranch" IS 'Agence / succursale de la banque.';
COMMENT ON COLUMN "cash_registers"."bankAccountType" IS 'Type de compte: COURANT, EPARGNE, etc.';
COMMENT ON COLUMN "cash_registers"."bankContact" IS 'Contact du gestionnaire de compte bancaire.';
