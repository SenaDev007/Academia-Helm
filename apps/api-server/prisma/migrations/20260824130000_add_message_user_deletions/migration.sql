-- ============================================================================
-- HELM CONNECT V2.7 — Per-user message deletion
-- ============================================================================
-- Permet à un utilisateur de supprimer un message POUR SOI UNIQUEMENT
-- (les autres participants voient toujours le message).
--
-- ⭐ Architecture :
--   - Table chat_message_user_deletions : un enregistrement par (userId, messageId)
--   - Le listMessages query (V2.7) filtre les messages supprimés pour l'utilisateur
--   - Si user re-clique "supprimer pour moi", on ne fait rien (idempotent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "chat_message_user_deletions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "messageId" TEXT NOT NULL,                -- FK vers chat_messages.id
  "userId" TEXT NOT NULL,                   -- users.id
  "deletedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("messageId", "userId")            -- un user ne peut pas supprimer le même message 2x
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_user_deletions_user ON "chat_message_user_deletions" ("userId");
CREATE INDEX IF NOT EXISTS idx_chat_msg_user_deletions_msg ON "chat_message_user_deletions" ("messageId");

COMMENT ON TABLE "chat_message_user_deletions" IS 'Helm Connect V2.7 — Messages supprimés pour un utilisateur spécifique (delete for me)';
