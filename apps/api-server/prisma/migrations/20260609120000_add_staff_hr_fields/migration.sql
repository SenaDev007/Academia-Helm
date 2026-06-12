-- Add missing HR fields to staff table
-- These fields are needed for a complete personnel file (fiche personnel)
-- Uses IF NOT EXISTS for idempotency (columns may already exist from migration 20260610120000 or startup fallbacks)

-- Nationalité du collaborateur
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationality" TEXT;

-- Situation matrimoniale: SINGLE, MARRIED, DIVORCED, WIDOWED, SEPARATED
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;

-- Nombre d'enfants à charge
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "numberOfChildren" INTEGER;

-- Numéro de pièce d'identité (CNI, passeport, etc.)
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;

-- Numéro d'immatriculation CNSS (convenience field)
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "cnssNumber" TEXT;

-- Numéro IFU (Identifiant Fiscal Unique)
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "ifuNumber" TEXT;

-- Create index on cnssNumber for lookup performance
CREATE INDEX IF NOT EXISTS "staff_cnssNumber_idx" ON "staff"("cnssNumber");
