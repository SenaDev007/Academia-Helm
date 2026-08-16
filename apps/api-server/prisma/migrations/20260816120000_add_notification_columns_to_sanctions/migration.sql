-- ============================================================================
-- Migration : Ajouter colonnes de notification aux sanctions
-- ============================================================================
--
-- Contexte :
-- Le module Discipline notifie désormais les parents via WhatsApp Business
-- + fallback SMS quand une sanction est créée ou annulée.
-- On ajoute 3 colonnes pour tracer l'état de la notification :
--   - parentNotifiedAt : timestamp du dernier envoi réussi
--   - notificationStatus : PENDING | SENT | FAILED | SKIPPED
--   - notificationChannels : JSON avec le détail par canal
--     (ex: {"whatsapp":"sent","sms":"skipped"})
--
-- Ces colonnes permettent au SG et au Directeur de vérifier que le parent a
-- bien été notifié, et de relancer si nécessaire.
-- ============================================================================

DO $$
BEGIN
    -- 1. parentNotifiedAt (timestamp nullable)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sanctions' AND column_name = 'parentNotifiedAt'
    ) THEN
        ALTER TABLE sanctions ADD COLUMN "parentNotifiedAt" TIMESTAMP;
        RAISE NOTICE 'Colonne parentNotifiedAt ajoutée à sanctions.';
    ELSE
        RAISE NOTICE 'Colonne parentNotifiedAt existe déjà — skipped.';
    END IF;

    -- 2. notificationStatus (text, default PENDING)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sanctions' AND column_name = 'notificationStatus'
    ) THEN
        ALTER TABLE sanctions ADD COLUMN "notificationStatus" TEXT DEFAULT 'PENDING';
        RAISE NOTICE 'Colonne notificationStatus ajoutée à sanctions.';
    ELSE
        RAISE NOTICE 'Colonne notificationStatus existe déjà — skipped.';
    END IF;

    -- 3. notificationChannels (JSONB nullable)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sanctions' AND column_name = 'notificationChannels'
    ) THEN
        ALTER TABLE sanctions ADD COLUMN "notificationChannels" JSONB;
        RAISE NOTICE 'Colonne notificationChannels ajoutée à sanctions.';
    ELSE
        RAISE NOTICE 'Colonne notificationChannels existe déjà — skipped.';
    END IF;
END $$;

-- Index sur notificationStatus pour faciliter les requêtes de pilotage
CREATE INDEX IF NOT EXISTS "sanctions_notificationStatus_idx"
    ON sanctions("notificationStatus");
