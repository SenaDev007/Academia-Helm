-- ⭐ Add presence tracking column to users table
--    Used for online/offline indicator in chat (WhatsApp-like green dot)
--    Updated periodically by the frontend (every 30s via /chat/presence endpoint)

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- ⭐ Add typing state tracking (temporary, per conversation)
--    Stored as a simple key-value in a separate table to avoid bloating users
CREATE TABLE IF NOT EXISTS "chat_typing_state" (
    "id"              TEXT NOT NULL,
    "conversationId"  TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "isTyping"        BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_typing_state_pkey" PRIMARY KEY ("id")
);

-- ⭐ Unique constraint: one typing state per user per conversation
CREATE UNIQUE INDEX IF NOT EXISTS "chat_typing_state_conv_user_idx"
    ON "chat_typing_state" ("conversationId", "userId");

-- ⭐ Auto-cleanup: typing states older than 10 seconds are considered "not typing"
--    (the frontend polls every 5s and re-sets isTyping=true if still typing)
CREATE INDEX IF NOT EXISTS "chat_typing_state_conv_idx"
    ON "chat_typing_state" ("conversationId", "updatedAt");
