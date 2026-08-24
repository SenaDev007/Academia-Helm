-- ============================================================================
-- FCM Device Tokens — V3-4: Helm Connect mobile push notifications
-- ============================================================================
-- Stocke les tokens FCM (Firebase Cloud Messaging) des appareils mobiles
-- pour l'envoi de push notifications aux parents / enseignants / direction.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "fcm_device_tokens" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"        TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "fcmToken"        TEXT NOT NULL UNIQUE,
    "platform"        TEXT NOT NULL DEFAULT 'ANDROID',  -- ANDROID | IOS
    "deviceInfo"      TEXT,  -- userAgent / model (optionnel)
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour lookup par userId (pour envoyer des push à tous les devices d'un user)
CREATE INDEX IF NOT EXISTS "idx_fcm_tokens_userId"
    ON "fcm_device_tokens" ("userId", "isActive");

-- Index pour lookup par tenant (pour broadcast à tout un tenant)
CREATE INDEX IF NOT EXISTS "idx_fcm_tokens_tenantId"
    ON "fcm_device_tokens" ("tenantId", "isActive");

-- Index unique sur fcmToken pour éviter les doublons (déjà UNIQUE dans la def)
-- mais on l'ajoute explicitement pour la lisibilité.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_fcm_tokens_fcmToken_unique"
    ON "fcm_device_tokens" ("fcmToken");

-- Audit-friendly : une fois le token supprimé à la déconnexion, on garde l'option
-- de le réactiver si l'utilisateur se reconnecte avec le même appareil.
