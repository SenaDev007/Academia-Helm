-- Migration : in_app_notifications + push_subscriptions
-- Ajoute les tables pour le système de notifications in-app générique
-- et l'abonnement Web Push (notifications navigateur).

-- Table : in_app_notifications
-- Une ligne par destinataire (user-scoped), avec statut isRead.
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "data" JSONB,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "in_app_notifications_tenantId_recipientId_isRead_idx"
    ON "in_app_notifications"("tenantId", "recipientId", "isRead");
CREATE INDEX IF NOT EXISTS "in_app_notifications_recipientId_isRead_idx"
    ON "in_app_notifications"("recipientId", "isRead");
CREATE INDEX IF NOT EXISTS "in_app_notifications_type_idx"
    ON "in_app_notifications"("type");
CREATE INDEX IF NOT EXISTS "in_app_notifications_createdAt_idx"
    ON "in_app_notifications"("createdAt");

-- FK vers tenants (onDelete: CASCADE — si le tenant est supprimé, ses notifs aussi)
ALTER TABLE "in_app_notifications"
    ADD CONSTRAINT "in_app_notifications_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Table : push_subscriptions
-- Abonnements Web Push par utilisateur (un utilisateur peut avoir plusieurs devices).
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keysP256dh" TEXT NOT NULL,
    "keysAuth" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key"
    ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_tenantId_userId_idx"
    ON "push_subscriptions"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx"
    ON "push_subscriptions"("userId");

-- FK vers tenants
ALTER TABLE "push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
