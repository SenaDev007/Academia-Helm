-- ============================================================================
-- Migration: 20260901000000_align_pricing_to_contract
-- ============================================================================
-- ⭐ ALIGNEMENT DU PRICING SUR LE CONTRAT D'ABONNEMENT ACADEMIA HELM (Article 4)
--
-- Met à jour la table `pricing_plans` pour refléter les 4 plans du contrat :
--
--   | Plan              | Tranche élèves  | Activation | Annuel   | Total An |
--   |-------------------|-----------------|------------|----------|----------|
--   | Helm Essentiel    | 1 à 50          | 300 000    | 50 000   | 350 000  |
--   | Helm Croissance   | 51 à 150        | 300 000    | 75 000   | 375 000  |
--   | Helm Performance  | 151 à 400       | 300 000    | 100 000  | 400 000  |
--   | Helm Institution  | 401 et +        | 300 000    | 150 000  | 450 000  |
--
-- Add-ons (Article 4) :
--   - Option bilingue FR/EN : 50 000 FCFA/an (en supplément, quel que soit le plan)
--   - SMS / Email / Voice : facturés au prix coûtant
--   - WhatsApp : GRATUIT et illimité, inclus dans tous les plans
--
-- Modalités de paiement (Article 4) :
--   - Frais d'activation : dus intégralement à la signature
--   - Frais annuels : dus chaque année à la date anniversaire
--   - Pénalité de retard : 15 jours après échéance → suspension possible
--   - Réglement : virement bancaire, Mobile Money (FedaPay/FeexPay), espèces
--
-- ⚠️ Cette migration met à jour les plans SEED/GROW/LEAD/NETWORK existants
-- (leurs codes restent inchangés pour la compatibilité avec HelmSubscription.plan
-- et HelmPlan enum). Les noms d'affichage sont renommés vers les libellés du
-- contrat (Helm Essentiel, Helm Croissance, Helm Performance, Helm Institution).
-- ============================================================================

-- ─── 1. Mise à jour des 4 plans (codes préservés : SEED, GROW, LEAD, NETWORK) ───

UPDATE "pricing_plans" SET
  "name" = 'Helm Essentiel',
  "tagline" = 'L''essentiel pour bien démarrer',
  "description" = 'Plan d''entrée pour les petites écoles (1 à 50 élèves). Inclut l''intégralité des 21 modules métier + 6 modules complémentaires, le mode offline-first, les agents IA (ORION, SARA, ATLAS) et tous les canaux de communication.',
  "studentMin" = 1,
  "studentMax" = 50,
  "initialFee" = 300000,
  "monthlyAmount" = NULL,
  "yearlyAmount" = 50000,
  "bilingualMonthly" = NULL,
  "bilingualYearly" = 50000,
  "features" = '["21 modules métier + 6 modules complémentaires inclus","1 à 50 élèves","Frais d''activation 300 000 FCFA (one-shot)","Frais annuels 50 000 FCFA/an","Web + Desktop + Mobile — Offline-first","Agents IA ORION, SARA, ATLAS","Paiements en ligne FedaPay/FeexPay","Multi-caisses, multi-niveaux","Reçus PDF/WhatsApp/SMS","Personnalisation de marque","Site institutionnel","WhatsApp illimité gratuit"]',
  "isPopular" = false,
  "sortOrder" = 1,
  "updatedAt" = NOW()
WHERE "code" = 'SEED';

UPDATE "pricing_plans" SET
  "name" = 'Helm Croissance',
  "tagline" = 'Pilotez votre croissance',
  "description" = 'Plan pour les écoles en croissance (51 à 150 élèves). Idéal pour les établissements qui étendent leur effectif et nécessitent un pilotage avancé.',
  "studentMin" = 51,
  "studentMax" = 150,
  "initialFee" = 300000,
  "monthlyAmount" = NULL,
  "yearlyAmount" = 75000,
  "bilingualMonthly" = NULL,
  "bilingualYearly" = 50000,
  "features" = '["21 modules métier + 6 modules complémentaires inclus","51 à 150 élèves","Frais d''activation 300 000 FCFA (one-shot)","Frais annuels 75 000 FCFA/an","Web + Desktop + Mobile — Offline-first","Agents IA ORION, SARA, ATLAS","Paiements en ligne FedaPay/FeexPay","Multi-caisses, multi-niveaux","Reçus PDF/WhatsApp/SMS","Personnalisation de marque","Site institutionnel","WhatsApp illimité gratuit"]',
  "isPopular" = true,
  "sortOrder" = 2,
  "updatedAt" = NOW()
