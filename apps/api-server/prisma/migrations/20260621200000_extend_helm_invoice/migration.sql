-- ============================================================================
-- Migration: 20260621200000_extend_helm_invoice
-- ============================================================================
-- Étend le modèle HelmInvoice pour supporter la facturation complète :
--   - invoiceNumber : numéro unique (AH-YYYY-MM-NNNNN)
--   - customerEmail, customerName, customerPhone : infos client
--   - description : description de la facture
--   - type : type de paiement (INITIAL_SUBSCRIPTION, RENEWAL, BILINGUAL_ACTIVATION, etc.)
--   - paymentReference, paymentMethod, paymentOperator : détails paiement
--   - bilingualEnabled : option bilingue incluse
--   - issuedAt, paidAt : dates émission/paiement
--
-- Rend subscriptionId, plan, billingCycle, period optionnels car une facture
-- peut être émise sans abonnement (ex: frais de scolarité, activation bilingue).
-- ============================================================================

-- 1. Rendre subscriptionId optionnel
ALTER TABLE "helm_invoices" ALTER COLUMN "subscriptionId" DROP NOT NULL;

-- 2. Rendre plan optionnel (était HelmPlan requis)
-- Note: en Prisma, on garde le type enum mais on autorise NULL
ALTER TABLE "helm_invoices" ALTER COLUMN "plan" DROP NOT NULL;

-- 3. Rendre billingCycle optionnel
ALTER TABLE "helm_invoices" ALTER COLUMN "billingCycle" DROP NOT NULL;

-- 4. Rendre period optionnel
ALTER TABLE "helm_invoices" ALTER COLUMN "period" DROP NOT NULL;

-- 5. Ajouter les nouveaux champs
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "paymentOperator" TEXT;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "bilingualEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "helm_invoices" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3);

-- 6. Index sur invoiceNumber pour recherches rapides
CREATE UNIQUE INDEX IF NOT EXISTS "helm_invoices_invoiceNumber_key" ON "helm_invoices"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "helm_invoices_customerEmail_idx" ON "helm_invoices"("customerEmail");
CREATE INDEX IF NOT EXISTS "helm_invoices_type_idx" ON "helm_invoices"("type");
