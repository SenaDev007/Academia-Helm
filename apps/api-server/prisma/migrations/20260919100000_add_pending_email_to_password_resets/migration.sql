-- ⭐ Changement d'adresse email self-service (« Mon profil » → Sécurité) :
--    colonne nullable qui lie un code OTP à la nouvelle adresse email EN
--    ATTENTE de confirmation. Null = OTP de réinitialisation de mot de passe
--    classique (comportement inchangé — aucune donnée existante touchée).
ALTER TABLE "password_resets" ADD COLUMN "pendingEmail" TEXT;
