-- ============================================================================
-- MIGRATION : Ajout du système de Feature Flags par Tenant
-- ============================================================================
-- 
-- Cette migration ajoute le système de gestion des fonctionnalités
-- optionnelles (ex: BILINGUAL_TRACK) avec impact sur le pricing.
-- 
-- PRINCIPE :
-- - Chaque tenant peut activer/désactiver des features
-- - Impact sur la tarification et la facturation
-- - Audit complet des changements
-- - Extensible pour futures features
-- 
-- ============================================================================

-- 1. Créer la table tenant_features
CREATE TABLE IF NOT EXISTS tenant_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    feature_code VARCHAR(50) NOT NULL CHECK (feature_code IN ('BILINGUAL_TRACK')),
    status VARCHAR(20) NOT NULL DEFAULT 'DISABLED' CHECK (status IN ('DISABLED', 'ENABLED', 'PENDING')),
    enabled_at TIMESTAMPTZ,
    enabled_by UUID,
    disabled_at TIMESTAMPTZ,
    disabled_by UUID,
    metadata JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_tenant_features_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_tenant_features_enabled_by FOREIGN KEY (enabled_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tenant_features_disabled_by FOREIGN KEY (disabled_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_tenant_features_tenant_code UNIQUE (tenant_id, feature_code)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_code ON tenant_features(feature_code);
CREATE INDEX IF NOT EXISTS idx_tenant_features_status ON tenant_features(status);

-- 2. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_tenant_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE TRIGGER trigger_update_tenant_features_updated_at
    BEFORE UPDATE ON tenant_features
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_features_updated_at();

-- ============================================================================
-- NOTES IMPORTANTES :
-- ============================================================================
-- 
-- 1. Toutes les features sont DISABLED par défaut
--    → Aucune feature activée automatiquement
--    → Activation explicite requise
-- 
-- 2. L'activation/désactivation est journalisée
--    → Via audit_logs (géré par le service)
--    → Traçabilité complète
-- 
-- 3. Impact pricing calculé dynamiquement
--    → Via le service TenantFeaturesService
--    → Recalculé à chaque changement
-- 
-- 4. Extensible pour futures features
--    → Ajouter le code dans le CHECK constraint
--    → Ajouter la règle pricing dans FEATURE_PRICING
-- 
-- ============================================================================

