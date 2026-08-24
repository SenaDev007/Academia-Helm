-- ⭐ Chat V2: Channels (Telegram-style broadcast) + E2E encryption keys + avatar URL
--
-- 1. chat_channels: broadcast channels (one-way, like Telegram channels)
-- 2. chat_channel_subscribers: who follows which channel
-- 3. users.avatarUrl: profile photo URL (uploaded via StorageService)
-- 4. users.publicKey: RSA-OAEP public key for E2E encryption (base64 SPKI format)

-- ═════════════════════════════════════════════════════════════════
-- 1. CANAUX (broadcast channels — Telegram-style)
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_channels" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "avatarUrl"       TEXT,
    "createdBy"       TEXT NOT NULL,
    "isOfficial"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt"   TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_channels_tenant_idx" ON "chat_channels" ("tenantId");
CREATE INDEX IF NOT EXISTS "chat_channels_lastMsg_idx" ON "chat_channels" ("lastMessageAt" DESC);
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════
-- 2. ABONNÉS aux canaux
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_channel_subscribers" (
    "id"              TEXT NOT NULL,
    "channelId"       TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "subscribedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_channel_subscribers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_channel_subs_chan_user_idx"
    ON "chat_channel_subscribers" ("channelId", "userId");
CREATE INDEX IF NOT EXISTS "chat_channel_subs_user_idx" ON "chat_channel_subscribers" ("userId");
ALTER TABLE "chat_channel_subscribers" ADD CONSTRAINT "chat_channel_subs_chanId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════
-- 3. AVATAR URL on users (for profile customization)
-- ═════════════════════════════════════════════════════════════════
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- ═════════════════════════════════════════════════════════════════
-- 4. E2E ENCRYPTION — public key for RSA-OAEP key exchange
--    Stored in base64 SPKI format (SubjectPublicKeyInfo)
--    Private key is NEVER stored server-side — only in browser (IndexedDB)
-- ═════════════════════════════════════════════════════════════════
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "publicKey" TEXT;
