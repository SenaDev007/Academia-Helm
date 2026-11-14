-- Migration: fix unique index on chat_auto_groups
-- Date: 2026-11-15
-- Description: l'index unique créé en 20260901170000 omettait levelId et
--   academicTrackId. Or les canaux Helm Connect par piste (ADMIN_TRACK FR + EN,
--   PEDAGOGIC_TRACK FR/EN, COUNCIL_BY_TRACK_LEVEL piste x niveau) nécessitent
--   PLUSIEURS lignes par (tenant, année, groupType) distinguées par
--   academicTrackId/levelId. Résultat : dès la 2e piste, l'INSERT tombait sur
--   `duplicate key value violates unique constraint "idx_chat_auto_groups_unique"`
--   (code 23505) dans HelmConnectBootstrapService/AutoChannelByTrackService,
--   et syncTrackAutoGroups abandonnait le tenant.
--
--   L'index élargi (2 colonnes COALESCEes de plus) ne peut être violé par les
--   données existantes : l'ancien index garantissait déjà l'unicité du préfixe
--   (colonnes 1-6), donc deux lignes ne peuvent coïncider sur les 8.

DROP INDEX IF EXISTS "idx_chat_auto_groups_unique";

CREATE UNIQUE INDEX "idx_chat_auto_groups_unique"
    ON "chat_auto_groups" ("tenantId", "academicYearId", "groupType",
        COALESCE("classId", '00000000-0000-0000-0000-000000000000'),
        COALESCE("subjectId", '00000000-0000-0000-0000-000000000000'),
        COALESCE("roleType", 'NONE'),
        COALESCE("levelId", '00000000-0000-0000-0000-000000000000'),
        COALESCE("academicTrackId", '00000000-0000-0000-0000-000000000000'));
