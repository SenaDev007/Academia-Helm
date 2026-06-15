-- CreateTable (tables onboarding manquantes)
CREATE TABLE IF NOT EXISTS "onboarding_drafts" (
    "id" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "school_type" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bilingual" BOOLEAN NOT NULL DEFAULT false,
    "schools_count" INTEGER NOT NULL DEFAULT 1,
    "preferred_subdomain" TEXT,
    "promoter_first_name" TEXT,
    "promoter_last_name" TEXT,
    "promoter_email" TEXT,
    "promoter_phone" TEXT,
    "promoter_password_hash" TEXT,
    "otp_verified" BOOLEAN NOT NULL DEFAULT false,
    "selected_plan_id" TEXT,
    "price_snapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "onboarding_drafts_email_idx" ON "onboarding_drafts"("email");
CREATE INDEX IF NOT EXISTS "onboarding_drafts_status_idx" ON "onboarding_drafts"("status");
CREATE INDEX IF NOT EXISTS "onboarding_drafts_created_at_idx" ON "onboarding_drafts"("created_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "onboarding_payments" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fedapay',
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_payments_reference_key" ON "onboarding_payments"("reference");
CREATE INDEX IF NOT EXISTS "onboarding_payments_draft_id_idx" ON "onboarding_payments"("draft_id");
CREATE INDEX IF NOT EXISTS "onboarding_payments_status_idx" ON "onboarding_payments"("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_payments_draft_id_fkey') THEN
    ALTER TABLE "onboarding_payments" ADD CONSTRAINT "onboarding_payments_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "onboarding_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "onboarding_otps" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "onboarding_otps_draft_id_idx" ON "onboarding_otps"("draft_id");
CREATE INDEX IF NOT EXISTS "onboarding_otps_phone_idx" ON "onboarding_otps"("phone");
CREATE INDEX IF NOT EXISTS "onboarding_otps_code_idx" ON "onboarding_otps"("code");
CREATE INDEX IF NOT EXISTS "onboarding_otps_expires_at_idx" ON "onboarding_otps"("expires_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_otps_draft_id_fkey') THEN
    ALTER TABLE "onboarding_otps" ADD CONSTRAINT "onboarding_otps_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "onboarding_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
