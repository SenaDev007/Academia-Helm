-- ═════════════════════════════════════════════════════════════════
--  ⭐ 2FA TOTP (double authentification — parité exigences de sécurité)
--    RFC 6238 : secret TOTP + activation + codes de secours.
--    twoFactorBackupCodes = JSON array de hachés bcrypt (jamais en clair).
--    twoFactorPendingSecret : secret généré pendant le setup, activé
--    seulement après vérification d'un premier code (POST 2fa/enable).
-- ═════════════════════════════════════════════════════════════════
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorPendingSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorEnabledAt" TIMESTAMPTZ;
