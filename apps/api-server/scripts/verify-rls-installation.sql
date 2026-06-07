-- ============================================================================
-- VÉRIFICATION RLS - ACADEMIA HUB
-- ============================================================================
-- 
-- Ce script vérifie que RLS est correctement configuré :
-- 1. RLS activé sur les tables principales
-- 2. Fonctions helper créées
-- 3. Policies créées
-- 4. Test d'isolation multi-tenant
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VÉRIFIER QUE RLS EST ACTIVÉ SUR LES TABLES PRINCIPALES
-- ----------------------------------------------------------------------------

SELECT 
    'RLS Activé sur Tables Principales' as verification,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'tenants', 
    'users', 
    'students', 
    'academic_years', 
    'school_levels',
    'classes',
    'teachers',
    'payments',
    'student_fees',
    'fee_definitions',
    'fee_regimes',
    'expenses',
    'exams',
    'grades',
    'subjects',
    'schools'
)
ORDER BY tablename;

-- Résumé : Compter les tables avec RLS activé
SELECT 
    'Résumé RLS' as verification,
    COUNT(*) as tables_with_rls,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' 
     AND tablename IN ('tenants', 'users', 'students', 'academic_years', 
                       'school_levels', 'classes', 'teachers', 'payments',
                       'student_fees', 'fee_definitions', 'fee_regimes',
                       'expenses', 'exams', 'grades', 'subjects', 'schools')
    ) as total_tables_checked
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
AND tablename IN (
    'tenants', 'users', 'students', 'academic_years', 'school_levels',
    'classes', 'teachers', 'payments', 'student_fees', 'fee_definitions',
    'fee_regimes', 'expenses', 'exams', 'grades', 'subjects', 'schools'
);

-- ----------------------------------------------------------------------------
-- 2. VÉRIFIER QUE LES FONCTIONS HELPER SONT CRÉÉES
-- ----------------------------------------------------------------------------

SELECT 
    'Fonctions Helper' as verification,
    p.proname as function_name,
    n.nspname as schema_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
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
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname
LIMIT 25;

-- Résumé : Compter les policies par table
SELECT 
    'Résumé Policies' as verification,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

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
-- 5. TEST D'ISOLATION MULTI-TENANT (Exemple)
-- ----------------------------------------------------------------------------
-- Note: Ce test nécessite des données dans la base

-- Récupérer les tenants existants
SELECT 
    'Tenants Disponibles' as verification,
    id,
    name,
    slug
FROM tenants
LIMIT 5;

-- Test : Vérifier que la fonction tenant_id() fonctionne
-- (Ceci nécessitera SET LOCAL app.current_tenant_id pour fonctionner en production)
SELECT 
    'Test Fonction tenant_id()' as verification,
    public.tenant_id() as current_tenant_id,
    CASE 
        WHEN public.tenant_id() IS NULL THEN 'ATTENTION: Pas de tenant_id défini (normal si pas de SET LOCAL)'
        ELSE 'OK: tenant_id défini'
    END as status;

-- ----------------------------------------------------------------------------
-- 6. RÉSUMÉ FINAL
-- ----------------------------------------------------------------------------

SELECT 
    '=== RÉSUMÉ VÉRIFICATION RLS ===' as verification;

SELECT 
    'Tables avec RLS' as item,
    COUNT(*)::text as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
AND tablename IN ('tenants', 'users', 'students', 'academic_years', 'school_levels');

SELECT 
    'Fonctions Helper' as item,
    COUNT(*)::text as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('tenant_id', 'is_super_admin', 'is_orion');

SELECT 
    'Policies RLS' as item,
    COUNT(*)::text as status
FROM pg_policies 
WHERE schemaname = 'public';

SELECT 
    'Rôles PostgreSQL' as item,
    COUNT(*)::text as status
FROM pg_roles 
WHERE rolname IN ('academia_app', 'academia_orion', 'academia_super_admin');
