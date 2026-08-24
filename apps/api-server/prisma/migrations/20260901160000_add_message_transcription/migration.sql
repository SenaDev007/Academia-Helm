-- ============================================================================
-- Message Transcription — V3-2: Whisper transcription of audio messages
-- ============================================================================
-- Stocke la transcription textuelle des messages vocaux (Whisper / LLM audio).
-- Permet de rechercher dans les vocaux + accessibilité (sourds/malentendants).
-- ============================================================================

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "transcription" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "transcribedAt" TIMESTAMP(3);
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "transcriptionLanguage" VARCHAR(10);

-- Index pour filtrer les messages avec transcription (recherche dans les vocaux)
CREATE INDEX IF NOT EXISTS "idx_chat_messages_has_transcription"
    ON "chat_messages" ("transcription")
    WHERE "transcription" IS NOT NULL;
