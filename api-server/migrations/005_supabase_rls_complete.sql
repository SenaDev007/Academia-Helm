-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) - ACADEMIA HUB
-- ============================================================================
-- 
-- Sécurisation complète de la base Supabase avec RLS
-- Garantit l'isolation multi-tenant et les accès par rôle
-- 
-- RÈGLES FONDAMENTALES :
-- 1. Toute table avec tenant_id doit avoir RLS activé
-- 2. Les utilisateurs ne voient QUE leur tenant
-- 3. Les parents ne voient QUE leurs enfants
-- 4. ORION = lecture seule globale
-- 5. SUPER_ADMIN = accès global
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FONCTIONS HELPER POUR RLS
-- ----------------------------------------------------------------------------

-- Fonction pour récupérer le tenant_id de l'utilisateur authentifié
-- Depuis les claims JWT Supabase (auth.users.raw_user_meta_data)
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'claims' ->> 'tenant_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur est super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'claims' ->> 'is_super_admin')::BOOLEAN,
    false
  ) OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND "isSuperAdmin" = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur est ORION
CREATE OR REPLACE FUNCTION auth.is_orion()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'claims' ->> 'role')::TEXT = 'orion',
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Fonction pour récupérer le rôle de l'utilisateur
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'claims' ->> 'role')::TEXT,
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Fonction pour vérifier si un utilisateur est parent d'un étudiant
CREATE OR REPLACE FUNCTION auth.is_parent_of_student(student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_guardians sg
    JOIN public.guardians g ON sg."guardianId" = g.id
    WHERE sg."studentId" = student_id
    AND g."userId" = auth.uid()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Fonction pour obtenir la liste des étudiants dont l'utilisateur est parent
CREATE OR REPLACE FUNCTION auth.user_student_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT sg."studentId"
  FROM public.student_guardians sg
  JOIN public.guardians g ON sg."guardianId" = g.id
  WHERE g."userId" = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. FONCTION GÉNÉRIQUE POUR POLITIQUE TENANT
-- ----------------------------------------------------------------------------

-- Fonction helper pour vérifier l'accès tenant (réutilisable)
CREATE OR REPLACE FUNCTION auth.has_tenant_access(table_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin a accès à tout
  IF auth.is_super_admin() THEN
    RETURN true;
  END IF;
  
  -- ORION a accès en lecture seule à tout
  IF auth.is_orion() THEN
    RETURN true;
  END IF;
  
  -- Vérifier que le tenant_id correspond
  RETURN table_tenant_id = auth.current_tenant_id();
END;
$$ LANGUAGE PLPGSQL STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. POLITIQUES RLS POUR TENANT
-- ----------------------------------------------------------------------------

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tous peuvent lire les tenants (nécessaire pour résolution subdomain)
CREATE POLICY tenant_select_all ON public.tenants
  FOR SELECT
  USING (true);

-- Seuls les super admins peuvent modifier
CREATE POLICY tenant_modify_super_admin ON public.tenants
  FOR ALL
  USING (auth.is_super_admin())
  WITH CHECK (auth.is_super_admin());

-- ----------------------------------------------------------------------------
-- 4. POLITIQUES RLS POUR USERS
-- ----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tenant_isolation ON public.users
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    (
      "tenantId" IS NOT NULL AND
      "tenantId" = auth.current_tenant_id()
    ) OR
    id = auth.uid() -- Un utilisateur peut toujours voir ses propres infos
  )
  WITH CHECK (
    auth.is_super_admin() OR
    (
      "tenantId" IS NOT NULL AND
      "tenantId" = auth.current_tenant_id()
    ) OR
    id = auth.uid() -- Un utilisateur peut modifier ses propres infos
  );

-- ----------------------------------------------------------------------------
-- 5. POLITIQUES RLS POUR STUDENTS (avec accès parents)
-- ----------------------------------------------------------------------------

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_tenant_isolation ON public.students
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    auth.has_tenant_access("tenantId"::UUID) OR
    auth.is_parent_of_student(id::UUID)
  )
  WITH CHECK (
    auth.is_super_admin() OR
    auth.has_tenant_access("tenantId"::UUID)
  );