WHERE "code" = 'GROW';

UPDATE "pricing_plans" SET
  "name" = 'Helm Performance',
  "tagline" = 'Dominez votre marché',
  "description" = 'Plan pour les grandes écoles (151 à 400 élèves). Pour les établissements qui veulent un pilotage avancé et l''analytics complet.',
  "studentMin" = 151,
  "studentMax" = 400,
  "initialFee" = 300000,
  "monthlyAmount" = NULL,
  "yearlyAmount" = 100000,
  "bilingualMonthly" = NULL,
  "bilingualYearly" = 50000,
  "features" = '["21 modules métier + 6 modules complémentaires inclus","151 à 400 élèves","Frais d''activation 300 000 FCFA (one-shot)","Frais annuels 100 000 FCFA/an","Web + Desktop + Mobile — Offline-first","Agents IA ORION, SARA, ATLAS","Paiements en ligne FedaPay/FeexPay","Multi-caisses, multi-niveaux","Reçus PDF/WhatsApp/SMS","Personnalisation de marque","Site institutionnel","WhatsApp illimité gratuit"]',
  "isPopular" = false,
  "sortOrder" = 3,
  "updatedAt" = NOW()
WHERE "code" = 'LEAD';

UPDATE "pricing_plans" SET
  "name" = 'Helm Institution',
  "tagline" = 'La catégorie multi-école',
  "description" = 'Plan pour les réseaux d''écoles et établissements multi-campus (401 élèves et +). Pour les institutions de grande taille nécessitant un accompagnement dédié.',
  "studentMin" = 401,
  "studentMax" = NULL,
  "initialFee" = 300000,
  "monthlyAmount" = NULL,
  "yearlyAmount" = 150000,
  "bilingualMonthly" = NULL,
  "bilingualYearly" = 50000,
  "features" = '["21 modules métier + 6 modules complémentaires inclus","401 élèves et +","Frais d''activation 300 000 FCFA (one-shot)","Frais annuels 150 000 FCFA/an","Web + Desktop + Mobile — Offline-first","Agents IA ORION, SARA, ATLAS","Paiements en ligne FedaPay/FeexPay","Multi-caisses, multi-niveaux","Reçus PDF/WhatsApp/SMS","Personnalisation de marque","Site institutionnel","WhatsApp illimité gratuit","Account manager dédié"]',
  "isPopular" = false,
  "sortOrder" = 4,
  "updatedAt" = NOW()
WHERE "code" = 'NETWORK';

-- ─── 2. Création du plan "BILINGUAL" (add-on optionnel Article 4) ───
-- Le plan BILINGUAL est utilisé par SubscriptionLifecycleController pour
-- récupérer le prix de l'option bilingue. On l'insère s'il n'existe pas.

INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "updatedAt")
VALUES (
  gen_random_uuid(),
  'BILINGUAL',
  'Option bilingue FR/EN',
  'Add-on Article 4 — en supplément du plan',
  'Option bilingue FR/EN : interface et tous documents générés en français et anglais simultanément. Séparation des matières, examens et bulletins par langue. 50 000 FCFA/an en supplément du plan, quel que soit le plan choisi.',
  0,
  NULL,
  0,
  NULL,
  50000,
  NULL,
  50000,
  '["Interface FR/EN","Bulletins bilingues","Séparation matières FR/EN","Examens séparés par langue","50 000 FCFA/an en supplément"]',
  false,
  true,
  99,
  NOW()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "tagline" = EXCLUDED."tagline",
  "description" = EXCLUDED."description",
  "yearlyAmount" = EXCLUDED."yearlyAmount",
  "bilingualMonthly" = EXCLUDED."bilingualMonthly",
  "bilingualYearly" = EXCLUDED."bilingualYearly",
  "features" = EXCLUDED."features",
  "updatedAt" = NOW();

-- ─── 3. Mise à jour de la configuration pricing active ───
-- ⭐ Alignée sur le contrat Article 4 :
--   - Frais d'activation uniques : 300 000 FCFA (uniforme)
--   - Facturation annuelle uniquement (monthlyBasePrice = 0)
--   - Base annuelle (Helm Essentiel) : 50 000 FCFA/an
--   - Option bilingue : 50 000 FCFA/an (pas d'option mensuelle)
--   - Plus de réduction annuelle (annuel = seul cycle)

UPDATE "pricing_configs" SET
  "is_active" = false
WHERE "is_active" = true;

INSERT INTO "pricing_configs" (
  "id",
  "initial_subscription_fee",
  "multi_school_initial_discount_percent",
  "monthly_base_price",
  "yearly_base_price",
  "yearly_discount_percent",
  "bilingual_monthly_addon",
  "bilingual_yearly_addon",
  "school_additional_price",
  "trial_days",
  "grace_days",
  "reminder_days",
  "currency",
  "is_active",
  "version",
  "created_at",
  "created_by",
  "metadata"
)
VALUES (
  gen_random_uuid(),
  300000,        -- initial_subscription_fee : 300 000 FCFA (uniforme)
  10,            -- multi_school_initial_discount_percent : 10% (promo multi-écoles)
  0,             -- monthly_base_price : 0 (plus d'option mensuelle — contrat en annuel)
  50000,         -- yearly_base_price : 50 000 FCFA/an (base Helm Essentiel)
  0,             -- yearly_discount_percent : 0 (pas de remise, annuel = seul cycle)
  0,             -- bilingual_monthly_addon : 0 (plus d'option mensuelle)
  50000,         -- bilingual_yearly_addon : 50 000 FCFA/an (contrat Article 4)
  0,             -- school_additional_price : 0 (pricing par tranche d'élèves, pas par école)
  30,            -- trial_days : 30 jours d'essai
  15,            -- grace_days : 15 jours après échéance → suspension (contrat Article 4)
  '[15, 7, 3, 1]', -- reminder_days : J-15, J-7, J-3, J-1
  'XOF',
  true,
  (SELECT COALESCE(MAX("version"), 0) + 1 FROM "pricing_configs"),
  NOW(),
  'SYSTEM',
  '{"contractAligned": true, "contractArticle": "Article 4", "migration": "20260901000000_align_pricing_to_contract"}'::jsonb
);

-- ─── 4. Invalidation des group tiers obsolètes ───
-- Le contrat Article 4 stipule que le pricing dépend du nombre d'élèves
-- (tranches), pas du nombre d'écoles. On désactive les anciens group tiers.

UPDATE "pricing_group_tiers" SET
  "is_active" = false,
  "updated_at" = NOW(),
  "metadata" = COALESCE("metadata", '{}'::jsonb) || '{"deprecated": true, "reason": "Contrat Article 4 — pricing par tranche d''élèves, pas par nombre d''écoles"}'::jsonb
WHERE "is_active" = true;

-- ─── 5. Mise à jour des HelmSubscriptions existantes ───
-- Pour les tenants déjà enregistrés, on aligne les montants sur le contrat
-- (annualAmount, setupFee). On ne touche pas au plan (SEED/GROW/LEAD/NETWORK)
-- pour préserver la continuité de service.

UPDATE "HelmSubscription" SET
  "setupFee" = 300000,
  "billingCycle" = 'ANNUAL'
WHERE "billingCycle" = 'MONTHLY';

UPDATE "HelmSubscription" SET
  "annualAmount" = 50000
WHERE "plan" = 'SEED' AND ("annualAmount" IS NULL OR "annualAmount" = 0);

UPDATE "HelmSubscription" SET
  "annualAmount" = 75000
WHERE "plan" = 'GROW' AND ("annualAmount" IS NULL OR "annualAmount" = 0);

UPDATE "HelmSubscription" SET
  "annualAmount" = 100000
WHERE "plan" = 'LEAD' AND ("annualAmount" IS NULL OR "annualAmount" = 0);

UPDATE "HelmSubscription" SET
  "annualAmount" = 150000
WHERE "plan" = 'NETWORK' AND ("annualAmount" IS NULL OR "annualAmount" = 0);

-- ─── 6. Nettoyage de l'ancienne table subscription_plans (obsolète) ───
-- La table subscription_plans n'est plus utilisée comme source de pricing
-- (remplacée par pricing_plans). On désactive tous les anciens codes pour
-- éviter toute confusion (BASIC_MONTHLY, GROUP_*, etc.) — sans les supprimer
-- pour préserver l'historique.

-- Note : la table subscription_plans n'a pas de colonne is_active, on ne fait rien ici.
-- Le service SubscriptionPlanSeedService est désormais no-op.
