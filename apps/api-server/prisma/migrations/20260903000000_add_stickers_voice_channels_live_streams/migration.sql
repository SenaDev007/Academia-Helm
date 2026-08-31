-- ============================================================================
-- Stickers, Voice Channels, Stage Channels, Live Streams — Migration
-- ============================================================================
-- Brings Helm Connect closer to Discord with:
--   1. Stickers (asset management + STICKER message type)
--   2. Voice channels (persistent always-on voice rooms using mesh WebRTC)
--   3. Stage channels (broadcaster + listeners model, one-to-many)
--   4. Live streams (Go Live — screen share broadcast to a conversation)
-- ============================================================================

-- 1. STICKERS — tenant-scoped sticker packs + individual stickers
CREATE TABLE IF NOT EXISTS "sticker_packs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,  -- NULL = global pack (available to all tenants)
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "sticker_packs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sticker_packs_tenantId_idx" ON "sticker_packs"("tenantId");

CREATE TABLE IF NOT EXISTS "stickers" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "keywords" TEXT,  -- comma-separated search keywords
    "width" INTEGER,
    "height" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stickers_packId_fkey" FOREIGN KEY ("packId") REFERENCES "sticker_packs"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "stickers_packId_idx" ON "stickers"("packId");
CREATE INDEX IF NOT EXISTS "stickers_keywords_idx" ON "stickers" USING gin (to_tsvector('simple', COALESCE("keywords", "name")));

-- Add STICKER type to chat_messages (existing type column accepts any TEXT,
-- so we just document the new allowed value: 'TEXT' | 'AUDIO' | 'DOCUMENT' | 'IMAGE' | 'STICKER' | 'GIF').
-- No ALTER needed — type is TEXT. We add a stickerId column for sticker messages.
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "stickerId" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "tenorGifId" TEXT;

-- 2. VOICE CHANNELS — persistent always-on voice rooms (Discord-style)
CREATE TABLE IF NOT EXISTS "chat_voice_channels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,  -- optional link to a text conversation
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'VOICE',  -- 'VOICE' | 'STAGE' | 'GO_LIVE'
    "maxUsers" INTEGER DEFAULT 0,  -- 0 = unlimited
    "bitrate" INTEGER DEFAULT 64000,  -- audio bitrate in bps
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_voice_channels_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_voice_channels_tenantId_idx" ON "chat_voice_channels"("tenantId");
CREATE INDEX IF NOT EXISTS "chat_voice_channels_type_idx" ON "chat_voice_channels"("type");
COMMENT ON COLUMN "chat_voice_channels"."type" IS 'VOICE = always-on voice room (Discord voice channel), STAGE = one-to-many stage (broadcaster + listeners), GO_LIVE = live screen-share broadcast.';

-- Voice states — who is currently in which voice channel (mimics Discord's voice_states)
CREATE TABLE IF NOT EXISTS "chat_voice_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "deafened" BOOLEAN NOT NULL DEFAULT false,
    "speaking" BOOLEAN NOT NULL DEFAULT false,
    "isBroadcaster" BOOLEAN NOT NULL DEFAULT false,  -- for STAGE channels
    "socketId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "chat_voice_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_voice_states_user_channel_unique" UNIQUE ("userId", "channelId")
);
CREATE INDEX IF NOT EXISTS "chat_voice_states_channelId_idx" ON "chat_voice_states"("channelId");
CREATE INDEX IF NOT EXISTS "chat_voice_states_active_idx" ON "chat_voice_states"("channelId") WHERE "leftAt" IS NULL;

-- 3. LIVE STREAMS — Go Live broadcasts (screen share to a conversation/voice channel)
CREATE TABLE IF NOT EXISTS "chat_live_streams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "channelId" TEXT,  -- optional voice channel
    "conversationId" TEXT,  -- optional text conversation
    "title" TEXT,
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "chat_live_streams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_live_streams_tenantId_active_idx" ON "chat_live_streams"("tenantId") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "chat_live_streams_streamerId_idx" ON "chat_live_streams"("streamerId");

-- Done. All idempotent.
