-- ============================================================================
-- Migration 015 : Création de la table lab_settings pour les paramètres de laboratoire
-- ============================================================================
--
-- Objectif : Permettre au module Labo de persister ses paramètres (jusqu'à
-- présent, le frontend LaboratorySettings.tsx utilisait des mocks car il n'y
-- avait ni route GET /labs/settings ni table lab_settings).
--
-- Schéma identique à transport_settings / educast_settings : clé composite (tenantId, key).
-- ============================================================================

CREATE TABLE IF NOT EXISTS lab_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lab_settings_tenantId_key_key UNIQUE ("tenantId", key)
);

-- Index pour accélérer les requêtes par tenant
CREATE INDEX IF NOT EXISTS lab_settings_tenantId_idx ON lab_settings ("tenantId");

-- Commentaire pour documentation
COMMENT ON TABLE lab_settings IS 'Paramètres du module Laboratoire (par tenant). key→value pairs.';
