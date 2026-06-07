-- ============================================
-- ORION KPI TABLES - PostgreSQL Schema
-- ============================================
-- 
-- ORION lit UNIQUEMENT ces tables (ou vues matérialisées)
-- Aucune table métier brute
-- 
-- Contraintes :
-- - Isolation multi-tenant (tenant_id)
-- - Indexation pour performance
-- - Contraintes d'intégrité
-- ============================================

-- 1. KPI Financier Mensuel
CREATE TABLE IF NOT EXISTS kpi_financial_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period DATE NOT NULL,
  revenue_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue_expected NUMERIC(14,2),
  collection_rate NUMERIC(5,2) CHECK (collection_rate >= 0 AND collection_rate <= 100),
  variation_percent NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_kpi_financial_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_kpi_financial_tenant_period UNIQUE (tenant_id, period)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_kpi_financial_tenant ON kpi_financial_monthly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_financial_period ON kpi_financial_monthly(period);
CREATE INDEX IF NOT EXISTS idx_kpi_financial_tenant_period ON kpi_financial_monthly(tenant_id, period);

-- 2. KPI RH Mensuel
CREATE TABLE IF NOT EXISTS kpi_hr_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period DATE NOT NULL,
  teachers_total INT NOT NULL DEFAULT 0,
  teachers_absent INT NOT NULL DEFAULT 0,
  absence_rate NUMERIC(5,2) CHECK (absence_rate >= 0 AND absence_rate <= 100),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_kpi_hr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_kpi_hr_tenant_period UNIQUE (tenant_id, period),
  CONSTRAINT chk_kpi_hr_teachers CHECK (teachers_absent <= teachers_total)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_kpi_hr_tenant ON kpi_hr_monthly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_hr_period ON kpi_hr_monthly(period);
CREATE INDEX IF NOT EXISTS idx_kpi_hr_tenant_period ON kpi_hr_monthly(tenant_id, period);

-- 3. KPI Pédagogique par Trimestre
CREATE TABLE IF NOT EXISTS kpi_pedagogy_term (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  school_level_id UUID,
  term VARCHAR(20) NOT NULL, -- Ex: "T1", "T2", "T3", "2024-2025"
  success_rate NUMERIC(5,2) CHECK (success_rate >= 0 AND success_rate <= 100),
  average_score NUMERIC(5,2) CHECK (average_score >= 0),
  failure_rate NUMERIC(5,2) CHECK (failure_rate >= 0 AND failure_rate <= 100),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_kpi_pedagogy_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_kpi_pedagogy_tenant_level_term UNIQUE (tenant_id, school_level_id, term)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_kpi_pedagogy_tenant ON kpi_pedagogy_term(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_pedagogy_term ON kpi_pedagogy_term(term);
CREATE INDEX IF NOT EXISTS idx_kpi_pedagogy_tenant_term ON kpi_pedagogy_term(tenant_id, term);

-- 4. KPI Santé Système
CREATE TABLE IF NOT EXISTS kpi_system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period DATE NOT NULL,
  missing_kpi_count INT NOT NULL DEFAULT 0,
  alerts_open INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_kpi_system_health_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_kpi_system_health_tenant_period UNIQUE (tenant_id, period)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_kpi_system_health_tenant ON kpi_system_health(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_system_health_period ON kpi_system_health(period);
CREATE INDEX IF NOT EXISTS idx_kpi_system_health_tenant_period ON kpi_system_health(tenant_id, period);

-- 5. Historique des Analyses ORION
CREATE TABLE IF NOT EXISTS orion_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period DATE,
  summary TEXT NOT NULL,
  alerts JSONB,
  created_at TIMESTAMP DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_orion_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_orion_history_tenant ON orion_analysis_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orion_history_period ON orion_analysis_history(period);
CREATE INDEX IF NOT EXISTS idx_orion_history_tenant_period ON orion_analysis_history(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_orion_history_created_at ON orion_analysis_history(created_at DESC);

-- ============================================
-- VUES MATÉRIALISÉES (Optionnel)
-- ============================================
-- Pour améliorer les performances, créer des vues matérialisées
-- qui agrègent les données KPI

-- Vue matérialisée : KPI Direction Consolidé
CREATE MATERIALIZED VIEW IF NOT EXISTS v_orion_kpi_direction AS
SELECT
  f.tenant_id,
  f.period,
  f.revenue_collected AS total_revenue,
  f.collection_rate AS recovery_rate,
  f.variation_percent,
  h.teachers_total,
  h.absence_rate,
  (100 - h.absence_rate) AS teacher_presence_rate,
  s.missing_kpi_count,
  s.alerts_open
FROM kpi_financial_monthly f
LEFT JOIN kpi_hr_monthly h ON f.tenant_id = h.tenant_id AND f.period = h.period
LEFT JOIN kpi_system_health s ON f.tenant_id = s.tenant_id AND f.period = s.period;

-- Index sur la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_orion_kpi_direction_tenant_period 
ON v_orion_kpi_direction(tenant_id, period);

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE kpi_financial_monthly IS 'KPI financiers mensuels pour ORION - Lecture seule';
COMMENT ON TABLE kpi_hr_monthly IS 'KPI RH mensuels pour ORION - Lecture seule';
COMMENT ON TABLE kpi_pedagogy_term IS 'KPI pédagogiques par trimestre pour ORION - Lecture seule';
COMMENT ON TABLE kpi_system_health IS 'KPI santé système pour ORION - Lecture seule';
COMMENT ON TABLE orion_analysis_history IS 'Historique des analyses ORION - Journalisation complète';

COMMENT ON COLUMN kpi_financial_monthly.revenue_collected IS 'Recettes encaissées (FCFA)';
COMMENT ON COLUMN kpi_financial_monthly.revenue_expected IS 'Recettes attendues (FCFA)';
COMMENT ON COLUMN kpi_financial_monthly.collection_rate IS 'Taux de recouvrement (0-100)';
COMMENT ON COLUMN kpi_financial_monthly.variation_percent IS 'Variation en pourcentage par rapport à la période précédente';

COMMENT ON COLUMN kpi_hr_monthly.teachers_total IS 'Nombre total d''enseignants';
COMMENT ON COLUMN kpi_hr_monthly.teachers_absent IS 'Nombre d''enseignants absents';
COMMENT ON COLUMN kpi_hr_monthly.absence_rate IS 'Taux d''absence (0-100)';

COMMENT ON COLUMN kpi_pedagogy_term.success_rate IS 'Taux de réussite (0-100)';
COMMENT ON COLUMN kpi_pedagogy_term.average_score IS 'Note moyenne';
COMMENT ON COLUMN kpi_pedagogy_term.failure_rate IS 'Taux d''échec (0-100)';

COMMENT ON COLUMN kpi_system_health.missing_kpi_count IS 'Nombre de KPI manquants';
COMMENT ON COLUMN kpi_system_health.alerts_open IS 'Nombre d''alertes ouvertes';

