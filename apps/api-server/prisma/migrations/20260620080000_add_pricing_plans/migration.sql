-- ============================================================================
-- Migration: 20260620080000_add_pricing_plans
-- ============================================================================
-- Crée la table `pricing_plans` pour stocker les plans de tarification
-- d'Academia Helm de manière dynamique (gérables depuis le back-office).
--
-- 4 plans + 1 option bilingue :
--   - Helm Seed   (1-150 élèves)     — Initial 75 000, Mensuel 19 900
--   - Helm Grow   (151-400 élèves)   — Initial 100 000, Mensuel 24 900
--   - Helm Lead   (401-800 élèves)   — Initial 150 000, Mensuel 39 900
--   - Helm Network (800+ élèves)     — Initial 200 000, Mensuel sur devis
--   - Option Bilingue                — Mensuel 10 000, Annuel 100 000
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pricing_plans" (
    "id"                TEXT NOT NULL,
    "code"              TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "tagline"           TEXT,
    "description"       TEXT,
    "studentMin"        INTEGER NOT NULL DEFAULT 0,
    "studentMax"        INTEGER,
    "initialFee"        INTEGER NOT NULL DEFAULT 0,
    "monthlyAmount"     INTEGER,
    "yearlyAmount"      INTEGER,
    "bilingualMonthly"  INTEGER,
    "bilingualYearly"   INTEGER,
    "features"          TEXT,
    "isPopular"         BOOLEAN NOT NULL DEFAULT false,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_plans_code_key" UNIQUE ("code")
);

CREATE INDEX IF NOT EXISTS "pricing_plans_isActive_idx" ON "pricing_plans"("isActive");
CREATE INDEX IF NOT EXISTS "pricing_plans_sortOrder_idx" ON "pricing_plans"("sortOrder");

-- Seed initial des 4 plans + option bilingue
INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "updatedAt")
VALUES
    (gen_random_uuid(), 'SEED', 'Helm Seed', 'L''essentiel pour bien démarrer', 'Idéal pour les petites écoles qui démarrent leur transformation numérique.', 1, 150, 75000, 19900, 199000, 10000, 100000, '["Tous les modules principaux et supplémentaires inclus","Jusqu''à 150 élèves","Essai gratuit 30 jours","Support email","Sauvegarde quotidienne"]', false, true, 1, NOW()),
    (gen_random_uuid(), 'GROW', 'Helm Grow', 'Pilotez votre croissance', 'Pour les écoles en pleine expansion qui ont besoin d''outils avancés.', 151, 400, 100000, 24900, 249000, 10000, 100000, '["Tous les modules principaux et supplémentaires inclus","151 à 400 élèves","Essai gratuit 30 jours","Support prioritaire email + WhatsApp","Sauvegarde quotidienne","Tableaux de bord ORION"]', true, true, 2, NOW()),
    (gen_random_uuid(), 'LEAD', 'Helm Lead', 'Dominez votre marché', 'Pour les grandes écoles qui veulent un pilotage avancé et l''analytics.', 401, 800, 150000, 39900, 399000, 10000, 100000, '["Tous les modules principaux et supplémentaires inclus","401 à 800 élèves","Essai gratuit 30 jours","Support dédié 7j/7","Sauvegarde horaire","ORION Analytics complet","API d''intégration"]', false, true, 3, NOW()),
    (gen_random_uuid(), 'NETWORK', 'Helm Network', 'La catégorie multi-campus', 'Pour les réseaux d''écoles et les établissements multi-campus.', 801, NULL, 200000, NULL, NULL, 10000, 100000, '["Tous les modules principaux et supplémentaires inclus","Plus de 800 élèves","Essai gratuit 30 jours","Account manager dédié","Sauvegarde temps réel","ORION Analytics complet","API d''intégration","Déploiement multi-campus","Formation sur site"]', false, true, 4, NOW())
ON CONFLICT ("code") DO NOTHING;
