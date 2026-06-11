-- ============================================================================
-- SEED SQL - TENANT CSPEB-EVEIL D'AFRIQUE EDUCATION
-- ============================================================================
-- 
-- Script SQL pour créer le tenant CSPEB et les utilisateurs associés
-- Exécuter ce script dans pgAdmin 4 Query Tool sur la base de données academia_helm
-- 
-- IMPORTANT: Les mots de passe sont hashés avec bcrypt.
-- Pour générer les hashés, exécutez d'abord: npx ts-node prisma/generate-seed-cspeb-sql.ts
-- 
-- ============================================================================

-- ============================================================================
-- 1. CRÉER/VÉRIFIER LE PAYS BJ (BÉNIN)
-- ============================================================================

INSERT INTO countries (
  id, code, name, "code3", "numericCode", "currencyCode", "currencySymbol", 
  "phonePrefix", "flagEmoji", "isDefault", "isActive", "createdAt", "updatedAt"
)
VALUES (
  COALESCE((SELECT id FROM countries WHERE code = 'BJ'), 'country-bj-' || gen_random_uuid()::text),
  'BJ',
  'Bénin',
  'BEN',
  '204',
  'XOF',
  'CFA',
  '+229',
  '🇧🇯',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. CRÉER/METTRE À JOUR LE TENANT CSPEB
-- ============================================================================

DO $$
DECLARE
  v_country_id TEXT;
  v_tenant_id TEXT;
BEGIN
  -- Récupérer l'ID du pays BJ
  SELECT id INTO v_country_id FROM countries WHERE code = 'BJ';

  -- Vérifier si le tenant existe
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'cspeb-eveil-afrique' OR subdomain = 'cspeb';

  IF v_tenant_id IS NOT NULL THEN
    -- Mettre à jour le tenant existant
    UPDATE tenants
    SET 
      name = 'CSPEB-Eveil d''Afrique Education',
      slug = 'cspeb-eveil-afrique',
      subdomain = 'cspeb',
      "countryId" = v_country_id,
      type = 'SCHOOL',
      "subscriptionStatus" = 'ACTIVE_SUBSCRIBED',
      status = 'active',
      "subscriptionPlan" = 'premium',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = v_tenant_id;
    
    RAISE NOTICE 'Tenant CSPEB mis à jour: %', v_tenant_id;
  ELSE
    -- Créer le tenant
    v_tenant_id := 'tenant-cspeb-' || gen_random_uuid()::text;
    
    INSERT INTO tenants (
      id, name, slug, subdomain, "countryId", type, 
      "subscriptionStatus", status, "subscriptionPlan", 
      "createdAt", "updatedAt"
    )
    VALUES (
      v_tenant_id,
      'CSPEB-Eveil d''Afrique Education',
      'cspeb-eveil-afrique',
      'cspeb',
      v_country_id,
      'SCHOOL',
      'ACTIVE_SUBSCRIBED',
      'active',
      'premium',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Tenant CSPEB créé: %', v_tenant_id;
  END IF;
END $$;

-- ============================================================================
-- 3. CRÉER/METTRE À JOUR L'UTILISATEUR DIRECTEUR
-- ============================================================================
-- NOTE: Remplacez PLACEHOLDER_DIRECTOR_PASSWORD_HASH par le hash bcrypt réel
-- Pour générer le hash: exécutez le script generate-seed-cspeb-sql.ts

DO $$
DECLARE
  v_tenant_id TEXT;
  v_director_user_id TEXT;
  v_director_password_hash TEXT := 'PLACEHOLDER_DIRECTOR_PASSWORD_HASH';
BEGIN
  -- Récupérer l'ID du tenant CSPEB
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'cspeb-eveil-afrique';

  -- Vérifier si l'utilisateur directeur existe
  SELECT id INTO v_director_user_id FROM users WHERE email = 's.akpovitohou@gmail.com';

  IF v_director_user_id IS NOT NULL THEN
    -- Mettre à jour l'utilisateur directeur existant
    UPDATE users
    SET 
      "tenantId" = v_tenant_id,
      "passwordHash" = v_director_password_hash,
      "firstName" = 'Directeur',
      "lastName" = 'CSPEB',
      role = 'DIRECTOR',
      "isSuperAdmin" = false,
      status = 'active',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = v_director_user_id;
    
    RAISE NOTICE 'Utilisateur Directeur mis à jour: s.akpovitohou@gmail.com';
  ELSE
    -- Créer l'utilisateur directeur
    v_director_user_id := 'user-director-' || gen_random_uuid()::text;
    
    INSERT INTO users (
      id, email, "passwordHash", "firstName", "lastName", role,
      "tenantId", "isSuperAdmin", status, "createdAt", "updatedAt"
    )
    VALUES (
      v_director_user_id,
      's.akpovitohou@gmail.com',
      v_director_password_hash,
      'Directeur',
      'CSPEB',
      'DIRECTOR',
      v_tenant_id,
      false,
      'active',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Utilisateur Directeur créé: s.akpovitohou@gmail.com';
  END IF;
END $$;

-- ============================================================================
-- 4. CRÉER/METTRE À JOUR LE SUPER ADMIN
-- ============================================================================
-- NOTE: Remplacez PLACEHOLDER_SUPERADMIN_PASSWORD_HASH par le hash bcrypt réel
-- Pour générer le hash: exécutez le script generate-seed-cspeb-sql.ts

DO $$
DECLARE
  v_super_admin_user_id TEXT;
  v_super_admin_password_hash TEXT := 'PLACEHOLDER_SUPERADMIN_PASSWORD_HASH';
BEGIN
  -- Vérifier si le Super Admin existe
  SELECT id INTO v_super_admin_user_id FROM users WHERE email = 'yehiortech@gmail.com';

  IF v_super_admin_user_id IS NOT NULL THEN
    -- Mettre à jour le Super Admin existant
    UPDATE users
    SET 
      "tenantId" = NULL,
      "passwordHash" = v_super_admin_password_hash,
      "firstName" = 'Super',
      "lastName" = 'Admin',
      role = 'SUPER_DIRECTOR',
      "isSuperAdmin" = true,
      status = 'active',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = v_super_admin_user_id;
    
    RAISE NOTICE 'Super Admin mis à jour: yehiortech@gmail.com';
  ELSE
    -- Créer le Super Admin
    v_super_admin_user_id := 'user-superadmin-' || gen_random_uuid()::text;
    
    INSERT INTO users (
      id, email, "passwordHash", "firstName", "lastName", role,
      "tenantId", "isSuperAdmin", status, "createdAt", "updatedAt"
    )
    VALUES (
      v_super_admin_user_id,
      'yehiortech@gmail.com',
      v_super_admin_password_hash,
      'Super',
      'Admin',
      'SUPER_DIRECTOR',
      NULL,
      true,
      'active',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Super Admin créé: yehiortech@gmail.com';
  END IF;
END $$;

-- ============================================================================
-- 5. CRÉER L'ANNÉE SCOLAIRE ACTIVE (si elle n'existe pas)
-- ============================================================================

DO $$
DECLARE
  v_tenant_id TEXT;
  v_current_date DATE;
  v_current_month INTEGER;
  v_current_year INTEGER;
  v_academic_start_year INTEGER;
  v_academic_year_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_pre_entry_date DATE;
  v_academic_year_id TEXT;
BEGIN
  -- Récupérer l'ID du tenant CSPEB
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'cspeb-eveil-afrique';

  -- Calculer l'année scolaire courante
  -- L'année scolaire commence en septembre de l'année N et se termine en juillet de l'année N+1
  -- Pour l'année scolaire 2025-2026, on utilise 2025 comme année de début
  v_current_date := CURRENT_DATE;
  v_current_year := EXTRACT(YEAR FROM v_current_date)::INTEGER;
  v_current_month := EXTRACT(MONTH FROM v_current_date)::INTEGER;
  
  -- Définir l'année scolaire active comme 2025-2026
  -- Si nous sommes en janvier 2025 ou après, l'année scolaire active est 2025-2026
  -- Si nous sommes avant janvier 2025, utiliser l'année courante
  IF v_current_year >= 2025 THEN
    v_academic_start_year := 2025;
  ELSE
    -- Pour les années antérieures à 2025, utiliser la logique normale
    IF v_current_month < 9 THEN
      v_academic_start_year := v_current_year - 1;
    ELSE
      v_academic_start_year := v_current_year;
    END IF;
  END IF;
  
  v_academic_year_name := v_academic_start_year || '-' || (v_academic_start_year + 1);
  v_start_date := TO_DATE(v_academic_start_year || '-09-01', 'YYYY-MM-DD');
  v_end_date := TO_DATE((v_academic_start_year + 1) || '-07-31', 'YYYY-MM-DD');
  v_pre_entry_date := TO_DATE(v_academic_start_year || '-09-02', 'YYYY-MM-DD');

  -- Vérifier si l'année scolaire existe
  SELECT id INTO v_academic_year_id 
  FROM academic_years 
  WHERE "tenantId" = v_tenant_id AND name = v_academic_year_name;

  IF v_academic_year_id IS NULL THEN
    -- Créer l'année scolaire
    v_academic_year_id := 'academic-year-' || gen_random_uuid()::text;
    
    INSERT INTO academic_years (
      id, "tenantId", name, label, "startDate", "endDate", 
      "preEntryDate", "isActive", "isAutoGenerated", 
      "createdAt", "updatedAt"
    )
    VALUES (
      v_academic_year_id,
      v_tenant_id,
      v_academic_year_name,
      'Année scolaire ' || v_academic_year_name,
      v_start_date,
      v_end_date,
      v_pre_entry_date,
      true,
      false,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Année scolaire créée: %', v_academic_year_name;
  ELSE
    RAISE NOTICE 'Année scolaire déjà existante: %', v_academic_year_name;
  END IF;
END $$;

-- ============================================================================
-- RÉSUMÉ
-- ============================================================================

SELECT 
  '✅ Seed CSPEB terminé avec succès!' as message,
  (SELECT name FROM tenants WHERE slug = 'cspeb-eveil-afrique') as tenant_name,
  (SELECT COUNT(*) FROM users WHERE email = 's.akpovitohou@gmail.com') as director_created,
  (SELECT COUNT(*) FROM users WHERE email = 'yehiortech@gmail.com') as superadmin_created;
