-- ═══════════════════════════════════════════════════════════════════════
-- ACADEMIA COMMUNITY — espace communautaire plateforme (niveau produit)
-- Mission marketing : fidéliser prospects + clients d'Academia Helm DANS
-- le produit (pas sur WhatsApp) — conseils quotidiens, annonces produits,
-- support, sondages, témoignages, bouche-à-oreille.
-- Référence fonctionnelle : Yeshua Connect (Mouvement-Christ-Libere).
-- Idempotent : CREATE TABLE IF NOT EXISTS (rejouable, bootstrap main.ts).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Membres (comptes communautaires légers, hors table users) ───
CREATE TABLE IF NOT EXISTS "community_members" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "organization" TEXT,
  "country" TEXT,
  "phone" TEXT,
  "avatar_url" TEXT,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',          -- SUPER_ADMIN | ADMIN | MODERATOR | MEMBER
  "member_type" TEXT NOT NULL DEFAULT 'PROSPECT', -- PROSPECT | CLIENT | PARTNER | TEAM
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',        -- PENDING | ACTIVE | BANNED
  "source" TEXT,                                   -- PUBLIC_JOIN | INVITE | MANUAL | BOOTSTRAP
  "source_meta" JSONB,
  "bio" TEXT,
  "last_seen_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_members_email_key" ON "community_members"("email");
CREATE INDEX IF NOT EXISTS "community_members_type_status_idx" ON "community_members"("member_type", "status");

-- ─── Canaux thématiques ───
CREATE TABLE IF NOT EXISTS "community_channels" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "type" TEXT NOT NULL DEFAULT 'TEXT',             -- TEXT | ANNOUNCEMENT | RESTRICTED
  "position" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "invite_token" TEXT,
  "last_message_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_channels_slug_key" ON "community_channels"("slug");
CREATE INDEX IF NOT EXISTS "community_channels_order_idx" ON "community_channels"("position");

-- ─── Messages ───
CREATE TABLE IF NOT EXISTS "community_messages" (
  "id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TEXT',             -- TEXT | ANNOUNCEMENT | POLL | SYSTEM
  "content" TEXT,
  "attachment_url" TEXT,
  "attachment_name" TEXT,
  "attachment_size" INTEGER,
  "attachment_mime" TEXT,
  "reply_to_id" TEXT,
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "pinned_at" TIMESTAMPTZ,
  "pinned_by" TEXT,
  "is_edited" BOOLEAN NOT NULL DEFAULT false,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMPTZ,
  "edited_history" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "community_messages_channel_created_idx" ON "community_messages"("channel_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "community_messages_member_idx" ON "community_messages"("member_id");
CREATE INDEX IF NOT EXISTS "community_messages_pinned_idx" ON "community_messages"("is_pinned") WHERE "is_pinned";

-- ─── Réactions emoji ───
CREATE TABLE IF NOT EXISTS "community_reactions" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_reactions_unique" ON "community_reactions"("message_id", "member_id", "emoji");

-- ─── Sondages ───
CREATE TABLE IF NOT EXISTS "community_polls" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "is_multi" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{id, label}]
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_polls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_polls_message_key" ON "community_polls"("message_id");

CREATE TABLE IF NOT EXISTS "community_poll_votes" (
  "id" TEXT NOT NULL,
  "poll_id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_poll_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_poll_votes_unique" ON "community_poll_votes"("poll_id", "option_id", "member_id");
CREATE INDEX IF NOT EXISTS "community_poll_votes_poll_idx" ON "community_poll_votes"("poll_id");

-- ─── Posts programmés (conseils quotidiens — cœur marketing) ───
CREATE TABLE IF NOT EXISTS "community_scheduled_posts" (
  "id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',      -- ANNOUNCEMENT | TEXT
  "content" TEXT NOT NULL,
  "scheduled_at" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',         -- PENDING | SENT | CANCELLED | FAILED
  "sent_message_id" TEXT,
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_scheduled_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "community_scheduled_pending_idx" ON "community_scheduled_posts"("status", "scheduled_at");

-- ─── Marqueurs de lecture (badges non-lus) ───
CREATE TABLE IF NOT EXISTS "community_channel_reads" (
  "member_id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_channel_reads_pkey" PRIMARY KEY ("member_id", "channel_id")
);

-- ─── Invitations trackées (funnel e-commerce : achat → lien → communauté) ───
CREATE TABLE IF NOT EXISTS "community_invites" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "channel_id" TEXT,
  "member_type" TEXT NOT NULL DEFAULT 'PROSPECT',   -- tag attribué aux inscrits via ce lien
  "created_by" TEXT,
  "note" TEXT,
  "max_uses" INTEGER,
  "uses_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_invites_token_key" ON "community_invites"("token");
