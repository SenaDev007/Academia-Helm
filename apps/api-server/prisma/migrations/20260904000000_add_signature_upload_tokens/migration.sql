-- ============================================================================
-- Signature Upload Tokens — Magic-link tokens for Canva/canvas signature upload
-- ============================================================================
-- Allows a staff member to upload their hand-drawn signature via a magic link
-- (no login required). Mirrors the contract sign token pattern.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "signature_upload_tokens" (
    "token" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT,
    "role" TEXT NOT NULL,
    "holderFirstName" TEXT NOT NULL,
    "holderLastName" TEXT NOT NULL,
    "educationLevelId" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "signature_upload_tokens_pkey" PRIMARY KEY ("token")
);
CREATE INDEX IF NOT EXISTS "signature_upload_tokens_tenantId_idx" ON "signature_upload_tokens"("tenantId");
CREATE INDEX IF NOT EXISTS "signature_upload_tokens_email_idx" ON "signature_upload_tokens"("email");
CREATE INDEX IF NOT EXISTS "signature_upload_tokens_expiresAt_idx" ON "signature_upload_tokens"("expiresAt");
