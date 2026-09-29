-- ============================================================================
-- HELM CONNECT V6 — Canaux officiels automatiques + groupes enrichis (spec §4/§6)
-- ============================================================================

-- 1. chat_auto_groups : colonne "levelId" pour les groupes « Parents – 6ème »
--    (un groupe par NIVEAU, en plus des groupes par classe/matière/rôle).
--    + index de filtrage des Communautés par catégorie (groupType) côté
--      frontend (Classes / Matières / Enseignants / Parents / Administration).
ALTER TABLE "chat_auto_groups" ADD COLUMN IF NOT EXISTS "levelId" TEXT;

CREATE INDEX IF NOT EXISTS "idx_chat_auto_groups_tenant_groupType"
    ON "chat_auto_groups" ("tenantId", "groupType");

-- 2. Canaux officiels : la déduplication est assurée au niveau applicatif
--    (AutoChannelService.ensureDefaultChannels — SELECT ILIKE puis INSERT),
--    sans index unique pour ne pas casser les tenants ayant déjà des canaux
--    homonymes manuels. L'abonnement idempotent s'appuie sur l'index unique
--    existant chat_channel_subs_chan_user_idx (channelId, userId).
