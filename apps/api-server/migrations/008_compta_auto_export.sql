-- ============================================================================
-- Migration 008 : Export comptable automatique mensuel
-- ============================================================================
--
-- Ajoute les champs de configuration de l'export comptable automatique
-- à la table financial_settings :
--   - comptaAutoExportEnabled  : activation de l'export auto mensuel
--   - comptaAutoExportEmail    : email du comptable destinataire
--   - comptaAutoExportFormat   : format d'export (FEC, OHADA, CSV)
--   - comptaAutoExportDay      : jour du mois d'envoi (1-28)
--   - comptaAutoExportLastSent : date du dernier envoi (anti-doublon)
--
-- Le cron job ComptaAutoExportService vérifie chaque jour à 08:00 si un
-- export doit être envoyé (jour du mois = comptaAutoExportDay) et génère
-- le fichier de la veille au dernier jour du mois précédent.
-- ============================================================================

ALTER TABLE "financial_settings"
  ADD COLUMN IF NOT EXISTS "comptaAutoExportEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "comptaAutoExportEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "comptaAutoExportFormat" TEXT NOT NULL DEFAULT 'OHADA',
  ADD COLUMN IF NOT EXISTS "comptaAutoExportDay" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "comptaAutoExportLastSent" TIMESTAMP(3);
