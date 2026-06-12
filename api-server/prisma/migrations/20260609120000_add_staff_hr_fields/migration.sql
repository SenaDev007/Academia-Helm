-- Add missing HR fields to staff table
-- These fields are needed for a complete personnel file (fiche personnel)

-- Nationalité du collaborateur
ALTER TABLE "staff" ADD COLUMN "nationality" TEXT;

-- Situation matrimoniale: SINGLE, MARRIED, DIVORCED, WIDOWED, SEPARATED
ALTER TABLE "staff" ADD COLUMN "maritalStatus" TEXT;

-- Nombre d'enfants à charge
ALTER TABLE "staff" ADD COLUMN "numberOfChildren" INTEGER;

-- Numéro de pièce d'identité (CNI, passeport, etc.)
ALTER TABLE "staff" ADD COLUMN "nationalId" TEXT;

-- Numéro d'immatriculation CNSS (convenience field)
ALTER TABLE "staff" ADD COLUMN "cnssNumber" TEXT;

-- Numéro IFU (Identifiant Fiscal Unique)
ALTER TABLE "staff" ADD COLUMN "ifuNumber" TEXT;

-- Create index on cnssNumber for lookup performance
CREATE INDEX IF NOT EXISTS "staff_cnssNumber_idx" ON "staff"("cnssNumber");
