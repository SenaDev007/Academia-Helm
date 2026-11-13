-- ============================================================================
-- AllowanceType.code : unicité GLOBALE → unicité PAR TENANT
-- ----------------------------------------------------------------------------
-- Le champ code était @unique (contrainte globale sur la table) : deux écoles
-- (tenants) ne pouvaient pas utiliser le même code « LOGEMENT ». Cela bloquait
-- l'auto-provisionnement du catalogue complet des types d'indemnité pour
-- chaque tenant ( AllowancesPrismaService.ensureCatalogForTenant ).
--
-- Nouvelle règle : un code est unique AU SEIN d'un tenant
-- (contrainte composite tenantId + code, @@unique([tenantId, code])).
--
-- Sans risque : l'ancienne contrainte globale interdisait les doublons de code,
-- donc aucun doublon (tenantId, code) ne peut préexister.
-- ============================================================================

ALTER TABLE "allowance_types" DROP CONSTRAINT IF EXISTS "allowance_types_code_key";

ALTER TABLE "allowance_types"
  ADD CONSTRAINT "allowance_types_tenantId_code_key" UNIQUE ("tenantId", "code");
