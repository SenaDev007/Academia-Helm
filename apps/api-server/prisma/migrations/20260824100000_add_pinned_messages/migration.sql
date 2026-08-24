-- ============================================================================
-- HELM CONNECT V2.5 — Pinned Messages
-- ============================================================================
--
-- Ajoute les colonnes nécessaires pour épingler des messages dans une
-- conversation (centre documentaire).
--
-- ⭐ Architecture :
--   - isPinned (BOOLEAN, default FALSE) — le message est épinglé
--   - pinnedBy (TEXT, optional) — userId de celui qui a épinglé
--   - pinnedAt (TIMESTAMPTZ, optional) — quand le message a été épinglé
-- ============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "pinnedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned
  ON "chat_messages" ("conversationId", "pinnedAt" DESC)
  WHERE "isPinned" = TRUE AND "deletedAt" IS NULL;

COMMENT ON COLUMN "chat_messages"."isPinned" IS 'V2.5 — Message épinglé dans la conversation (visible dans le centre documentaire)';
COMMENT ON COLUMN "chat_messages"."pinnedBy" IS 'V2.5 — userId de celui qui a épinglé le message';
COMMENT ON COLUMN "chat_messages"."pinnedAt" IS 'V2.5 — Date/heure du épingle';
