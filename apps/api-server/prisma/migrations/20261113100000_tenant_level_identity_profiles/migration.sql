-- ⭐ 2026-11-13 — Identité spécifique par niveau scolaire (écoles combinées)
-- Écoles maternelle+primaire+secondaire dont le secondaire porte un nom, des
-- contacts et un logo différents du maternelle/primaire. Cette table override
-- le profil d'identité global (tenant_identity_profiles) pour les documents du
-- niveau. Miroir DDL idempotent dans src/main.ts (bloc post-listen) — cf.
-- pattern tenant_identity_profiles (migration 20260712140000).

CREATE TABLE IF NOT EXISTS "tenant_level_identity_profiles" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "educationLevelId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolAcronym" TEXT,
    "slogan" TEXT,
    "phonePrimary" TEXT,
    "phoneSecondary" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "department" TEXT,
    "country" TEXT DEFAULT 'BJ',
    "postalCode" TEXT,
    "logoUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_level_identity_profiles_pkey" PRIMARY KEY ("id")
);

-- Une seule identité par (tenant, niveau) — pattern TenantStamp/TenantSignature
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_level_identity_profiles_tenantId_educationLevelId_key"
    ON "tenant_level_identity_profiles"("tenantId", "educationLevelId");
CREATE INDEX IF NOT EXISTS "tenant_level_identity_profiles_tenantId_idx"
    ON "tenant_level_identity_profiles"("tenantId");
CREATE INDEX IF NOT EXISTS "tenant_level_identity_profiles_educationLevelId_idx"
    ON "tenant_level_identity_profiles"("educationLevelId");
