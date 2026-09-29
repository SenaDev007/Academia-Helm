-- ============================================================================
-- HELM CONNECT V5 — 10 fonctionnalités backend (sécurité + modération + pédagogie)
-- ============================================================================
--
-- Contenu (toutes les instructions sont idempotentes — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) :
--   1.  Blocage d'utilisateurs            → chat_user_blocks
--   2.  Matrice de permissions « qui contacte qui » → chat_contact_policy (JSONB par tenant)
--   3.  Invitable + add-members + audit   → (aucune table — colonnes existantes)
--   7.  Liaisons pédagogiques             → chat_conversations.pedagogicalType / linkedEntityId
--   10. Modérateur + droits + approbation → chat_participants.permissions / joinStatus,
--                                           chat_conversations.requireApproval
--
-- ⭐ Note : le rôle de participant 'MODERATOR' est une simple nouvelle valeur autorisée
--    pour la colonne TEXT chat_participants.role ('ADMIN' | 'MODERATOR' | 'MEMBER') —
--    pas de contrainte SQL à modifier (colonne TEXT sans CHECK).
-- ============================================================================

-- ═════════════════════════════════════════════════════════════════
--  1. BLOCAGE UTILISATEURS (parité Yeshua `blocks/route.ts`)
--     Une ligne = « blockerId a bloqué blockedId » (dans UN sens).
--     Vérifié à chaque création/ouverture de DM, envoi de message en privé
--     et démarrage d'appel — dans les DEUX sens (403).
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_user_blocks" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "blockerId"  TEXT NOT NULL,                -- users.id (celui qui bloque)
    "blockedId"  TEXT NOT NULL,                -- users.id (celui qui est bloqué)
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_user_blocks_pkey" PRIMARY KEY ("id"),
    -- Un blocage par couple (blocker, blocked) et par tenant — idempotent via ON CONFLICT
    -- (nom identique à la contrainte générée par Prisma pour le modèle ChatUserBlock)
    CONSTRAINT "chat_user_blocks_blockerId_blockedId_tenantId_key" UNIQUE ("blockerId", "blockedId", "tenantId")
);

CREATE INDEX IF NOT EXISTS "chat_user_blocks_blockedId_idx"
    ON "chat_user_blocks" ("blockedId");
CREATE INDEX IF NOT EXISTS "chat_user_blocks_tenantId_idx"
    ON "chat_user_blocks" ("tenantId");
CREATE INDEX IF NOT EXISTS "chat_user_blocks_blockerId_idx"
    ON "chat_user_blocks" ("blockerId");

COMMENT ON TABLE "chat_user_blocks" IS 'Helm Connect V5 — blocage des membres (parité Yeshua UserBlock) : un bloqué ne peut plus être contacté en privé, ni écrire, ni appeler (vérifié dans les deux sens)';
COMMENT ON COLUMN "chat_audit_logs"."action" IS 'One of: MESSAGE_EDIT, MESSAGE_DELETE, MESSAGE_PIN, MESSAGE_UNPIN, MESSAGE_FORWARD, USER_BAN, USER_UNBAN, USER_KICK, USER_MUTE, USER_UNMUTE, SLOW_MODE_SET, REACTION_ADD, REACTION_REMOVE, IMPORTANT_TOGGLE, CONVERSATION_CREATE, CONVERSATION_UPDATE, BLOCK_USER, UNBLOCK_USER, INVITE_MEMBERS, MEMBER_ROLE_UPDATE, MEMBER_APPROVE, MEMBER_REJECT, JOIN_REQUEST, CALL_BLOCKED';

-- ═════════════════════════════════════════════════════════════════
--  2. POLITIQUE DE CONTACT PAR TENANT (spéc école #7/#16)
--     JSONB : { allowStudentToTeacher, allowStudentToParent,
--               allowParentToTeacher, restrictStudents }
--     Absence de ligne = défauts sûrs appliqués côté service.
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_contact_policy" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "policy"    JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_contact_policy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_contact_policy_tenantId_key" UNIQUE ("tenantId")
);

COMMENT ON TABLE "chat_contact_policy" IS 'Helm Connect V5 — matrice « qui peut contacter qui » : règles de création de DM par tenant (STUDENT/PARENT restreints, TEACHER/ADMIN/DIRECTOR libres)';

-- ═════════════════════════════════════════════════════════════════
--  7. LIAISONS PÉDAGOGIQUES (spéc #8)
--     pedagogicalType : CLASS | SUBJECT | HOMEWORK | ACTIVITY | COURSE
--     linkedEntityId  : id de l'entité liée (classes.id / subjects.id / devoirs…)
-- ═════════════════════════════════════════════════════════════════
ALTER TABLE "chat_conversations"
    ADD COLUMN IF NOT EXISTS "pedagogicalType" TEXT;   -- CLASS | SUBJECT | HOMEWORK | ACTIVITY | COURSE
ALTER TABLE "chat_conversations"
    ADD COLUMN IF NOT EXISTS "linkedEntityId" TEXT;

CREATE INDEX IF NOT EXISTS "chat_conversations_tenantId_pedagogicalType_idx"
    ON "chat_conversations" ("tenantId", "pedagogicalType");

COMMENT ON COLUMN "chat_conversations"."pedagogicalType" IS 'Helm Connect V5 — type de liaison pédagogique : CLASS | SUBJECT | HOMEWORK | ACTIVITY | COURSE (null = conversation classique)';
COMMENT ON COLUMN "chat_conversations"."linkedEntityId" IS 'Helm Connect V5 — id de l''entité pédagogique liée (classes.id, subjects.id, devoirs.id, activités.id, cours.id)';

-- ═════════════════════════════════════════════════════════════════
--  10. MODÉRATEUR + DROITS PERSONNALISÉS + APPROBATION D'ADHÉSION
--      chat_participants.role accepte désormais 'MODERATOR' (TEXT, sans CHECK).
--      permissions (JSONB, null = défauts du rôle) :
--        { canPin, canDeleteMessages, canInvite, canMute, canBroadcast }
--        ADMIN: tout ; MODERATOR: canPin + canDeleteMessages + canMute ; MEMBER: rien.
--      joinStatus : ACTIVE | PENDING (adhésion en attente d'approbation).
--      chat_conversations.requireApproval : si true, joinByInviteLink crée PENDING.
-- ═════════════════════════════════════════════════════════════════
ALTER TABLE "chat_participants"
    ADD COLUMN IF NOT EXISTS "permissions" JSONB;

ALTER TABLE "chat_participants"
    ADD COLUMN IF NOT EXISTS "joinStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "chat_participants_conversationId_joinStatus_idx"
    ON "chat_participants" ("conversationId", "joinStatus");

ALTER TABLE "chat_conversations"
    ADD COLUMN IF NOT EXISTS "requireApproval" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "chat_participants"."role" IS 'ADMIN (créateur/gestionnaire) | MODERATOR (modération limitée) | MEMBER (simple membre)';
COMMENT ON COLUMN "chat_participants"."permissions" IS 'Helm Connect V5 — droits personnalisés { canPin, canDeleteMessages, canInvite, canMute, canBroadcast } ; null/{} = défauts du rôle';
COMMENT ON COLUMN "chat_participants"."joinStatus" IS 'ACTIVE (membre actif) | PENDING (adhésion via lien, en attente d''approbation par un ADMIN)';
COMMENT ON COLUMN "chat_conversations"."requireApproval" IS 'Helm Connect V5 — si true, les adhésions via lien d''invitation passent en PENDING jusqu''à approbation';

-- Fin — toutes les instructions sont idempotentes.
