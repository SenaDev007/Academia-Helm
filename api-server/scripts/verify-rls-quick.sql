-- ============================================================================
-- VÉRIFICATION RLS RAPIDE - ACADEMIA HUB
-- ============================================================================
-- 
-- Script simplifié pour vérifier RLS étape par étape
-- Exécutez chaque section séparément si nécessaire
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VÉRIFIER QUE RLS EST ACTIVÉ SUR LES TABLES PRINCIPALES
-- ----------------------------------------------------------------------------

SELECT 
    'RLS Activé sur Tables' as verification,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'tenants', 'users', 'students', 'academic_years', 'school_levels'
)
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- 2. VÉRIFIER QUE LES FONCTIONS HELPER SONT CRÉÉES
-- ----------------------------------------------------------------------------

SELECT 
    'Fonctions Helper' as verification,
    p.proname as function_name,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('tenant_id', 'is_super_admin', 'is_orion')
ORDER BY p.proname;

-- ----------------------------------------------------------------------------
-- 3. VÉRIFIER QUE LES POLICIES SONT CRÉÉES
-- ----------------------------------------------------------------------------

SELECT 
    'Policies RLS' as verification,
    tablename,
    policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 4. VÉRIFIER LES RÔLES POSTGRESQL
-- ----------------------------------------------------------------------------

SELECT 
    'Rôles PostgreSQL' as verification,
    rolname as role_name
FROM pg_roles 
WHERE rolname IN ('academia_app', 'academia_orion', 'academia_super_admin')
ORDER BY rolname;

-- ----------------------------------------------------------------------------
-- 5. RÉSUMÉ (compteurs)
-- ----------------------------------------------------------------------------

-- Tables avec RLS
SELECT 
    'Tables avec RLS' as item,
    COUNT(*)::text as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
AND tablename IN ('tenants', 'users', 'students', 'academic_years', 'school_levels');

-- Fonctions Helper
SELECT 
    'Fonctions Helper' as item,
    COUNT(*)::text as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('tenant_id', 'is_super_admin', 'is_orion');

-- Policies RLS
SELECT 
    'Policies RLS' as item,
    COUNT(*)::text as status
FROM pg_policies 
WHERE schemaname = 'public';

-- Rôles PostgreSQL
SELECT 
    'Rôles PostgreSQL' as item,
    COUNT(*)::text as status
FROM pg_roles 
WHERE rolname IN ('academia_app', 'academia_orion', 'academia_super_admin');
