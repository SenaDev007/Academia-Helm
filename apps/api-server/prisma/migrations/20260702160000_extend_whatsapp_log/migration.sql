-- ============================================================================
-- Migration: Extend WhatsappLog with categorization fields (mirror EmailLog)
-- Date: 2026-07-02
-- Purpose: Add tracing/categorization fields to whatsapp_logs table
-- ============================================================================

-- Add new columns (idempotent - using IF NOT EXISTS for safety)
ALTER TABLE "whatsapp_logs"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "subCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "module" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientType" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientId" TEXT,
  ADD COLUMN IF NOT EXISTS "fromPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "templateId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "threadId" TEXT,
  ADD COLUMN IF NOT EXISTS "triggeredBy" TEXT,
  ADD COLUMN IF NOT EXISTS "triggeredByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;

-- Update default for status (was TEXT NOT NULL, ensure default PENDING)
ALTER TABLE "whatsapp_logs"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Add new indexes (idempotent)
CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_category_idx"
  ON "whatsapp_logs" ("tenantId", "category");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_recipient_idx"
  ON "whatsapp_logs" ("tenantId", "recipient");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_module_idx"
  ON "whatsapp_logs" ("tenantId", "module");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_threadId_idx"
  ON "whatsapp_logs" ("threadId");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_createdAt_idx"
  ON "whatsapp_logs" ("tenantId", "createdAt");

-- ============================================================================
-- Notes:
-- - Existing rows will have NULL for new columns (acceptable)
-- - status default PENDING ensures new rows without explicit status are tracked
-- - Indexes are created CONCURRENTLY-compatible (IF NOT EXISTS)
-- ============================================================================
