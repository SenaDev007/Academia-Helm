-- ============================================================================
-- Migration: Add message reactions (emoji) + isImportant flag to chat messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_reactions_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_message_reactions_message_user_emoji_idx"
  ON "chat_message_reactions" ("messageId", "userId", "emoji");

CREATE INDEX IF NOT EXISTS "chat_message_reactions_messageId_idx"
  ON "chat_message_reactions" ("messageId");

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "isImportant" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "chat_messages_isImportant_idx"
  ON "chat_messages" ("isImportant") WHERE "isImportant" = TRUE;
