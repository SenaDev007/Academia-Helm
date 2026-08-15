-- ============================================================================
-- Migration: 20260815140000_create_staff_accreditations
-- ============================================================================
-- Table pour les accréditations supplémentaires accordées par le promoteur.
-- Le promoteur peut donner accès à des modules supplémentaires à un staff
-- (ex: donner Finance au Directeur, donner RH au Secrétaire).
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_accreditations (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  module TEXT NOT NULL,              -- ex: 'finance', 'hr', 'communication', 'settings'
  granted_by TEXT NOT NULL,          -- userId du promoteur qui a accordé
  granted_at TIMESTAMP(3) DEFAULT now(),
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT now(),
  "updatedAt" TIMESTAMP(3) DEFAULT now(),
  UNIQUE ("tenantId", "staffId", module)
);

CREATE INDEX IF NOT EXISTS idx_staff_accreditations_staff ON staff_accreditations ("staffId");
CREATE INDEX IF NOT EXISTS idx_staff_accreditations_tenant ON staff_accreditations ("tenantId");
