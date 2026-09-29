-- ============================================================================
-- USER TENANTS — Promoteur multi-écoles (vue stratégique / gros morceau)
-- ============================================================================
--
-- Le modèle UserTenant existe dans schema.prisma (relation user ↔ tenant,
-- rôle PROMOTER par défaut) mais AUCUNE migration ne créait la table :
-- l'onboarding l'insérait de manière défensive (try/catch « migration pas
-- encore appliquée »). Cette migration la matérialise proprement.
--
-- Une ligne = « l'utilisateur userId gère l'établissement tenantId » avec le
-- rôle indiqué (PROMOTER aujourd'hui — extensible aux co-gérants plus tard).
-- Créée par l'onboarding lorsqu'un promoteur EXISTANT fonde une nouvelle
-- école ; lue par /auth/available-tenants, /auth/select-tenant et
-- /analytics/consolidated (vue stratégique du groupe).
--
-- ⭐ Toutes les instructions sont idempotentes (IF NOT EXISTS / garde
--    pg_constraint) : sans risque si la table existe déjà via db push.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "user_tenants" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'PROMOTER',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id")
);

-- Un utilisateur ne peut être lié qu'une fois à un tenant donné
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenants_userId_tenantId_key"
    ON "user_tenants"("userId", "tenantId");

-- Recherches par utilisateur (liste de ses écoles) et par tenant (staff du tenant)
CREATE INDEX IF NOT EXISTS "user_tenants_userId_idx" ON "user_tenants"("userId");
CREATE INDEX IF NOT EXISTS "user_tenants_tenantId_idx" ON "user_tenants"("tenantId");

-- Clés étrangères (cascade : supprimer l'user ou le tenant supprime la liaison)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tenants_userId_fkey') THEN
        ALTER TABLE "user_tenants"
            ADD CONSTRAINT "user_tenants_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tenants_tenantId_fkey') THEN
        ALTER TABLE "user_tenants"
            ADD CONSTRAINT "user_tenants_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
