-- ============================================================================
-- Migration 20260906180000 — Refonte CDC « étape Contrat » du processus d'embauche
-- ============================================================================
-- Idempotente (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / ON CONFLICT),
-- rejouée à chaque boot par le bootstrap main.ts (pattern établi Task 10/11).
-- ============================================================================

-- 1. Champs contrat : motif CDD, compteur de renouvellements, chaîne, essai CDI,
--    traçabilité de la décision (§4.3/§4.4), requalification Vacataire (§10)
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "cddMotif" TEXT;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "cddRenouvellements" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "cddChainId" TEXT;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "periodeEssaiMois" INTEGER;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "justificationStatut" TEXT;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "needsRequalification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "requalifieDepuis" TEXT;
CREATE INDEX IF NOT EXISTS "employment_contracts_cddChainId_idx" ON "employment_contracts"("cddChainId");
CREATE INDEX IF NOT EXISTS "employment_contracts_needsRequalification_idx" ON "employment_contracts"("needsRequalification");

-- 2. Miroir staff : justification du statut + badge « à requalifier » (§4.4/§10)
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "justificationStatut" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "needsRequalification" BOOLEAN NOT NULL DEFAULT false;

-- 3. Paramétrage par école (§9 — multi-tenant : motifs CDD, types stage, seuils, test)
CREATE TABLE IF NOT EXISTS "hr_contract_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "cddMotifs" JSONB,
    "stageTypes" JSONB,
    "cddDureeMaxMois" INTEGER NOT NULL DEFAULT 24,
    "cddRenouvellementsMax" INTEGER NOT NULL DEFAULT 1,
    "indemniteFinContratPct" DECIMAL(5,2) NOT NULL DEFAULT 6,
    "testQualificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "testQuestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hr_contract_settings_tenantId_key" UNIQUE ("tenantId"),
    CONSTRAINT "fk_hcs_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Flux stage SÉPARÉ (§6 — Décret n°2018-196 : un stagiaire n'est pas un salarié)
CREATE TABLE IF NOT EXISTS "hr_internships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "nationalId" TEXT,
    "birthDate" DATE,
    "position" TEXT,
    "typeStage" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "gratificationAmount" DECIMAL(12,2),
    "gratificationPeriodicite" TEXT,
    "etablissementOrigine" TEXT,
    "tuteurNom" TEXT,
    "tuteurStaffId" TEXT,
    "assuranceSouscrite" BOOLEAN NOT NULL DEFAULT false,
    "assurancePoliceRef" TEXT,
    "assuranceCompagnie" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "terms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fk_hi_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_hi_tuteur" FOREIGN KEY ("tuteurStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "hr_internships_tenantId_idx" ON "hr_internships"("tenantId");
CREATE INDEX IF NOT EXISTS "hr_internships_status_idx" ON "hr_internships"("status");
CREATE INDEX IF NOT EXISTS "hr_internships_tenantId_status_idx" ON "hr_internships"("tenantId", "status");

-- 5. Migration des données §10 : les dossiers « Vacataire » existants ne sont NI
--    supprimés NI réécrits — ils reçoivent un badge « à requalifier » (non bloquant).
--    La requalification (CDD ou prestation) est faite manuellement par le
--    gestionnaire RH de chaque école, avec le test d'aide à la décision.
--    Idempotent : après requalification, contractType change → plus touché.
UPDATE "employment_contracts"
   SET "needsRequalification" = true,
       "requalifieDepuis" = "contractType"
 WHERE "contractType" = 'VACATAIRE'
   AND "needsRequalification" = false;

UPDATE "staff"
   SET "needsRequalification" = true
 WHERE "contractType" = 'VACATAIRE'
   AND "needsRequalification" = false;

-- 6. Gabarit de contrat V1 → V2 (clauses renouvellement/durée cumulée +
--    indemnité de fin de contrat) : mise à niveau UNIQUEMENT des gabarits
--    jamais personnalisés (texte identique à la constante V1 d'origine).
--    Un template personnalisé par une école n'est JAMAIS écrasé.
--    (Exécuté au niveau applicatif par getStatutTemplate — comparaison exacte
--    avec CONTRAT_TRAVAIL_TEMPLATE_V1, impossible à faire en SQL pur.)
