-- ============================================================================
-- Migration: Modèle métier Cantine — Capital, Vente journalière, Dispatching, Bilan annuel
-- ============================================================================
-- Implémente le modèle métier de la cantine scolaire au Bénin :
--
--   1. CANTINE_FUND (Capital) — le promoteur décaisse un capital pour démarrer
--      la cantine. Ce capital est remis à la cantinière en début d'année.
--
--   2. CANTINE_DAILY_SALE (Vente journalière) — chaque jour, la cantinière
--      (ou un vendeur délégué) enregistre les repas vendus + la recette totale.
--
--   3. CANTINE_DAILY_DISPATCH (Dispatching journalier) — à partir de la
--      recette du jour, on sépare :
--      - Achat des articles pour le lendemain (réapprovisionnement)
--      - Pourcentage/montant qui revient à l'école
--      - Pourcentage/montant qui revient au vendeur délégué
--      - Le reste = épargne / bénéfice journalier
--
--   4. CANTINE_ANNUAL_REPORT (Bilan annuel) — à la fin de l'année :
--      - Capital récupéré (capital initial - pertes)
--      - Bénéfice total (somme des bénéfices journaliers)
--      - Pourcentage de la cantinière (sur le bénéfice)
--      - Total versé à l'école
--      - Total versé au vendeur
--
--   5. CANTINE_PURCHASE (Achats) — enregistre les achats journaliers
--      (par la cantinière elle-même ou via un fournisseur).
-- ============================================================================

-- ═════════════════════════════════════════════════════════════════
--  1. CANTINE_FUND — Capital de la cantine
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "canteen_funds" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "initialCapital"  DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "currentBalance"  DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "fundDate"        DATE NOT NULL DEFAULT CURRENT_DATE,
    "notes"           TEXT,
    "createdBy"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_funds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_funds_tenant_year_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "canteen_funds_academic_year_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "canteen_funds_tenant_year_idx"
  ON "canteen_funds" ("tenantId", "academicYearId");

-- ═════════════════════════════════════════════════════════════════
--  2. CANTINE_DAILY_SALE — Vente journalière
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "canteen_daily_sales" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "saleDate"        DATE NOT NULL,
    "mealsSold"       INTEGER NOT NULL DEFAULT 0,
    "pricePerMeal"    DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "totalRevenue"    DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "mealsPlanned"    INTEGER NOT NULL DEFAULT 0,
    "mealsWasted"     INTEGER NOT NULL DEFAULT 0,
    "sellerType"      TEXT NOT NULL DEFAULT 'CANTINIERE',
    "sellerName"      TEXT,
    "notes"           TEXT,
    "createdBy"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_daily_sales_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_daily_sales_tenant_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "canteen_daily_sales_academic_year_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "canteen_daily_sales_tenant_date_idx"
  ON "canteen_daily_sales" ("tenantId", "saleDate");
CREATE UNIQUE INDEX IF NOT EXISTS "canteen_daily_sales_tenant_date_unique_idx"
  ON "canteen_daily_sales" ("tenantId", "academicYearId", "saleDate");

-- ═════════════════════════════════════════════════════════════════
--  3. CANTINE_DAILY_DISPATCH — Dispatching journalier
--    Répartition de la recette du jour
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "canteen_daily_dispatches" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "saleId"          TEXT NOT NULL,
    "dispatchDate"    DATE NOT NULL,
    "totalRevenue"    DECIMAL(14, 2) NOT NULL DEFAULT 0,
    -- Réapprovisionnement (achats pour le lendemain)
    "restockAmount"   DECIMAL(14, 2) NOT NULL DEFAULT 0,
    -- Part de l'école (pourcentage ou montant fixe)
    "schoolAmount"    DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "schoolRate"      DECIMAL(5, 2) NOT NULL DEFAULT 0,
    -- Part du vendeur délégué (si différent de la cantinière)
    "sellerAmount"    DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "sellerRate"      DECIMAL(5, 2) NOT NULL DEFAULT 0,
    -- Épargne / bénéfice journalier (le reste)
    "savingsAmount"   DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "notes"           TEXT,
    "createdBy"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_daily_dispatches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_daily_dispatches_tenant_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "canteen_daily_dispatches_sale_fkey"
      FOREIGN KEY ("saleId") REFERENCES "canteen_daily_sales"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "canteen_daily_dispatches_sale_unique_idx"
  ON "canteen_daily_dispatches" ("saleId");

-- ═════════════════════════════════════════════════════════════════
--  4. CANTINE_PURCHASE — Achats journaliers
--    Enregistré par la cantinière (avec ou sans fournisseur)
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "canteen_purchases" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "purchaseDate"    DATE NOT NULL,
    "items"           JSONB NOT NULL DEFAULT '[]',
    "totalAmount"     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "supplierId"      TEXT,
    "supplierName"    TEXT,
    "paymentMode"     TEXT NOT NULL DEFAULT 'CASH',
    "purchasedBy"     TEXT NOT NULL DEFAULT 'CANTINIERE',
    "receiptImageUrl" TEXT,
    "notes"           TEXT,
    "createdBy"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_purchases_tenant_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "canteen_purchases_tenant_date_idx"
  ON "canteen_purchases" ("tenantId", "purchaseDate");

-- ═════════════════════════════════════════════════════════════════
--  5. CANTINE_ANNUAL_REPORT — Bilan annuel
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "canteen_annual_reports" (
    "id"                    TEXT NOT NULL,
    "tenantId"              TEXT NOT NULL,
    "academicYearId"        TEXT NOT NULL,
    "initialCapital"        DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "totalRevenue"          DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "totalPurchases"        DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "totalSchoolAmount"     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "totalSellerAmount"     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "totalSavings"          DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "capitalRecovered"      DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "totalProfit"           DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "cantiniereRate"        DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "cantiniereAmount"      DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "mealsSoldTotal"        INTEGER NOT NULL DEFAULT 0,
    "mealsWastedTotal"      INTEGER NOT NULL DEFAULT 0,
    "status"                TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt"              TIMESTAMP(3),
    "notes"                 TEXT,
    "createdBy"             TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_annual_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_annual_reports_tenant_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "canteen_annual_reports_academic_year_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "canteen_annual_reports_tenant_year_idx"
  ON "canteen_annual_reports" ("tenantId", "academicYearId");

-- ═════════════════════════════════════════════════════════════════
--  6. CANTINE_SETTINGS — Étendre les settings existants
--    Ajouter les paramètres du modèle métier
-- ═════════════════════════════════════════════════════════════════
-- Note: les settings cantine sont stockés dans la table existante
-- canteen_settings (ou school_settings) — on ajoute des colonnes
-- pour les taux de dispatching par défaut.
CREATE TABLE IF NOT EXISTS "canteen_business_settings" (
    "id"                      TEXT NOT NULL,
    "tenantId"                TEXT NOT NULL,
    "academicYearId"          TEXT NOT NULL,
    "schoolRate"              DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "sellerRate"              DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "cantiniereRate"          DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "pricePerMealDefault"     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "cantiniereName"          TEXT,
    "sellerName"              TEXT,
    "sellerType"              TEXT NOT NULL DEFAULT 'CANTINIERE',
    "autoDispatch"            BOOLEAN NOT NULL DEFAULT false,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_business_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_business_settings_tenant_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "canteen_business_settings_academic_year_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "canteen_business_settings_tenant_year_idx"
  ON "canteen_business_settings" ("tenantId", "academicYearId");