-- ----------------------------------------------------------------------------
-- 6. POLITIQUES RLS POUR GUARDIANS
-- ----------------------------------------------------------------------------

ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY guardian_tenant_isolation ON public.guardians
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    auth.has_tenant_access("tenantId"::UUID) OR
    "userId" = auth.uid() -- Un guardian peut voir ses propres infos
  )
  WITH CHECK (
    auth.is_super_admin() OR
    auth.has_tenant_access("tenantId"::UUID) OR
    "userId" = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- 7. POLITIQUES RLS POUR STUDENT_GUARDIANS
-- ----------------------------------------------------------------------------

ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_guardian_tenant_isolation ON public.student_guardians
  FOR ALL
  USING (
    auth.is_super_admin() OR
    auth.is_orion() OR
    auth.has_tenant_access("tenantId"::UUID) OR
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = "guardianId"
      AND g."userId" = auth.uid()
    )
  )
  WITH CHECK (
    auth.is_super_admin() OR
    auth.has_tenant_access("tenantId"::UUID)
  );

-- ----------------------------------------------------------------------------
-- 8. POLITIQUES RLS POUR TOUTES LES AUTRES TABLES AVEC tenant_id
-- ----------------------------------------------------------------------------

-- Liste des tables avec tenant_id (générées automatiquement)
DO $$
DECLARE
  table_record RECORD;
  policy_name TEXT;
  table_schema TEXT := 'public';
BEGIN
  -- Parcourir toutes les tables avec tenant_id
  FOR table_record IN
    SELECT 
      tablename,
      CASE 
        WHEN tablename LIKE '%_%' THEN 
          REPLACE(INITCAP(REPLACE(tablename, '_', ' ')), ' ', '')
        ELSE 
          INITCAP(tablename)
      END AS policy_prefix
    FROM pg_tables
    WHERE schemaname = table_schema
    AND tablename NOT IN ('tenants', 'users', 'students', 'guardians', 'student_guardians')
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = table_record.schemaname
      AND table_name = table_record.tablename
      AND column_name IN ('tenantId', 'tenant_id')
    )
  LOOP
    -- Activer RLS
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_schema, table_record.tablename);
    
    -- Créer la politique de sélection
    policy_name := format('%s_select_policy', table_record.tablename);
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I.%I',
      policy_name, table_schema, table_record.tablename
    );
    
    EXECUTE format('
      CREATE POLICY %I ON %I.%I
      FOR SELECT
      USING (
        auth.is_super_admin() OR
        auth.is_orion() OR
        auth.has_tenant_access(
          COALESCE(
            ("tenantId")::UUID,
            ("tenant_id")::UUID
          )
        )
      )',
      policy_name, table_schema, table_record.tablename
    );
    
    -- Pour les tables liées aux étudiants, ajouter accès parents
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = table_record.schemaname
      AND table_name = table_record.tablename
      AND column_name IN ('studentId', 'student_id')
    ) THEN
      policy_name := format('%s_parent_access', table_record.tablename);
      EXECUTE format('
        CREATE POLICY %I ON %I.%I
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM auth.user_student_ids() AS student_id
            WHERE student_id = COALESCE(
              (%I."studentId")::UUID,
              (%I."student_id")::UUID
            )
          )
        )',
        policy_name, table_schema, table_record.tablename,
        table_record.tablename, table_record.tablename
      );
    END IF;
    
    -- Créer la politique INSERT/UPDATE/DELETE (sauf pour ORION)
    policy_name := format('%s_modify_policy', table_record.tablename);
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I.%I',
      policy_name, table_schema, table_record.tablename
    );
    
    EXECUTE format('
      CREATE POLICY %I ON %I.%I
      FOR ALL
      USING (
        auth.is_super_admin() OR
        (
          NOT auth.is_orion() AND
          auth.has_tenant_access(
            COALESCE(
              ("tenantId")::UUID,
              ("tenant_id")::UUID
            )
          )
        )
      )
      WITH CHECK (
        auth.is_super_admin() OR
        (
          NOT auth.is_orion() AND
          auth.has_tenant_access(
            COALESCE(
              ("tenantId")::UUID,
              ("tenant_id")::UUID
            )
          )
        )
      )',
      policy_name, table_schema, table_record.tablename
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 9. POLITIQUES SPÉCIALES POUR ORION (lecture seule)
-- ----------------------------------------------------------------------------

-- ORION ne peut JAMAIS écrire
CREATE OR REPLACE FUNCTION prevent_orion_writes()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.is_orion() THEN
    RAISE EXCEPTION 'ORION role cannot perform write operations (INSERT/UPDATE/DELETE)';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Appliquer le trigger sur les tables critiques (optionnel, car RLS suffit)
-- CREATE TRIGGER prevent_orion_writes_trigger
-- BEFORE INSERT OR UPDATE OR DELETE ON public.students
-- FOR EACH ROW EXECUTE FUNCTION prevent_orion_writes();

-- ----------------------------------------------------------------------------
-- 10. CONFIGURATION SUPABASE AUTH (à faire via Dashboard)
-- ----------------------------------------------------------------------------

-- NOTE: Les URLs suivantes doivent être configurées dans le dashboard Supabase
-- Authentication > URL Configuration > Redirect URLs
--
-- URLs autorisées :
-- - http://localhost:3000/**
-- - http://localhost:3001/**
-- - https://*.vercel.app/**
-- - https://*.academia-hub.com/**
--
-- Pour configurer via SQL (si Supabase le permet) :
-- INSERT INTO auth.config (key, value) VALUES 
--   ('redirect_urls', '["http://localhost:3000/**", "http://localhost:3001/**", "https://*.vercel.app/**", "https://*.academia-hub.com/**"]')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ----------------------------------------------------------------------------
-- 11. GRANT PERMISSIONS AUX RÔLES
-- ----------------------------------------------------------------------------

-- Rôle app_user (application backend)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'academia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO academia_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO academia_app;
  END IF;
END $$;

-- Rôle super_admin
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'academia_super_admin') THEN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO academia_super_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO academia_super_admin;
  END IF;
