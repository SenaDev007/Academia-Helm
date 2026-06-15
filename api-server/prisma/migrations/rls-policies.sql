-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - ACADEMIA HUB
-- ============================================================================
-- 
-- Ce fichier active RLS sur toutes les tables métier et crée les policies
-- pour garantir l'isolation multi-tenant.
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
-- 2. FONCTION HELPER : Récupérer le tenant_id de l'utilisateur
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS TEXT AS $$
  SELECT current_setting('app.current_tenant_id', TRUE);
$$ LANGUAGE SQL STABLE;

-- Fonction pour vérifier si l'utilisateur est super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('app.is_super_admin', TRUE))::BOOLEAN,
    false
  );
$$ LANGUAGE SQL STABLE;

-- Fonction pour vérifier si l'utilisateur est ORION
CREATE OR REPLACE FUNCTION auth.is_orion()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('app.is_orion', TRUE))::BOOLEAN,
    false
  );
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- 3. ACTIVER RLS SUR LES TABLES PRINCIPALES
-- ----------------------------------------------------------------------------

-- Tenant (lecture seule pour tous, modification uniquement par super admin)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON tenants
  FOR SELECT
  USING (true); -- Tous peuvent lire (nécessaire pour résolution subdomain)

CREATE POLICY tenant_modify ON tenants
  FOR ALL
  USING (auth.is_super_admin());

-- Users (isolation par tenant)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tenant_isolation ON users
  FOR ALL
  USING (
    auth.is_super_admin() OR
    ("tenantId" IS NOT NULL AND "tenantId" = auth.tenant_id())
  );

-- Students (isolation par tenant)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_tenant_isolation ON students
  FOR SELECT
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

CREATE POLICY student_parent_access ON students
  FOR SELECT
  USING (
    -- Un parent peut voir ses enfants via la table student_guardians
    EXISTS (
      SELECT 1 FROM student_guardians sg
      JOIN guardians g ON sg."guardianId" = g.id
      WHERE sg."studentId" = students.id
      -- TODO: Ajouter liaison User-Guardian via email ou autre identifiant
      AND g."tenantId" = auth.tenant_id()
    )
  );

-- AcademicYear (isolation par tenant)
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_year_tenant_isolation ON academic_years
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- SchoolLevel (isolation par tenant)
ALTER TABLE school_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_level_tenant_isolation ON school_levels
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Classes (isolation par tenant)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_tenant_isolation ON classes
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Teachers (isolation par tenant)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_tenant_isolation ON teachers
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Payments (isolation par tenant)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_tenant_isolation ON payments
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- StudentFees (isolation par tenant)
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_fee_tenant_isolation ON student_fees
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- FeeDefinitions (isolation par tenant)
ALTER TABLE fee_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY fee_definition_tenant_isolation ON fee_definitions
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Expenses (isolation par tenant)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_tenant_isolation ON expenses
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Exams (isolation par tenant)
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_tenant_isolation ON exams
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Grades (isolation par tenant)
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY grade_tenant_isolation ON grades
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Guardians (isolation par tenant + accès parent)
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY guardian_tenant_isolation ON guardians
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- StudentGuardians (isolation par tenant)
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_guardian_tenant_isolation ON student_guardians
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_guardians."studentId"
      AND s."tenantId" = auth.tenant_id()
    )
  );

-- Messages (isolation par tenant)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_tenant_isolation ON messages
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Staff (isolation par tenant)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_tenant_isolation ON staff
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Payrolls (isolation par tenant)
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_tenant_isolation ON payrolls
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- Meetings (isolation par tenant)
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_tenant_isolation ON meetings
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- AuditLogs (lecture seule, isolation par tenant)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_isolation ON audit_logs
  FOR SELECT
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    ("tenantId" = auth.tenant_id())
  );

-- ORION Tables (lecture seule globale pour ORION)
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE orion_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orion_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY orion_read_global ON kpi_definitions
  FOR SELECT
  USING (auth.is_super_admin() OR auth.is_orion() OR ("tenantId" = auth.tenant_id()));

CREATE POLICY orion_read_global ON kpi_snapshots
  FOR SELECT
  USING (auth.is_super_admin() OR auth.is_orion() OR ("tenantId" = auth.tenant_id()));

CREATE POLICY orion_read_global ON orion_alerts
  FOR SELECT
  USING (auth.is_super_admin() OR auth.is_orion() OR ("tenantId" = auth.tenant_id()));

CREATE POLICY orion_read_global ON orion_reports
  FOR SELECT
  USING (auth.is_super_admin() OR auth.is_orion() OR ("tenantId" = auth.tenant_id()));

-- ----------------------------------------------------------------------------
-- 4. CONFIGURER SUPABASE AUTH REDIRECTS
-- ----------------------------------------------------------------------------

-- Note: Ces URLs doivent être configurées dans le dashboard Supabase
-- Authentication > URL Configuration
-- 
-- Redirect URLs autorisées :
-- - http://localhost:3000/**
-- - http://localhost:3001/**
-- - https://*.vercel.app/**
-- - https://*.academia-hub.com/**

-- ----------------------------------------------------------------------------
-- 5. GRANT PERMISSIONS
-- ----------------------------------------------------------------------------

-- Accorder les permissions aux rôles
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO academia_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO academia_orion;
GRANT ALL ON ALL TABLES IN SCHEMA public TO academia_super_admin;

-- Permissions futures
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO academia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO academia_orion;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO academia_super_admin;

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================
-- 
-- 1. Les variables d'environnement app.current_tenant_id, app.current_user_id,
--    app.is_super_admin, app.is_orion doivent être définies par l'application
--    lors de chaque requête via SET LOCAL.
-- 
-- 2. Exemple d'utilisation dans l'application :
--    SET LOCAL app.current_tenant_id = 'tenant-uuid';
--    SET LOCAL app.current_user_id = 'user-uuid';
--    SET LOCAL app.is_super_admin = false;
--    SET LOCAL app.is_orion = false;
-- 
-- 3. Les policies RLS sont évaluées AVANT chaque requête, garantissant
--    l'isolation des données.
-- 
-- 4. Pour tester les policies, utiliser :
--    SET ROLE academia_app;
--    SET LOCAL app.current_tenant_id = 'test-tenant-id';
--    SELECT * FROM students; -- Ne retournera que les étudiants du tenant
-- 
-- ============================================================================
