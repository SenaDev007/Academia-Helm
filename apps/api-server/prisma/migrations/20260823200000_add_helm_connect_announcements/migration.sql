-- ============================================================================
-- HELM CONNECT — Annonces officielles V1
-- ============================================================================
-- Système de communication institutionnelle pour Academia Helm.
-- Permet à l'administration/direction de publier des annonces ciblées
-- (toute l'école, un niveau, une classe, les enseignants, les parents)
-- avec accusé de lecture et priorité.
--
-- ⭐ Architecture :
--   chat_announcements          — entête des annonces (target, priority, body)
--   chat_announcement_reads     — accusés de lecture par utilisateur
-- ============================================================================

CREATE TABLE IF NOT EXISTS "chat_announcements" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,                           -- users.id (qui a publié)
  "authorRole" TEXT,                                  -- ex: DIRECTEUR, ADMIN
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',          -- LOW | NORMAL | HIGH | URGENT
  "targetType" TEXT NOT NULL,                         -- ALL_SCHOOL | LEVEL | CLASS | TEACHERS | PARENTS | GROUP | CHANNEL
  "targetClassId" TEXT,                               -- pour targetType=CLASS
  "targetLevel" TEXT,                                 -- pour targetType=LEVEL (MATERNELLE|PRIMAIRE|SECONDAIRE)
  "targetGroupId" TEXT,                               -- pour targetType=GROUP (chat_conversations.id)
  "targetChannelId" TEXT,                             -- pour targetType=CHANNEL (chat_channels.id)
  "attachments" JSONB,                                -- [{ url, name, size, mime }]
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT FALSE, -- accusé de lecture obligatoire
  "publishedAt" TIMESTAMPTZ,                          -- null = DRAFT
  "expiresAt" TIMESTAMPTZ,                            -- null = jamais
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_announcements_tenant ON "chat_announcements" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_chat_announcements_published ON "chat_announcements" ("tenantId", "publishedAt") WHERE "publishedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_announcements_target ON "chat_announcements" ("tenantId", "targetType");
CREATE INDEX IF NOT EXISTS idx_chat_announcements_priority ON "chat_announcements" ("priority", "publishedAt") WHERE "publishedAt" IS NOT NULL;

COMMENT ON TABLE "chat_announcements" IS 'Helm Connect — annonces officielles publiées par l''administration';
COMMENT ON COLUMN "chat_announcements"."priority" IS 'LOW | NORMAL | HIGH | URGENT — used for notification styling';
COMMENT ON COLUMN "chat_announcements"."targetType" IS 'ALL_SCHOOL | LEVEL | CLASS | TEACHERS | PARENTS | GROUP | CHANNEL';
COMMENT ON COLUMN "chat_announcements"."requiresConfirmation" IS 'Si true, les destinataires doivent marquer comme lu (escalade si non lu)';

-- ============================================================================
-- Accusés de lecture : un enregistrement par utilisateur ayant lu l'annonce
-- ============================================================================
CREATE TABLE IF NOT EXISTS "chat_announcement_reads" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "announcementId" TEXT NOT NULL REFERENCES "chat_announcements"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,                             -- users.id
  "tenantId" TEXT NOT NULL,
  "readAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "confirmed" BOOLEAN NOT NULL DEFAULT FALSE,        -- accusé explicite (si requiresConfirmation)
  UNIQUE ("announcementId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_chat_announcement_reads_user ON "chat_announcement_reads" ("userId", "tenantId");
CREATE INDEX IF NOT EXISTS idx_chat_announcement_reads_ann ON "chat_announcement_reads" ("announcementId");

COMMENT ON TABLE "chat_announcement_reads" IS 'Helm Connect — accusés de lecture des annonces';
