-- ============================================================================
-- RH Bénin — Statut contractuel (SALARIE_DECLARE | SALARIE_NON_DECLARE | PRESTATAIRE_SERVICE)
-- Refonte du processus d'embauche (2 flux) + générateur de contrats + moteur de paie.
-- Idempotent : ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================================

-- ── 1. Nouvelles colonnes : staff ──────────────────────────────────────────
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "statutContractuel" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "cnssDeclarationDate" TIMESTAMP(3);
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "documentPaieType" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "prestationPaymentMode" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "prestationAmount" DECIMAL(12, 2);
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "statutContractuelLockedAt" TIMESTAMP(3);

-- ── 2. Nouvelles colonnes : employment_contracts ──────────────────────────
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "statutContractuel" TEXT;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "documentPaieType" TEXT;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "prestationPaymentMode" TEXT;
ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "prestationAmount" DECIMAL(12, 2);

-- ── 3. Nouvelle colonne : hr_jobs (offre d'embauche) ──────────────────────
ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "statutContractuel" TEXT;

CREATE INDEX IF NOT EXISTS "staff_statutContractuel_idx" ON "staff"("statutContractuel");
CREATE INDEX IF NOT EXISTS "employment_contracts_statutContractuel_idx" ON "employment_contracts"("statutContractuel");

-- ── 4. Table : staff_statut_changes (procédure tracée de changement de statut) ──
CREATE TABLE IF NOT EXISTS "staff_statut_changes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "previousStatut" TEXT,
  "newStatut" TEXT NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "justification" TEXT NOT NULL,
  "performedBy" TEXT,
  "performedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_ssc_staff" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_ssc_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "staff_statut_changes_tenantId_staffId_idx" ON "staff_statut_changes"("tenantId", "staffId");
CREATE INDEX IF NOT EXISTS "staff_statut_changes_tenantId_effectiveDate_idx" ON "staff_statut_changes"("tenantId", "effectiveDate");

-- ── 5. Table : payroll_fiscal_rates (barèmes versionnés par année fiscale) ──
CREATE TABLE IF NOT EXISTS "payroll_fiscal_rates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "countryCode" TEXT NOT NULL DEFAULT 'BJ',
  "fiscalYear" INTEGER NOT NULL,
  "cnssSalarial" DECIMAL(5,2) NOT NULL DEFAULT 3.6,
  "cnssPrestationsFamiliales" DECIMAL(5,2) NOT NULL DEFAULT 9.0,
  "cnssRisquesProMin" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  "cnssRisquesProMax" DECIMAL(5,2) NOT NULL DEFAULT 4.0,
  "cnssVieillesse" DECIMAL(5,2) NOT NULL DEFAULT 16.0,
  "cnssPatronalGlobal" DECIMAL(5,2) NOT NULL DEFAULT 15.4,
  "itsBrackets" JSONB NOT NULL,
  "aibAvecIfu" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
  "aibSansIfu" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  "smig" DECIMAL(12,2) NOT NULL DEFAULT 52000,
  "cnssMensuelSeuil" INTEGER NOT NULL DEFAULT 20,
  "categoryRules" JSONB,
  "effectiveFrom" DATE NOT NULL,
  "sourceNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_fiscal_rates_countryCode_fiscalYear_key" ON "payroll_fiscal_rates"("countryCode", "fiscalYear");

-- ── 6. Seed : barème fiscal & social Bénin 2026 (à confirmer cnss.bj / impots.finances.bj) ──
-- ITS : barème annuel DGI 2026 (720 000 / 1 800 000 / 3 000 000 / 6 000 000 / 12 000 000 /
-- 36 000 000 FCFA) ramené en équivalent mensuel (÷ 12) — le moteur de paie calcule au mois.
INSERT INTO "payroll_fiscal_rates" (
  "id", "countryCode", "fiscalYear",
  "cnssSalarial", "cnssPrestationsFamiliales", "cnssRisquesProMin", "cnssRisquesProMax",
  "cnssVieillesse", "cnssPatronalGlobal", "itsBrackets", "aibAvecIfu", "aibSansIfu",
  "smig", "cnssMensuelSeuil", "categoryRules", "effectiveFrom", "sourceNotes"
) VALUES (
  gen_random_uuid(), 'BJ', 2026,
  3.6, 9.0, 1.0, 4.0, 16.0, 15.4,
  '[{"min":0,"max":60000,"rate":0},{"min":60000,"max":150000,"rate":10},{"min":150000,"max":250000,"rate":15},{"min":250000,"max":500000,"rate":19},{"min":500000,"max":1000000,"rate":25},{"min":1000000,"max":3000000,"rate":30},{"min":3000000,"max":null,"rate":35}]'::jsonb,
  3.0, 5.0, 52000.0, 20,
  '{"OUVRIER_EMPLOYE":{"essai":"un (1) mois","renouvellement":"une (1) fois","preavis":"quinze (15) jours"},"AGENT_MAITRISE":{"essai":"deux (2) mois","renouvellement":"une (1) fois","preavis":"un (1) mois"},"CADRE":{"essai":"trois (3) mois","renouvellement":"une (1) fois","preavis":"trois (3) mois"},"ENSEIGNANT":{"essai":"deux (2) mois","renouvellement":"une (1) fois","preavis":"un (1) mois"}}'::jsonb,
  '2026-01-01',
  'CNSS (cnss.bj) : salarial 3,6 % - prestations familiales patronales 9 % (à CONFIRMER, certains guides indiquent 12 %) - patronal global ~15,4 %. ITS : barème annuel DGI 2026 (720k/1,8M/3M/6M/12M/36M FCFA - 0/10/15/19/25/30/35 %) ramené en mensuel, À CONFIRMER sur impots.finances.bj. AIB : 3 % avec IFU / 5 % sans IFU. SMIG : 52 000 FCFA/mois. Barèmes essai/préavis : chiffres généraux Bénin, à faire confirmer par un juriste (convention collective enseignement privé).'
) ON CONFLICT ("countryCode", "fiscalYear") DO NOTHING;
