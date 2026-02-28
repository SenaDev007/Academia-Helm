/**
 * Script pour générer le fichier SQL seed CSPEB
 * Usage: npx ts-node prisma/generate-seed-cspeb-sql.ts
 */

import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

async function generateSql() {
  console.log('🔐 Hachage des mots de passe...\n');

  const directorPassword = 'C@ptain.Yehioracadhub2021';
  const superAdminPassword = 'C@ptain.Superadmin1';

  const directorPasswordHash = await bcrypt.hash(directorPassword, 10);
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

  console.log('✅ Mots de passe hashés\n');

  const sql = `-- ============================================================================
-- SEED SQL - TENANT CSPEB-EVEIL D'AFRIQUE EDUCATION
-- ============================================================================
-- 
-- Script SQL pour créer le tenant CSPEB et les utilisateurs associés
-- Exécuter ce script dans pgAdmin 4 Query Tool sur la base de données academia_helm
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

-- Vérifier si le tenant existe
DO \$\$
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
END \$\$;

-- ============================================================================
-- 3. CRÉER/METTRE À JOUR L'UTILISATEUR DIRECTEUR
-- ============================================================================

DO \$\$
DECLARE
  v_tenant_id TEXT;
  v_director_user_id TEXT;
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
      "passwordHash" = '${directorPasswordHash}',
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
      '${directorPasswordHash}',
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
END \$\$;

-- ============================================================================
-- 4. CRÉER/METTRE À JOUR LE SUPER ADMIN
-- ============================================================================

DO \$\$
DECLARE
  v_super_admin_user_id TEXT;
BEGIN
  -- Vérifier si le Super Admin existe
  SELECT id INTO v_super_admin_user_id FROM users WHERE email = 'yehiortech@gmail.com';

  IF v_super_admin_user_id IS NOT NULL THEN
    -- Mettre à jour le Super Admin existant
    UPDATE users
    SET 
      "tenantId" = NULL,
      "passwordHash" = '${superAdminPasswordHash}',
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
      '${superAdminPasswordHash}',
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
END \$\$;

-- ============================================================================
-- 5. CRÉER L'ANNÉE SCOLAIRE ACTIVE (si elle n'existe pas)
-- ============================================================================

DO \$\$
DECLARE
  v_tenant_id TEXT;
  v_current_year INTEGER;
  v_academic_year_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_pre_entry_date DATE;
  v_academic_year_id TEXT;
BEGIN
  -- Récupérer l'ID du tenant CSPEB
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'cspeb-eveil-afrique';

  -- Calculer l'année scolaire courante
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_academic_year_name := v_current_year || '-' || (v_current_year + 1);
  v_start_date := TO_DATE(v_current_year || '-09-01', 'YYYY-MM-DD');
  v_end_date := TO_DATE((v_current_year + 1) || '-07-31', 'YYYY-MM-DD');
  v_pre_entry_date := TO_DATE(v_current_year || '-09-02', 'YYYY-MM-DD');

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
END \$\$;

-- ============================================================================
-- RÉSUMÉ
-- ============================================================================

SELECT 
  '✅ Seed CSPEB terminé avec succès!' as message,
  (SELECT name FROM tenants WHERE slug = 'cspeb-eveil-afrique') as tenant_name,
  (SELECT COUNT(*) FROM users WHERE email = 's.akpovitohou@gmail.com') as director_created,
  (SELECT COUNT(*) FROM users WHERE email = 'yehiortech@gmail.com') as superadmin_created;

`;

  const outputPath = path.join(__dirname, 'seed-cspeb.sql');
  fs.writeFileSync(outputPath, sql, 'utf-8');

  console.log('✅ Fichier SQL généré:');
  console.log(`   ${outputPath}\n`);
  console.log('📝 Vous pouvez maintenant exécuter ce fichier dans pgAdmin 4 Query Tool');
  console.log('   - Ouvrez pgAdmin 4');
  console.log('   - Connectez-vous à la base de données academia_helm');
  console.log('   - Ouvrez Query Tool (outil de requête)');
  console.log('   - Chargez et exécutez le fichier: apps/api-server/prisma/seed-cspeb.sql\n');
}

generateSql()
  .catch((e) => {
    console.error('\n❌ Erreur:', e);
    process.exit(1);
  });
