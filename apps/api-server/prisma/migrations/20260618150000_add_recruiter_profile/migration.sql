-- ============================================================================
-- Migration: 20260618150000_add_recruiter_profile
-- ============================================================================
-- Crée la table `recruiter_profiles` pour configurer le recruteur par tenant.
--
-- Types de recruteur :
--   - PROMOTER     : le promoteur/fondateur gère lui-même le RH
--   - DEDICATED_RH : un responsable RH dédié (lié à un Staff)
--   - DELEGATED    : un autre membre du staff délégué par le promoteur
-- ============================================================================

CREATE TABLE IF NOT EXISTS "recruiter_profiles" (
    "id"                      TEXT NOT NULL,
    "tenantId"                TEXT NOT NULL,
    "recruiterType"           TEXT NOT NULL DEFAULT 'PROMOTER',
    "staffId"                 TEXT,
    "fullName"                TEXT NOT NULL,
    "functionLabel"           TEXT,
    "email"                   TEXT NOT NULL,
    "phone"                   TEXT,
    "signatureText"           TEXT,
    "signatureLogoUrl"        TEXT,
    "defaultInterviewFormat"  TEXT NOT NULL DEFAULT 'Visioconférence',
    "defaultInterviewDelayHr" INTEGER NOT NULL DEFAULT 48,
    "isActive"                BOOLEAN NOT NULL DEFAULT true,
    "createdBy"               TEXT,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("id")
);

-- Index sur tenantId (recherches par tenant)
CREATE INDEX IF NOT EXISTS "recruiter_profiles_tenantId_idx" ON "recruiter_profiles"("tenantId");

-- Contrainte d'unicité : 1 profil de recruteur par tenant
CREATE UNIQUE INDEX IF NOT EXISTS "recruiter_profiles_tenantId_key" ON "recruiter_profiles"("tenantId");

-- Contrainte FK vers tenants
ALTER TABLE "recruiter_profiles"
    ADD CONSTRAINT "recruiter_profiles_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