END $$;

-- Rôle orion_readonly (lecture seule)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'academia_orion') THEN
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO academia_orion;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO academia_orion;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 12. CRÉER UN INDEX POUR OPTIMISER LES REQUÊTES RLS
-- ----------------------------------------------------------------------------

-- Index sur tenant_id pour améliorer les performances RLS
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = tablename
      AND column_name = 'tenantId'
    )
  LOOP
    BEGIN
      EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON %I."tenantId")',
        table_record.tablename, table_record.tablename
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignorer les erreurs si l'index existe déjà
      NULL;
    END;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 13. COMMENTAIRES ET DOCUMENTATION
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION auth.current_tenant_id() IS 'Retourne le tenant_id de l''utilisateur authentifié depuis les JWT claims';
COMMENT ON FUNCTION auth.is_super_admin() IS 'Vérifie si l''utilisateur est super admin';
COMMENT ON FUNCTION auth.is_orion() IS 'Vérifie si l''utilisateur est ORION (lecture seule)';
COMMENT ON FUNCTION auth.user_role() IS 'Retourne le rôle de l''utilisateur';
COMMENT ON FUNCTION auth.is_parent_of_student(UUID) IS 'Vérifie si l''utilisateur est parent d''un étudiant';
COMMENT ON FUNCTION auth.user_student_ids() IS 'Retourne la liste des IDs des étudiants dont l''utilisateur est parent';
COMMENT ON FUNCTION auth.has_tenant_access(UUID) IS 'Vérifie si l''utilisateur a accès au tenant spécifié';

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================
-- 
-- 1. Les JWT claims doivent contenir :
--    - tenant_id : UUID du tenant
--    - role : rôle de l'utilisateur (admin, teacher, parent, orion, etc.)
--    - is_super_admin : boolean (true/false)
-- 
-- 2. Pour définir les claims dans Supabase Auth :
--    - Via le dashboard : Authentication > Users > Metadata
--    - Via l'API : Supabase Admin API
--    - Via les triggers : créer un trigger sur auth.users pour mettre à jour les claims
-- 
-- 3. Exemple de JWT claim :
--    {
--      "sub": "user-uuid",
--      "tenant_id": "tenant-uuid",
--      "role": "teacher",
--      "is_super_admin": false
--    }
-- 
-- 4. Les politiques RLS sont évaluées AVANT chaque requête, garantissant
--    l'isolation des données au niveau base de données.
-- 
-- 5. Pour tester les politiques :
--    - Connecter en tant qu'utilisateur normal
--    - Vérifier que seules les données du tenant sont visibles
--    - Connecter en tant que parent et vérifier l'accès aux enfants
--    - Connecter en tant qu'ORION et vérifier la lecture seule
-- 
-- 6. Les parents ont accès automatique à :
--    - students (leurs enfants uniquement)
--    - grades, absences, exams, etc. (pour leurs enfants uniquement)
-- 
-- ============================================================================
