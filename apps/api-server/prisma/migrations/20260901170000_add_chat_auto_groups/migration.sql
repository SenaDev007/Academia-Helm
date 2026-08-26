-- ============================================================================
-- V3-10: Groupes scolaires automatiques — Helm Connect
-- ============================================================================
-- Crée une table pour stocker les groupes automatiques générés par classe ×
-- année académique. Le backend peut créer automatiquement des conversations
-- de groupe pour chaque classe, matière, et rôle (enseignants, parents,
-- administration) au début de chaque année scolaire.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "chat_auto_groups" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "conversationId"  TEXT,
    "groupType"       TEXT NOT NULL,  -- 'CLASS' | 'SUBJECT' | 'ROLE' | 'STAFF'
    "classId"         TEXT,
    "subjectId"       TEXT,
    "roleType"        TEXT,           -- 'TEACHERS' | 'PARENTS' | 'ADMINISTRATION' | 'ALL_STAFF'
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "autoSync"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_chat_auto_groups_tenant_year"
    ON "chat_auto_groups" ("tenantId", "academicYearId");

CREATE INDEX IF NOT EXISTS "idx_chat_auto_groups_type"
    ON "chat_auto_groups" ("tenantId", "groupType", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_chat_auto_groups_unique"
    ON "chat_auto_groups" ("tenantId", "academicYearId", "groupType",
        COALESCE("classId", '00000000-0000-0000-0000-000000000000'),
        COALESCE("subjectId", '00000000-0000-0000-0000-000000000000'),
        COALESCE("roleType", 'NONE'));
