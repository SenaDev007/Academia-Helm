-- ============================================================================
-- Discord Parity Features — Migration
-- ============================================================================
-- Adds the following columns/tables to bring Helm Connect closer to Discord:
--   1. chat_conversations.slowModeSeconds   — slow mode per conversation
--   2. chat_conversations.category          — channel grouping
--   3. users.customStatus                   — custom status (text + emoji)
--   4. users.customStatusExpiresAt          — auto-clear custom status
--   5. users.activityStatus                — "playing/listening/streaming" text
--   6. users.bannerUrl                      — profile banner image
--   7. chat_threads table                  — public/private threads
--   8. chat_conversation_bans table         — banned users per conversation
--   9. chat_audit_logs table               — audit log for chat moderation
--  10. chat_message_pins table              — explicit pin records (separate from isPinned column)
-- ============================================================================

-- 1. Slow mode per conversation
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "slowModeSeconds" INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN "chat_conversations"."slowModeSeconds" IS 'Slow mode: minimum seconds between messages per user. 0 = disabled.';

-- 2. Channel categories (for grouping in the Canaux section)
ALTER TABLE "chat_channels" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "category" TEXT;
COMMENT ON COLUMN "chat_channels"."category" IS 'Optional category name for grouping channels (e.g. "Annonces", "Général").';
COMMENT ON COLUMN "chat_conversations"."category" IS 'Optional category name for grouping conversations.';

-- 3-6. User profile enhancements (Discord-style)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customStatus" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customStatusExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activityStatus" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
COMMENT ON COLUMN "users"."customStatus" IS 'Discord-style custom status (e.g. "🎮 En cours de réunion"). Cleared when expiresAt passes.';
COMMENT ON COLUMN "users"."customStatusExpiresAt" IS 'When set, the custom status auto-clears after this timestamp.';
COMMENT ON COLUMN "users"."activityStatus" IS 'Activity status text (e.g. "Enseigne les mathématiques").';
COMMENT ON COLUMN "users"."bannerUrl" IS 'Profile banner image URL (Discord-style).';

-- 7. Threads table — for public/private threaded discussions
CREATE TABLE IF NOT EXISTS "chat_threads" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "parentMessageId" TEXT NOT NULL,
    "name" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_threads_conversationId_idx" ON "chat_threads"("conversationId");
CREATE INDEX IF NOT EXISTS "chat_threads_parentMessageId_idx" ON "chat_threads"("parentMessageId");
-- Add threadId column to chat_messages so a message can belong to a thread
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "threadId" TEXT;
CREATE INDEX IF NOT EXISTS "chat_messages_threadId_idx" ON "chat_messages"("threadId");

-- 8. Conversation bans — for ban/kick moderation
CREATE TABLE IF NOT EXISTS "chat_conversation_bans" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "chat_conversation_bans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_conversation_bans_conv_user_unique" UNIQUE ("conversationId", "userId")
);
CREATE INDEX IF NOT EXISTS "chat_conversation_bans_conversationId_idx" ON "chat_conversation_bans"("conversationId");
CREATE INDEX IF NOT EXISTS "chat_conversation_bans_userId_idx" ON "chat_conversation_bans"("userId");

-- 9. Audit log table — for chat moderation actions
CREATE TABLE IF NOT EXISTS "chat_audit_logs" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetMessageId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_audit_logs_conversationId_idx" ON "chat_audit_logs"("conversationId");
CREATE INDEX IF NOT EXISTS "chat_audit_logs_actorUserId_idx" ON "chat_audit_logs"("actorUserId");
CREATE INDEX IF NOT EXISTS "chat_audit_logs_action_idx" ON "chat_audit_logs"("action");
COMMENT ON COLUMN "chat_audit_logs"."action" IS 'One of: MESSAGE_EDIT, MESSAGE_DELETE, MESSAGE_PIN, MESSAGE_UNPIN, MESSAGE_FORWARD, USER_BAN, USER_UNBAN, USER_KICK, USER_MUTE, USER_UNMUTE, SLOW_MODE_SET, REACTION_ADD, REACTION_REMOVE, IMPORTANT_TOGGLE, CONVERSATION_CREATE, CONVERSATION_UPDATE.';

-- 10. Chat message mutes — for muting users in a conversation (separate from ban)
CREATE TABLE IF NOT EXISTS "chat_conversation_mutes" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedBy" TEXT NOT NULL,
    "reason" TEXT,
    "mutedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "chat_conversation_mutes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_conversation_mutes_conv_user_unique" UNIQUE ("conversationId", "userId")
);
CREATE INDEX IF NOT EXISTS "chat_conversation_mutes_conversationId_idx" ON "chat_conversation_mutes"("conversationId");

-- Done. All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
