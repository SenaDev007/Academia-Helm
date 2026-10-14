-- ============================================================================
-- Migration: P2P WebRTC signals — fallback 1-à-1 (porté de Yeshua Connect)
-- ============================================================================
-- Quand la chaîne média LiveKit → Agora → Daily échoue (CGNAT africain, key
-- expirée, etc.), les appels DIRECT 1-à-1 basculent en WebRTC peer-to-peer :
-- le média (audio/vidéo) voyage DIRECTEMENT entre les deux navigateurs, sans
-- serveur multimédia ni clé d'API. La seule infrastructure requise est la
-- signalisation HTTP (polling de cette table) + STUN/TURN publics gratuits.
--
-- Flot :
--   APPELANT (startCaller) :
--     1. POST /chat/calls/webrtc { callId, type: 'offer', payload: { sdp, type } }
--     2. polling GET /chat/calls/webrtc?callId=X → attend 'answer' + 'ice'
--   DESTINATAIRE (acceptCallee) :
--     1. GET /chat/calls/webrtc?callId=X → lit 'offer'
--     2. POST /chat/calls/webrtc { callId, type: 'answer', payload: { sdp, type } }
--     3. polling GET /chat/calls/webrtc?callId=X → attend 'ice'
--   ICE (trickle des deux côtés) :
--     POST /chat/calls/webrtc { callId, type: 'ice', payload: { candidate } }
--
-- Table : chat_p2p_webrtc_signals
--   Un signal = une entrée (offer/answer/ice). Les entrées sont supprimées
--   après 5 minutes (cleanup) pour éviter l'accumulation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "chat_p2p_webrtc_signals" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "callId"          TEXT NOT NULL,                         -- référence vers chat_call_signals.id
    "userId"          TEXT NOT NULL,                          -- émetteur du signal (caller ou callee)
    "type"            TEXT NOT NULL,                          -- 'offer' | 'answer' | 'ice'
    "payload"         JSONB NOT NULL,                        -- { sdp?, type?, candidate? }
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_p2p_webrtc_signals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_p2p_webrtc_signals_callId_fkey"
      FOREIGN KEY ("callId") REFERENCES "chat_call_signals"("id") ON DELETE CASCADE,
    CONSTRAINT "chat_p2p_webrtc_signals_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Index pour le polling efficace par callId
CREATE INDEX IF NOT EXISTS "chat_p2p_webrtc_signals_callId_idx"
  ON "chat_p2p_webrtc_signals" ("callId");

-- Index pour le cleanup périodique (suppression des signaux > 5 min)
CREATE INDEX IF NOT EXISTS "chat_p2p_webrtc_signals_createdAt_idx"
  ON "chat_p2p_webrtc_signals" ("createdAt");

-- Index pour le multi-tenant (filtre tenantId)
CREATE INDEX IF NOT EXISTS "chat_p2p_webrtc_signals_tenant_callId_idx"
  ON "chat_p2p_webrtc_signals" ("tenantId", "callId");
