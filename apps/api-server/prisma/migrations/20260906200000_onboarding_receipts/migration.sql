-- ============================================================================
-- REÇUS / FACTURES AUTOMATIQUES + EFFECTIF ESTIMÉ (onboarding)
-- ============================================================================
-- 1) onboarding_drafts.estimated_student_count : effectif estimé (élèves)
--    déclaré par le Client — persisté pour le contrat (Article 1), l'email
--    et la signature différée.
-- 2) billing_documents : reçus d'encaissement (RECEIPT) et factures de
--    souscription (INVOICE) générés automatiquement — numéro séquentiel
--    annuel (REC-AH-2026-00001 / FAC-AH-2026-00001), snapshot figé,
--    PDF (HTML → Puppeteer), joint à l'email du promoteur.
-- Idempotent : peut être rejoué sans erreur.
-- ============================================================================

ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "estimated_student_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "billing_documents" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RECEIPT',
    "document_number" TEXT NOT NULL,
    "sequence_year" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL DEFAULT 'FULL_SUBSCRIPTION',
    "draft_id" TEXT,
    "tenant_id" TEXT,
    "issued_by_name" TEXT,
    "issued_by_email" TEXT,
    "payer_name" TEXT,
    "payer_email" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'CASH',
    "paid_at" TIMESTAMPTZ,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "file_path" TEXT,
    "file_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EMITTED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_documents_document_number_key" ON "billing_documents"("document_number");
CREATE INDEX IF NOT EXISTS "billing_documents_draft_id_idx" ON "billing_documents"("draft_id");
CREATE INDEX IF NOT EXISTS "billing_documents_kind_year_idx" ON "billing_documents"("kind", "sequence_year");
CREATE INDEX IF NOT EXISTS "billing_documents_tenant_id_idx" ON "billing_documents"("tenant_id");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_documents_draft_id_fkey') THEN
        ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_draft_id_fkey"
        FOREIGN KEY ("draft_id") REFERENCES "onboarding_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
