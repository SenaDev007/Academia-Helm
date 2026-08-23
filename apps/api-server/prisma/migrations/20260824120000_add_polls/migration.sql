-- ============================================================================
-- HELM CONNECT V2.6 — Polls
-- ============================================================================
-- 
-- Système de sondages type Telegram.
-- Les polls sont stockés comme des messages spéciaux (type='POLL') dans
-- chat_messages. Le contenu JSON contient la structure du sondage.
-- Les votes sont stockés dans une table dédiée chat_poll_votes.
-- 
-- ⭐ Architecture :
--   - chat_messages.type = 'POLL' → le content contient le JSON PollData
--   - chat_poll_votes → une ligne par vote (userId × optionId)
-- ============================================================================

-- Table des votes de sondage
CREATE TABLE IF NOT EXISTS "chat_poll_votes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pollId" TEXT NOT NULL,                  -- = chat_messages.id (where type='POLL')
  "optionId" TEXT NOT NULL,                -- id de l'option dans le JSON
  "userId" TEXT NOT NULL,                  -- users.id
  "tenantId" TEXT NOT NULL,
  "votedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("pollId", "userId", "optionId")  -- un user ne peut voter qu'une fois par option
);

CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll ON "chat_poll_votes" ("pollId");
CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_user ON "chat_poll_votes" ("userId", "tenantId");
CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_option ON "chat_poll_votes" ("pollId", "optionId");

COMMENT ON TABLE "chat_poll_votes" IS 'Helm Connect V2.6 — Votes de sondage (Telegram-style)';
COMMENT ON COLUMN "chat_poll_votes"."pollId" IS 'FK vers chat_messages.id où type=POLL';

-- ⭐ Étendre le type enum de chat_messages pour inclure 'POLL'
-- (PostgreSQL ne permet pas ALTER TYPE sur les valeurs ENUM existantes facilement,
--  donc on utilise une approche permissive : on garde le type TEXT et on accepte POLL)
ALTER TABLE "chat_messages" ALTER COLUMN "type" TYPE TEXT;

COMMENT ON COLUMN "chat_messages"."type" IS 'TEXT | AUDIO | DOCUMENT | IMAGE | POLL — V2.6 ajoute POLL';
