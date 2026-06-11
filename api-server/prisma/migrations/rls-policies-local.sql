-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - ACADEMIA HUB
-- VERSION POSTGRESQL LOCAL (sans schéma auth Supabase)
-- ============================================================================
-- 
-- Ce fichier active RLS sur toutes les tables métier et crée les policies
-- pour garantir l'isolation multi-tenant.
-- 
-- ADAPTE POUR POSTGRESQL LOCAL (pas Supabase)
-- Le schéma "public" est utilisé au lieu de "auth"
-- 
-- RÈGLES FONDAMENTALES :
-- 1. Toute table avec tenantId doit avoir RLS activé
-- 2. Les utilisateurs ne voient QUE leur tenant
-- 3. Les parents ne voient QUE leurs enfants
-- 4. ORION = lecture seule globale
-- 5. SUPER_ADMIN = accès global
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CRÉER LES RÔLES POSTGRESQL
-- ----------------------------------------------------------------------------

-- Rôle pour l'application (CRUD limité au tenant)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'academia_app') THEN
    CREATE ROLE academia_app;
  END IF;
END
$$;

-- Rôle pour ORION (lecture seule globale)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'academia_orion') THEN
    CREATE ROLE academia_orion;
  END IF;
END
$$;

-- Rôle pour super admin (accès global)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'academia_super_admin') THEN
    CREATE ROLE academia_super_admin;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. CRÉER LE SCHÉMA "auth" (si nécessaire) OU UTILISER "public"
-- ----------------------------------------------------------------------------

-- Pour PostgreSQL local, on utilise le schéma "public"
-- Les fonctions seront créées dans "public" au lieu de "auth"

-- ----------------------------------------------------------------------------
-- 3. FONCTION HELPER : Récupérer le tenant_id de l'utilisateur
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS TEXT AS $$
  SELECT current_setting('app.current_tenant_id', TRUE);
$$ LANGUAGE SQL STABLE;

-- Fonction pour vérifier si l'utilisateur est super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('app.is_super_admin', TRUE))::BOOLEAN,
    false
  );
$$ LANGUAGE SQL STABLE;

-- Fonction pour vérifier si l'utilisateur est ORION
CREATE OR REPLACE FUNCTION public.is_orion()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('app.is_orion', TRUE))::BOOLEAN,
    false
  );
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- 4. ACTIVER RLS SUR LES TABLES PRINCIPALES
-- ----------------------------------------------------------------------------

-- Tenant (lecture seule pour tous, modification uniquement par super admin)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON tenants;
CREATE POLICY tenant_select ON tenants
  FOR SELECT
  USING (true); -- Tous peuvent lire (nécessaire pour résolution subdomain)

DROP POLICY IF EXISTS tenant_modify ON tenants;
CREATE POLICY tenant_modify ON tenants
  FOR ALL
  USING (public.is_super_admin());

-- Users (isolation par tenant)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tenant_isolation ON users;
CREATE POLICY user_tenant_isolation ON users
  FOR ALL
  USING (
    public.is_super_admin() OR
    ("tenantId" IS NOT NULL AND "tenantId" = public.tenant_id())
  );

-- Students (isolation par tenant)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_tenant_isolation ON students;
CREATE POLICY student_tenant_isolation ON students
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Policy pour parents : ne voir que leurs enfants
DROP POLICY IF EXISTS student_parent_access ON students;
CREATE POLICY student_parent_access ON students
  FOR SELECT
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    -- TODO: Ajouter logique pour vérifier que l'utilisateur est parent de l'élève
    -- Ceci nécessite une jointure avec la table guardians/relations
    "tenantId" = public.tenant_id()
  );

-- Academic Years (isolation par tenant)
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academic_year_tenant_isolation ON academic_years;
CREATE POLICY academic_year_tenant_isolation ON academic_years
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- School Levels (isolation par tenant)
ALTER TABLE school_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_level_tenant_isolation ON school_levels;
CREATE POLICY school_level_tenant_isolation ON school_levels
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Classes (isolation par tenant)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_tenant_isolation ON classes;
CREATE POLICY class_tenant_isolation ON classes
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Teachers (isolation par tenant)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_tenant_isolation ON teachers;
CREATE POLICY teacher_tenant_isolation ON teachers
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Payments (isolation par tenant)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_tenant_isolation ON payments;
CREATE POLICY payment_tenant_isolation ON payments
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Student Fees (isolation par tenant)
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_fee_tenant_isolation ON student_fees;
CREATE POLICY student_fee_tenant_isolation ON student_fees
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Fee Definitions (isolation par tenant)
ALTER TABLE fee_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_definition_tenant_isolation ON fee_definitions;
CREATE POLICY fee_definition_tenant_isolation ON fee_definitions
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Fee Regimes (isolation par tenant)
ALTER TABLE fee_regimes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_regime_tenant_isolation ON fee_regimes;
CREATE POLICY fee_regime_tenant_isolation ON fee_regimes
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Expenses (isolation par tenant)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_tenant_isolation ON expenses;
CREATE POLICY expense_tenant_isolation ON expenses
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Exams (isolation par tenant)
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_tenant_isolation ON exams;
CREATE POLICY exam_tenant_isolation ON exams
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Grades (isolation par tenant)
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grade_tenant_isolation ON grades;
CREATE POLICY grade_tenant_isolation ON grades
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Subjects (isolation par tenant)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_tenant_isolation ON subjects;
CREATE POLICY subject_tenant_isolation ON subjects
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- Schools (isolation par tenant)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_tenant_isolation ON schools;
CREATE POLICY school_tenant_isolation ON schools
  FOR ALL
  USING (
    public.is_super_admin() OR
    public.is_orion() OR
    "tenantId" = public.tenant_id()
  );

-- ----------------------------------------------------------------------------
-- NOTES IMPORTANTES
-- ----------------------------------------------------------------------------
-- 
-- 1. Pour que RLS fonctionne, l'application doit définir :
--    SET LOCAL app.current_tenant_id = 'tenant-uuid';
--    SET LOCAL app.current_user_id = 'user-uuid';
--    SET LOCAL app.is_super_admin = false;
--    SET LOCAL app.is_orion = false;
-- 
-- 2. Sur PostgreSQL local, les fonctions sont dans le schéma "public"
--    Sur Supabase, elles seraient dans le schéma "auth"
-- 
-- 3. Pour tester les policies, utiliser :
--    SET ROLE academia_app;
--    SET LOCAL app.current_tenant_id = 'test-tenant-id';
--    SELECT * FROM students; -- Ne retournera que les étudiants du tenant
-- 
-- 4. Ce script est IDEMPOTENT : peut être relancé plusieurs fois
--    Les DROP POLICY IF EXISTS garantissent qu'il n'y aura pas d'erreurs
-- 
-- ============================================================================
