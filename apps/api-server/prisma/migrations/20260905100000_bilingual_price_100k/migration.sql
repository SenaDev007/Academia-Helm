-- ============================================================================
-- RÉVISION TARIFAIRE — OPTION BILINGUE FR/EN : 50 000 → 100 000 FCFA/an
-- ============================================================================
--
-- Contrat d'abonnement (Article 4) — révision du tarif de l'option bilingue :
--   - Référence mensuelle : 5 000 → 10 000 FCFA/mois
--   - Tarif annuel facturé : 50 000 → 100 000 FCFA/an
--   - Réduction inchangée : 2 mois offerts (12 × 10 000 = 120 000 → 100 000)
--
-- ⚠️ CONDITIONNELLE sur l'ancien tarif officiel (mensuel 5 000 / annuel
--    50 000) afin de ne JAMAIS écraser un tarif personnalisé modifié depuis
--    le back-office (/platform/subscriptions → carte « Option bilingue »).
--
-- S'applique :
--   1. au plan add-on BILINGUAL (yearlyAmount + bilingualMonthly/Yearly) ;
--   2. aux colonnes bilingues tamponnées sur chaque plan
--      (SEED/GROW/LEAD/NETWORK — lues par PricingService.calculateBilingualPrice) ;
--   3. à la pricing_configs active (fallback versionné — colonnes SNAKE_CASE).
--
-- Les mêmes instructions sont rejouées à froid au démarrage de l'api-server
-- (bootstrap SQL conditionnel de main.ts) — cette migration assure la traç
--abilité Prisma et s'applique aux environnements qui exécutent `migrate`.
-- ============================================================================

-- 1. Colonnes bilingues de TOUS les plans portant l'ancien tarif officiel
UPDATE "pricing_plans"
SET "bilingualMonthly" = 10000,
    "bilingualYearly" = 100000,
    "updatedAt" = NOW()
WHERE "bilingualYearly" = 50000
  AND ("bilingualMonthly" = 5000 OR "bilingualMonthly" IS NULL);

-- 2. Plan add-on BILINGUAL : montant annuel dédié
UPDATE "pricing_plans"
SET "yearlyAmount" = 100000,
    "updatedAt" = NOW()
WHERE "code" = 'BILINGUAL'
  AND "yearlyAmount" = 50000;

-- 3. Textes du plan BILINGUAL portant encore l'ancien montant
UPDATE "pricing_plans"
SET "description" = 'Option bilingue FR/EN — en supplément de n''importe quel plan. Facturée annuellement (contrat Article 4) : 10 000 F CFA/mois de référence, 100 000 F CFA/an (2 mois offerts).',
    "updatedAt" = NOW()
WHERE "code" = 'BILINGUAL'
  AND "description" LIKE '%50 000%';

UPDATE "pricing_plans"
SET "features" = '["Classes, matières, examens et bulletins en français ET en anglais","Structure EN miroir (Nursery 1/2, Primary 1-6) créée automatiquement","Espace Pédagogique EN dédié (Scheme of Work, Attendance)","Facturation annuelle — tarif piloté depuis le back-office"]',
    "updatedAt" = NOW()
WHERE "code" = 'BILINGUAL'
  AND "features" LIKE '%50 000%';

-- 4. pricing_configs active (fallback versionné — colonnes SNAKE_CASE)
UPDATE "pricing_configs"
SET "bilingual_monthly_addon" = 10000,
    "bilingual_yearly_addon" = 100000
WHERE "is_active" = true
  AND "bilingual_yearly_addon" = 50000
  AND ("bilingual_monthly_addon" = 5000 OR "bilingual_monthly_addon" IS NULL);
