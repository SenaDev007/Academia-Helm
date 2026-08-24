-- ⭐ CHAT MESSAGING — Système de messagerie interne type WhatsApp
--    Permet à tous les rôles (directeur, enseignant, parent, promoteur)
--    de communiquer entre eux en temps réel via WebSocket (Socket.io).
--
--    Fonctionnalités supportées :
--    - Conversations 1-à-1 (DIRECT) et de groupe (GROUP)
--    - Messages texte, audio (enregistrés via MediaRecorder), documents, images
--    - Statut de lecture (lastReadAt) pour indicateur "non lu"
--    - Rechercher un utilisateur (par nom/email) et lui envoyer une invitation
--    - Invitations inter-écoles (cross-tenant) pour créer un écosystème
--    - Réponses threadées (replyToId)
--    - Édition/suppression logique (editedAt, deletedAt)
--
--    Sécurité :
--    - Chaque conversation est liée à un tenant (sauf invitations cross-tenant)
--    - Les participants doivent être membres pour lire/écrire
--    - Les fichiers joints sont stockés via StorageService (R2/S3/local)
--    - ⭐ Pour le "chiffrement de bout en bout" : true E2E nécessite une
--      gestion client-side des clés (Web Crypto API). Pour cette V1, on
--      s'appuie sur TLS pour le transport et le StorageService chiffré
--      au repos. Le vrai E2E (Signal protocol-like) sera ajouté en V2.

-- ═══════════════════════════════════════════════════════════════════
--  CONVERSATIONS — 1-à-1 ou groupe
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "type"            TEXT NOT NULL DEFAULT 'DIRECT',   -- 'DIRECT' | 'GROUP'
    "name"            TEXT,                              -- nom du groupe (pour GROUP)
    "description"     TEXT,                              -- description du groupe (optionnel)
    "avatarUrl"       TEXT,                              -- photo du groupe (optionnel)
    "createdBy"       TEXT NOT NULL,                     -- userId du créateur
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt"   TIMESTAMP(3),                      -- pour trier les conversations
    "lastMessagePreview" TEXT,                           -- preview dénormalisé (40 premiers caractères)
    "lastMessageSenderId" TEXT,                          -- qui a envoyé le dernier message

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_conversations_tenant_idx"
    ON "chat_conversations" ("tenantId");
CREATE INDEX IF NOT EXISTS "chat_conversations_lastMessageAt_idx"
    ON "chat_conversations" ("lastMessageAt" DESC);

ALTER TABLE "chat_conversations"
    ADD CONSTRAINT "chat_conversations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
--  PARTICIPANTS — qui est dans quelle conversation
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_participants" (
    "id"              TEXT NOT NULL,
    "conversationId"  TEXT NOT NULL,
    "userId"          TEXT NOT NULL,                     -- user.id (tous rôles confondus)
    "tenantId"        TEXT NOT NULL,                     -- dénormalisé pour requêtes rapides
    "role"            TEXT NOT NULL DEFAULT 'MEMBER',    -- 'ADMIN' (créateur) | 'MEMBER'
    "joinedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt"      TIMESTAMP(3),                      -- pour calculer le nombre de messages non lus
    "muted"           BOOLEAN NOT NULL DEFAULT false,    -- notifications silencieuses
    "leftAt"          TIMESTAMP(3),                      -- si l'utilisateur a quitté le groupe

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- ⭐ Contrainte d'unicité : un user ne peut être qu'une fois par conversation
CREATE UNIQUE INDEX IF NOT EXISTS "chat_participants_conv_user_idx"
    ON "chat_participants" ("conversationId", "userId")
    WHERE "leftAt" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_participants_user_idx"
    ON "chat_participants" ("userId", "leftAt");
CREATE INDEX IF NOT EXISTS "chat_participants_conv_idx"
    ON "chat_participants" ("conversationId");

ALTER TABLE "chat_participants"
    ADD CONSTRAINT "chat_participants_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
--  MESSAGES — contenu des conversations
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id"              TEXT NOT NULL,
    "conversationId"  TEXT NOT NULL,
    "senderId"        TEXT NOT NULL,                     -- user.id
    "type"            TEXT NOT NULL DEFAULT 'TEXT',       -- 'TEXT' | 'AUDIO' | 'DOCUMENT' | 'IMAGE'
    "content"         TEXT,                              -- texte (pour TEXT) ou transcription (pour AUDIO)
    -- ⭐ Métadonnées du fichier joint (pour AUDIO/DOCUMENT/IMAGE)
    "attachmentUrl"   TEXT,                              -- URL publique ou clé R2/S3
    "attachmentName"  TEXT,                              -- nom original du fichier
    "attachmentSize"  INTEGER,                            -- taille en octets
    "attachmentMime"  TEXT,                              -- MIME type (image/png, audio/webm, application/pdf)
    "duration"        INTEGER,                           -- durée en ms (pour AUDIO/VIDEO)
    -- ⭐ Réponses threadées
    "replyToId"       TEXT,                              -- référence au message auquel on répond
    -- ⭐ Métadonnées temporelles
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt"        TIMESTAMP(3),                      -- si le message a été édité
    "deletedAt"       TIMESTAMP(3),                      -- suppression logique (soft delete)

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_conv_created_idx"
    ON "chat_messages" ("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "chat_messages_sender_idx"
    ON "chat_messages" ("senderId");
CREATE INDEX IF NOT EXISTS "chat_messages_replyTo_idx"
    ON "chat_messages" ("replyToId");

ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Self-reference pour replyToId (avec ON DELETE SET NULL pour ne pas casser toute la conv)
ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
--  STATUT DE LECTURE — pour les accusés de lecture (whatsapp blue ticks)
--    (un message peut être lu par plusieurs participants dans un groupe)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_message_read_receipts" (
    "id"              TEXT NOT NULL,
    "messageId"       TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "readAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_read_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_read_receipts_msg_user_idx"
    ON "chat_message_read_receipts" ("messageId", "userId");

ALTER TABLE "chat_message_read_receipts"
    ADD CONSTRAINT "chat_read_receipts_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
--  INVITATIONS — pour rechercher + inviter un utilisateur (inter-écoles)
--    Le flow est : A envoie une invitation à B (avec email ou userId)
--    B peut ACCEPTER ou REFUSER. Si acceptée, une conversation DIRECT est créée.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_invitations" (
    "id"              TEXT NOT NULL,
    "senderId"        TEXT NOT NULL,                     -- user.id de l'expéditeur
    "senderTenantId"  TEXT NOT NULL,                     -- tenant de l'expéditeur
    "recipientId"     TEXT,                              -- user.id du destinataire (si trouvé sur la plateforme)
    "recipientEmail"  TEXT,                              -- email (pour invitations cross-tenant)
    "recipientName"   TEXT,                              -- nom affiché (pourInvitations externes)
    "status"          TEXT NOT NULL DEFAULT 'PENDING',   -- 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED'
    "message"         TEXT,                              -- message personnalisé d'invitation (optionnel)
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt"     TIMESTAMP(3),
    "conversationId"  TEXT,                              -- si acceptée, la conv créée

    CONSTRAINT "chat_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_invitations_recipient_idx"
    ON "chat_invitations" ("recipientId", "status");
CREATE INDEX IF NOT EXISTS "chat_invitations_recipientEmail_idx"
    ON "chat_invitations" ("recipientEmail", "status");
CREATE INDEX IF NOT EXISTS "chat_invitations_sender_idx"
    ON "chat_invitations" ("senderId", "status");
