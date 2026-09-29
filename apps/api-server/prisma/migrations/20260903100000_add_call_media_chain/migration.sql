-- ============================================================================
-- Migration: V4 — Chaîne média d'appels (LiveKit → Agora → Daily) + signalisation
--            des appels + journaux CALL_LOG dans le chat + mode vidéo des canaux
--            vocaux.
-- Porté de l'architecture « Yeshua Connect » (Christ Libère) vers Helm Connect.
--
-- Tables :
--   chat_call_signals          — signalisation des appels (ringing/accepted/...)
--   chat_call_provider_health  — santé partagée des fournisseurs média (cooldown)
--   chat_voice_media_provider  — arbitrage persisté par canal vocal
-- Colonnes :
--   chat_messages."callMeta"   — métadonnées JSON des messages CALL_LOG
--   chat_voice_channels."videoMode" — bascule audio↔vidéo (admin)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════
--  1. SIGNALISATION DES APPELS (chat_call_signals)
--     Un signal = un appel. C'est la source de vérité partagée :
--     ringing → accepted → ended | declined | missed | cancelled
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_call_signals" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "conversationId"  TEXT NOT NULL,
    "initiatorId"     TEXT NOT NULL,
    "type"            TEXT NOT NULL DEFAULT 'audio',      -- 'audio' | 'video'
    "status"          TEXT NOT NULL DEFAULT 'ringing',    -- 'ringing'|'accepted'|'declined'|'missed'|'cancelled'|'ended'
    "mediaProvider"   TEXT,                               -- 'livekit' | 'agora' | 'daily' (arbitrage par appel)
    "isGroupCall"     BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt"      TIMESTAMP(3),
    "endedAt"         TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_call_signals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_call_signals_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "chat_call_signals_initiatorId_fkey"
      FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_call_signals_conv_status_idx"
  ON "chat_call_signals" ("conversationId", "status");
CREATE INDEX IF NOT EXISTS "chat_call_signals_status_created_idx"
  ON "chat_call_signals" ("status", "createdAt");

-- ═══════════════════════════════════════════════════════════════════
--  2. SANTÉ PARTAGÉE DES FOURNISSEURS MÉDIA (chat_call_provider_health)
--     Un fournisseur en échec entre en cooldown 5 minutes — les nouveaux
--     appels l'évitent, les appels en cours restent dessus.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_call_provider_health" (
    "provider"        TEXT NOT NULL,                       -- 'livekit' | 'agora' | 'daily'
    "failCount"       INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt"   TIMESTAMP(3),
    "lastReason"      TEXT,
    "cooldownUntil"   TIMESTAMP(3),

    CONSTRAINT "chat_call_provider_health_pkey" PRIMARY KEY ("provider")
);

-- ═══════════════════════════════════════════════════════════════════
--  3. ARBITRAGE PERSISTÉ PAR CANAL VOCAL (chat_voice_media_provider)
--     Rooms persistantes sans CallSignal — même logique de repli.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_voice_media_provider" (
    "channelId"       TEXT NOT NULL,
    "provider"        TEXT NOT NULL,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_voice_media_provider_pkey" PRIMARY KEY ("channelId")
);

-- ═══════════════════════════════════════════════════════════════════
--  4. MESSAGES CALL_LOG — métadonnées structurées
--     Chaque issue d'appel (manqué/refusé/annulé/terminé) est insérée
--     comme message type 'CALL_LOG' : content = texte lisible,
--     "callMeta" = JSON { callType, status, durationSec, byName }.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "callMeta" JSONB;

-- ═══════════════════════════════════════════════════════════════════
--  5. CANAUX VOCAUX — bascule audio↔vidéo contrôlée par l'admin
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "chat_voice_channels" ADD COLUMN IF NOT EXISTS "videoMode" BOOLEAN NOT NULL DEFAULT false;
