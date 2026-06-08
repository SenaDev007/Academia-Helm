/**
 * ============================================================================
 * MIGRATION : CRÉATION DES RÔLES POSTGRESQL
 * ============================================================================
 * 
 * Crée les 3 rôles distincts pour Academia Hub :
 * 1. academia_app      → SELECT / INSERT / UPDATE (API Backend)
 * 2. academia_admin    → Toutes permissions (Migrations)
 * 3. academia_orion    → SELECT ONLY (ORION - IA analytique)
 * 
 * IMPORTANT : ORION ne peut JAMAIS écrire dans la base.
 * ============================================================================
 */

-- ============================================================================
-- 1. CRÉER LES RÔLES
-- ============================================================================

-- Rôle pour l'application (API Backend)
CREATE ROLE academia_app WITH
  LOGIN
  PASSWORD 'CHANGE_ME_IN_PRODUCTION' -- ⚠️ À CHANGER EN PRODUCTION
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;

-- Rôle pour les migrations et administration
CREATE ROLE academia_admin WITH
  LOGIN
  PASSWORD 'CHANGE_ME_IN_PRODUCTION' -- ⚠️ À CHANGER EN PRODUCTION
  SUPERUSER
  CREATEDB
  CREATEROLE;

-- Rôle pour ORION (IA analytique) - READ ONLY
CREATE ROLE academia_orion WITH
  LOGIN
  PASSWORD 'CHANGE_ME_IN_PRODUCTION' -- ⚠️ À CHANGER EN PRODUCTION
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;

-- ============================================================================
-- 2. ACCORDER LES PERMISSIONS À academia_app
-- ============================================================================

-- Permissions sur le schéma public
GRANT USAGE ON SCHEMA public TO academia_app;
GRANT CREATE ON SCHEMA public TO academia_app;

-- Permissions sur toutes les tables existantes et futures
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO academia_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO academia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO academia_app;

-- Permissions sur les séquences (pour les IDs auto-incrémentés)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO academia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO academia_app;

-- Permissions sur les fonctions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO academia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO academia_app;

-- ============================================================================
-- 3. ACCORDER LES PERMISSIONS À academia_admin (TOUT)
-- ============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO academia_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO academia_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO academia_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO academia_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO academia_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO academia_admin;

-- ============================================================================
-- 4. ACCORDER LES PERMISSIONS À academia_orion (SELECT ONLY)
-- ============================================================================

-- ORION = LECTURE UNIQUEMENT
GRANT USAGE ON SCHEMA public TO academia_orion;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO academia_orion;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO academia_orion;

-- ORION peut lire les séquences (pour comprendre les IDs)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO academia_orion;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO academia_orion;

-- ORION peut exécuter des fonctions (pour les agrégations, analyses)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO academia_orion;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO academia_orion;

-- ============================================================================
-- 5. SÉCURITÉ : INTERDIRE LES ÉCRITURES À ORION
-- ============================================================================

-- Créer une fonction pour vérifier que ORION ne peut pas écrire
CREATE OR REPLACE FUNCTION prevent_orion_writes()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user = 'academia_orion' THEN
    RAISE EXCEPTION 'ORION role cannot perform write operations (INSERT/UPDATE/DELETE)';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note : Cette fonction sera attachée aux triggers sur les tables critiques
-- (voir migration 003_enforce_business_rules.sql)

-- ============================================================================
-- 6. COMMENTAIRES
-- ============================================================================

COMMENT ON ROLE academia_app IS 'Rôle pour l''API Backend - SELECT/INSERT/UPDATE uniquement';
COMMENT ON ROLE academia_admin IS 'Rôle pour les migrations et administration - Toutes permissions';
COMMENT ON ROLE academia_orion IS 'Rôle pour ORION (IA analytique) - SELECT ONLY - Ne peut jamais écrire';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

