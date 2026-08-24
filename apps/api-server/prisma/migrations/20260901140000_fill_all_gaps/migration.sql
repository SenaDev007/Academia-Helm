-- ============================================================================
-- Migration: Fill ALL Helm Connect gaps — moderation, profile, presence, search
-- ============================================================================

-- 1. MODERATION: chat_message_reports
CREATE TABLE IF NOT EXISTS "chat_message_reports" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolution" TEXT,
  CONSTRAINT "chat_message_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_message_reports_status_idx" ON "chat_message_reports"("status") WHERE "status" = 'PENDING';

-- 2. USER PROFILE: bio, availability status, available hours
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT DEFAULT 'offline';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "availableFrom" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "availableUntil" TEXT;

-- 3. CONVERSATION SEARCH: add full-text search support
CREATE INDEX IF NOT EXISTS "chat_messages_content_search_idx"
  ON "chat_messages" USING gin(to_tsvector('french', coalesce("content", '')))
  WHERE "deletedAt" IS NULL;

-- 4. DELIVERED receipt: add deliveredAt column
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- 5. MENTION support: add mentions column (array of userIds as JSON)
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "mentions" TEXT;
