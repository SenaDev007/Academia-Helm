-- ============================================================================
-- Migration: V2 features — group invite links + scheduled messages + call history
-- ============================================================================

-- 1. Group invite links: add inviteToken to chat_conversations
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_inviteToken_idx"
  ON "chat_conversations" ("inviteToken") WHERE "inviteToken" IS NOT NULL;

-- 2. Scheduled chat messages table
CREATE TABLE IF NOT EXISTS "chat_scheduled_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TEXT',
  "content" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "attachmentSize" INTEGER,
  "attachmentMime" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "chat_scheduled_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_scheduled_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_scheduled_messages_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_scheduled_messages_scheduledFor_idx"
  ON "chat_scheduled_messages" ("scheduledFor") WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "chat_scheduled_messages_conversationId_idx"
  ON "chat_scheduled_messages" ("conversationId");

-- 3. Call history table
CREATE TABLE IF NOT EXISTS "chat_call_history" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "callerId" TEXT NOT NULL,
  "callType" TEXT NOT NULL DEFAULT 'AUDIO',
  "status" TEXT NOT NULL DEFAULT 'MISSED',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "duration" INTEGER,

  CONSTRAINT "chat_call_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_call_history_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_call_history_callerId_fkey"
    FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_call_history_conversationId_idx"
  ON "chat_call_history" ("conversationId");
