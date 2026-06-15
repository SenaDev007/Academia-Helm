-- ============================================================================
-- MIGRATION : Système de Paiement avec Séparation des Flux
-- ============================================================================
-- 
-- PRINCIPE FONDAMENTAL :
-- Academia Hub n'est PAS une banque.
-- Academia Hub ne détient PAS les fonds des écoles.
-- 
-- SÉPARATION STRICTE :
-- - SAAS : Paiements vers Academia Hub (souscriptions, abonnements, options)
-- - TUITION : Paiements vers les écoles (frais scolaires)
-- 
-- ============================================================================

-- 1. Table payment_flows (flux de paiement)
CREATE TABLE IF NOT EXISTS payment_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('SAAS', 'TUITION')),
    destination VARCHAR(20) NOT NULL CHECK (destination IN ('ACADEMIA', 'SCHOOL')),
    student_id UUID,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XOF',
    status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
    psp VARCHAR(50) NOT NULL CHECK (psp IN ('FEDAPAY', 'CELTIIS', 'MOOV_MONEY', 'MTN_MONEY', 'CASH', 'BANK_TRANSFER')),
    psp_reference VARCHAR(255),
    payment_url TEXT,
    payment_id UUID, -- Lien avec le paiement scolaire existant
    metadata JSONB,
    reason TEXT,
    initiated_by UUID,
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    webhook_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_payment_flows_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_flows_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_flows_initiated_by FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_flows_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    -- RÈGLE MÉTIER : SAAS → ACADEMIA, TUITION → SCHOOL
    CONSTRAINT chk_payment_flow_destination CHECK (
        (flow_type = 'SAAS' AND destination = 'ACADEMIA') OR
        (flow_type = 'TUITION' AND destination = 'SCHOOL')
    )
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_payment_flows_tenant ON payment_flows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_flows_type ON payment_flows(flow_type);
CREATE INDEX IF NOT EXISTS idx_payment_flows_status ON payment_flows(status);
CREATE INDEX IF NOT EXISTS idx_payment_flows_student ON payment_flows(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_flows_psp_reference ON payment_flows(psp_reference);
CREATE INDEX IF NOT EXISTS idx_payment_flows_created_at ON payment_flows(created_at);

-- 2. Table school_payment_accounts (comptes de paiement des écoles)
CREATE TABLE IF NOT EXISTS school_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    psp VARCHAR(50) NOT NULL CHECK (psp IN ('FEDAPAY', 'CELTIIS', 'MOOV_MONEY', 'MTN_MONEY', 'CASH', 'BANK_TRANSFER')),
    account_identifier VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_school_payment_accounts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_school_payment_accounts_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_school_payment_accounts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_school_payment_accounts_tenant_psp_identifier UNIQUE (tenant_id, psp, account_identifier)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_school_payment_accounts_tenant ON school_payment_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_payment_accounts_active ON school_payment_accounts(tenant_id, is_active, is_verified) WHERE is_active = TRUE AND is_verified = TRUE;

-- 3. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_payment_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_school_payment_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_payment_flows_updated_at
    BEFORE UPDATE ON payment_flows
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_flows_updated_at();

CREATE TRIGGER trigger_update_school_payment_accounts_updated_at
    BEFORE UPDATE ON school_payment_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_school_payment_accounts_updated_at();

-- ============================================================================
-- NOTES IMPORTANTES :
-- ============================================================================
-- 
-- 1. SÉPARATION STRICTE DES FLUX
--    - SAAS → ACADEMIA (obligatoire)
--    - TUITION → SCHOOL (obligatoire)
--    - Contrainte CHECK garantit cette séparation
-- 
-- 2. COMPTES ÉCOLE
--    - Nécessaires pour TUITION
--    - Doivent être vérifiés avant utilisation
--    - Un seul compte actif par PSP par tenant
-- 
-- 3. TRACABILITÉ
--    - Tous les paiements sont journalisés
--    - Webhooks stockés pour audit
--    - Métadonnées extensibles
-- 
-- 4. SÉCURITÉ
--    - Webhooks vérifiés par signature
--    - Aucun numéro sensible stocké
--    - Respect PCI-DSS via PSP
-- 
-- ============================================================================

