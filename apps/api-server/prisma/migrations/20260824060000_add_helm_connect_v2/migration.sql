-- ============================================================================
-- HELM CONNECT — V2 — Annonces programmées + Groupes scolaires automatiques
--                   + Notifications intelligentes (mode silencieux)
-- ============================================================================
--
-- V2.1 — Annonces programmées
--   Ajoute scheduledAt à chat_announcements (différent de publishedAt)
--   Un dispatcher cron vérifie les annonces en attente et les publie
--   automatiquement à la date programmée.
--
-- V2.2 — Groupes scolaires automatiques
--   Tables pour générer automatiquement des conversations pour :
--     • Classes (6ème A – 2026/2027)
--     • Enseignants par matière
--     • Personnel administratif
--     • Parents par niveau
--     • Conseil pédagogique
--   Les membres sont calculés dynamiquement (si un enseignant quitte la
--   classe, il est automatiquement retiré du groupe).
--
-- V2.3 — Notifications intelligentes (mode silencieux)
--   Préférences par utilisateur avec mode silencieux configurable
--   (1h, 8h, 24h, jusqu'à réactivation) + filtres par type d'événement.
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════
-- V2.1 — Annonces programmées
-- ══════════════════════════════════════════════════════════════════

-- Colonne scheduledAt : date à laquelle l'annonce DOIT être publiée
--   - Si NULL et publishedAt NULL → brouillon (jamais publié auto)
--   - Si scheduledAt renseigné et publishedAt NULL → en attente de publication
--   - Si publishedAt renseigné → déjà publié (scheduledAt ignoré)
ALTER TABLE "chat_announcements"
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ;

-- Index pour retrouver rapidement les annonces en attente
CREATE INDEX IF NOT EXISTS idx_chat_announcements_scheduled
  ON "chat_announcements" ("tenantId", "scheduledAt")
  WHERE "publishedAt" IS NULL AND "scheduledAt" IS NOT NULL AND "deletedAt" IS NULL;

COMMENT ON COLUMN "chat_announcements"."scheduledAt" IS 'V2 — Date programmée pour la publication automatique (dispatcher cron)';

-- ══════════════════════════════════════════════════════════════════
-- V2.2 — Groupes scolaires automatiques
-- ══════════════════════════════════════════════════════════════════

-- Table des groupes dynamiques : chaque entrée lie une conversation Helm Connect
-- à une "source dynamique" (classe, niveau, matière, rôle) qui détermine ses
-- membres. Le recalcul se fait à chaque accès (ou via un cron périodique).
CREATE TABLE IF NOT EXISTS "chat_dynamic_groups" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,                  -- chat_conversations.id (type=GROUP)
  "sourceType" TEXT NOT NULL,                     -- CLASS | LEVEL | SUBJECT | ROLE | ALL_TEACHERS | ALL_PARENTS | ALL_STAFF | PEDAGOGIC_COUNCIL
  "sourceClassId" TEXT,                            -- pour CLASS (academic_classes.id)
  "sourceLevel" TEXT,                              -- pour LEVEL (MATERNELLE|PRIMAIRE|SECONDAIRE)
  "sourceSubjectId" TEXT,                          -- pour SUBJECT (subjects.id)
  "sourceRole" TEXT,                               -- pour ROLE (e.g., ENSEIGNANT)
  "academicYearId" TEXT,                           -- pour CLASS/LEVEL — l'année scolaire
  "displayName" TEXT NOT NULL,                     -- ex: "6ème A — 2026/2027"
  "description" TEXT,
  "autoSync" BOOLEAN NOT NULL DEFAULT TRUE,         -- si TRUE, membres recalculés automatiquement
  "lastSyncAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "sourceType", "sourceClassId", "sourceLevel", "sourceSubjectId", "sourceRole", "academicYearId")
);

CREATE INDEX IF NOT EXISTS idx_chat_dynamic_groups_tenant ON "chat_dynamic_groups" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_chat_dynamic_groups_conv ON "chat_dynamic_groups" ("conversationId");
CREATE INDEX IF NOT EXISTS idx_chat_dynamic_groups_source ON "chat_dynamic_groups" ("tenantId", "sourceType");

COMMENT ON TABLE "chat_dynamic_groups" IS 'Helm Connect V2 — Groupes scolaires automatiques (conversations générées dynamiquement)';
COMMENT ON COLUMN "chat_dynamic_groups"."sourceType" IS 'CLASS | LEVEL | SUBJECT | ROLE | ALL_TEACHERS | ALL_PARENTS | ALL_STAFF | PEDAGOGIC_COUNCIL';

-- ══════════════════════════════════════════════════════════════════
-- V2.3 — Notifications intelligentes (mode silencieux)
-- ══════════════════════════════════════════════════════════════════

-- Table des préférences de notification par utilisateur :
--   - Mode silencieux global (DND) avec expiration
--   - Mode silencieux par conversation (surdiner une conv spécifique)
--   - Filtres par type d'événement (messages, annonces, fichiers, mentions)
CREATE TABLE IF NOT EXISTS "chat_notification_preferences" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,                   -- users.id (1 ligne par utilisateur)
  "tenantId" TEXT NOT NULL,
  -- Mode silencieux global (Do Not Disturb)
  "dndEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "dndUntil" TIMESTAMPTZ,                          -- null = jusqu'à réactivation manuelle
  "dndExceptions" JSONB,                           -- ex: ["URGENT", "ANNOUNCEMENT_HIGH"] — types qui passent quand même
  -- Filtres par type d'événement (désactiver un type complètement)
  "enableMessages" BOOLEAN NOT NULL DEFAULT TRUE,
  "enableGroupMessages" BOOLEAN NOT NULL DEFAULT TRUE,
  "enableAnnouncements" BOOLEAN NOT NULL DEFAULT TRUE,
  "enableMentions" BOOLEAN NOT NULL DEFAULT TRUE,
  "enableFiles" BOOLEAN NOT NULL DEFAULT TRUE,
  "enableInvitations" BOOLEAN NOT NULL DEFAULT TRUE,
  -- Plages horaires autorisées (mode "Disponible 08h–18h")
  "quietHoursStart" TEXT,                          -- ex: "22:00" (heure locale utilisateur)
  "quietHoursEnd" TEXT,                            -- ex: "07:00"
  "timezone" TEXT DEFAULT 'UTC',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_notification_prefs_user ON "chat_notification_preferences" ("userId", "tenantId");

COMMENT ON TABLE "chat_notification_preferences" IS 'Helm Connect V2 — Préférences notifications utilisateur (mode silencieux global + filtres)';
COMMENT ON COLUMN "chat_notification_preferences"."dndUntil" IS 'Date d''expiration du mode silencieux (null = jusqu''à réactivation)';
COMMENT ON COLUMN "chat_notification_preferences"."dndExceptions" IS 'Types d''événements qui passent malgré le DND (ex: URGENT, ANNONCE_IMPORTANTE)';

-- Mode silencieux par conversation : surdiner une conversation spécifique
--   (ex: groupe bruyant pendant 1h, 8h, 24h)
CREATE TABLE IF NOT EXISTS "chat_conversation_mutes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mutedUntil" TIMESTAMPTZ,                        -- null = jusqu'à réactivation manuelle
  "mutedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "conversationId")
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_mutes_user ON "chat_conversation_mutes" ("userId");
CREATE INDEX IF NOT EXISTS idx_chat_conv_mutes_conv ON "chat_conversation_mutes" ("conversationId");

COMMENT ON TABLE "chat_conversation_mutes" IS 'Helm Connect V2 — Mode silencieux par conversation (1h/8h/24h/jusqu''à réactivation)';
