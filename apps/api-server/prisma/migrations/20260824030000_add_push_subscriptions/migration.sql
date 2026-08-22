-- ⭐ Push notification subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS "chat_push_subscriptions" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "endpoint"    TEXT NOT NULL,
    "p256dh"      TEXT,
    "auth"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_push_subs_user_endpoint_idx"
    ON "chat_push_subscriptions" ("userId", "endpoint");
CREATE INDEX IF NOT EXISTS "chat_push_subs_user_idx"
    ON "chat_push_subscriptions" ("userId");
