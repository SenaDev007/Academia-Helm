-- ═══════════════════════════════════════════════════════════════════════
-- ACADEMIA COMMUNITY v2 — Canaux dynamiques par école + groupes + lives
-- ═══════════════════════════════════════════════════════════════════════
-- Spécification utilisateur :
--   « un canal sera créé de façon dynamique et automatique pour chaque
--     école. Dans ce canal dédié : le groupe des administrateurs de
--     l'école et le groupe des enseignants de l'école. Un salon pour
--     toutes les écoles ensemble pour les annonces générales. Les lives
--     sont dispatchés : enseignants → groupe enseignants, école → salon
--     de l'école, toutes les écoles → salon global. Formations et
--     conseils : généralisés. »
--
-- Idempotent : colonnes ajoutées via DO blocks (rejouable), tables via
-- CREATE TABLE IF NOT EXISTS (même politique que 20260907150000).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. community_channels : hiérarchie GLOBAL / ÉCOLE / GROUPE ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_channels' AND column_name = 'scope') THEN
    ALTER TABLE community_channels ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'GLOBAL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_channels' AND column_name = 'tenant_id') THEN
    ALTER TABLE community_channels ADD COLUMN "tenant_id" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_channels' AND column_name = 'group_kind') THEN
    ALTER TABLE community_channels ADD COLUMN "group_kind" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_channels' AND column_name = 'parent_id') THEN
    ALTER TABLE community_channels ADD COLUMN "parent_id" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_channels' AND column_name = 'auto_managed') THEN
    ALTER TABLE community_channels ADD COLUMN "auto_managed" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index : filtrage des canaux par école (scope scolaire)
CREATE INDEX IF NOT EXISTS "community_channels_tenant_scope_idx"
  ON "community_channels"("scope", "tenant_id") WHERE "scope" = 'SCHOOL';
CREATE INDEX IF NOT EXISTS "community_channels_parent_idx"
  ON "community_channels"("parent_id") WHERE "parent_id" IS NOT NULL;

-- Un seul salon auto-managé par école / un seul groupe auto par (école, kind)
CREATE UNIQUE INDEX IF NOT EXISTS "community_channels_school_salon_uniq"
  ON "community_channels"("tenant_id") WHERE "scope" = 'SCHOOL' AND "group_kind" = 'SALON' AND "auto_managed";
CREATE UNIQUE INDEX IF NOT EXISTS "community_channels_school_group_uniq"
  ON "community_channels"("tenant_id", "group_kind") WHERE "scope" = 'SCHOOL' AND "group_kind" <> 'SALON' AND "auto_managed";

-- ─── 2. community_members : liaison avec le compte applicatif ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_members' AND column_name = 'linked_user_id') THEN
    ALTER TABLE community_members ADD COLUMN "linked_user_id" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_members' AND column_name = 'linked_at') THEN
    ALTER TABLE community_members ADD COLUMN "linked_at" TIMESTAMPTZ;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "community_members_linked_user_idx"
  ON "community_members"("linked_user_id") WHERE "linked_user_id" IS NOT NULL;

-- ─── 3. Rattachements membre ↔ école (source du dispatch) ───
CREATE TABLE IF NOT EXISTS "community_member_schools" (
  "id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "school_role" TEXT NOT NULL DEFAULT 'TEACHER',      -- ADMIN | TEACHER (rôle dans l'école)
  "school_name" TEXT,                                  -- cache du nom d'école au rattachement
  "source" TEXT NOT NULL DEFAULT 'APP_LINK',           -- APP_LINK | INVITE | MANUAL
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_member_schools_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_member_schools_uniq"
  ON "community_member_schools"("member_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "community_member_schools_tenant_idx"
  ON "community_member_schools"("tenant_id");
CREATE INDEX IF NOT EXISTS "community_member_schools_member_idx"
  ON "community_member_schools"("member_id");

-- ─── 4. Lives & événements (dispatch par audience) ───
CREATE TABLE IF NOT EXISTS "community_events" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'LIVE',                -- LIVE | FORMATION | ATELIER
  "title" TEXT NOT NULL,
  "description" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'GLOBAL',          -- GLOBAL | SCHOOL | GROUP
  "tenant_id" TEXT,                                   -- rempli si audience = SCHOOL | GROUP
  "group_kind" TEXT,                                  -- ADMINS | TEACHERS si audience = GROUP
  "channel_id" TEXT,                                  -- canal ciblé (auto-résolu à la création)
  "host_member_id" TEXT,
  "external_url" TEXT,                                -- YouTube Live / Meet / Zoom…
  "replay_url" TEXT,
  "scheduled_at" TIMESTAMPTZ NOT NULL,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',         -- SCHEDULED | LIVE | ENDED | CANCELLED
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "community_events_status_idx" ON "community_events"("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "community_events_audience_idx" ON "community_events"("audience", "tenant_id");
CREATE INDEX IF NOT EXISTS "community_events_channel_idx" ON "community_events"("channel_id") WHERE "channel_id" IS NOT NULL;

-- ─── 5. Invitations : possibilité de lier une école (rattachement auto) ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_invites' AND column_name = 'tenant_id') THEN
    ALTER TABLE community_invites ADD COLUMN "tenant_id" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_invites' AND column_name = 'school_role') THEN
    ALTER TABLE community_invites ADD COLUMN "school_role" TEXT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "community_invites_tenant_idx"
  ON "community_invites"("tenant_id") WHERE "tenant_id" IS NOT NULL;
