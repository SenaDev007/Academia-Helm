-- ============================================================================
-- CONFIGURATION SUPABASE AUTH - ACADEMIA HUB
-- ============================================================================
-- 
-- Configuration des URLs de redirection et des paramètres d'authentification
-- pour Supabase
-- 
-- IMPORTANT : Certaines configurations doivent être faites via le Dashboard
-- Supabase. Ce fichier contient les configurations possibles via SQL.
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONFIGURER LES URLS DE REDIRECTION (via Dashboard recommandé)
-- ----------------------------------------------------------------------------

-- NOTE: Dans le Dashboard Supabase :
-- Authentication > URL Configuration > Redirect URLs
-- 
-- Ajouter les URLs suivantes :
-- - http://localhost:3000/**
-- - http://localhost:3001/**
-- - https://*.vercel.app/**
-- - https://*.academia-hub.com/**
--
-- Pour l'environnement de développement local :
-- - Site URL: http://localhost:3000
--
-- Pour l'environnement de production :
-- - Site URL: https://app.academia-hub.com

-- ----------------------------------------------------------------------------
-- 2. CRÉER UN TRIGGER POUR METTRE À JOUR LES JWT CLAIMS
-- ----------------------------------------------------------------------------

-- Fonction pour mettre à jour les JWT claims quand un utilisateur est créé/modifié
CREATE OR REPLACE FUNCTION public.handle_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour les claims JWT avec les infos de l'utilisateur
  -- Ces claims seront disponibles dans auth.jwt() -> 'claims'
  
  -- Note: Supabase gère automatiquement les claims via raw_user_meta_data
  -- Cette fonction peut être utilisée pour synchroniser avec la table users
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur auth.users (si Supabase permet les triggers sur auth.users)
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT OR UPDATE ON auth.users
-- FOR EACH ROW
-- EXECUTE FUNCTION public.handle_user_metadata();

-- ----------------------------------------------------------------------------
-- 3. FONCTION POUR SYNCHRONISER LES METADATA AVEC LA TABLE USERS
-- ----------------------------------------------------------------------------

-- Fonction pour mettre à jour auth.users.raw_user_meta_data depuis public.users
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour raw_user_meta_data dans auth.users
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'tenant_id', NEW."tenantId",
    'role', NEW.role,
    'is_super_admin', NEW."isSuperAdmin",
    'first_name', NEW."firstName",
    'last_name', NEW."lastName"
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour synchroniser les metadata quand public.users est mis à jour
CREATE TRIGGER sync_user_metadata_trigger
AFTER INSERT OR UPDATE OF "tenantId", role, "isSuperAdmin", "firstName", "lastName"
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_metadata();

-- ----------------------------------------------------------------------------
-- 4. FONCTION POUR CRÉER UN UTILISATEUR AVEC METADATA
-- ----------------------------------------------------------------------------

-- Fonction helper pour créer un utilisateur avec les metadata correctes
CREATE OR REPLACE FUNCTION public.create_user_with_metadata(
  p_email TEXT,
  p_password_hash TEXT,
  p_tenant_id UUID,
  p_role TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_is_super_admin BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Créer l'utilisateur dans auth.users (nécessite Supabase Admin API en production)
  -- En local, on peut utiliser auth.users directement
  
  -- Pour l'instant, créer seulement dans public.users
  -- La création dans auth.users doit être faite via Supabase Auth API
  
  INSERT INTO public.users (
    id,
    email,
    "passwordHash",
    "tenantId",
    role,
    "firstName",
    "lastName",
    "isSuperAdmin"
  ) VALUES (
    gen_random_uuid(),
    p_email,
    p_password_hash,
    p_tenant_id,
    p_role,
    p_first_name,
    p_last_name,
    p_is_super_admin
  )
  RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. CONFIGURER LES PROVIDERS D'AUTHENTIFICATION
-- ----------------------------------------------------------------------------

-- NOTE: Dans le Dashboard Supabase :
-- Authentication > Providers
-- 
-- Configurer :
-- - Email/Password : Activé
-- - OAuth providers (Google, Microsoft, etc.) : Selon besoins
-- 
-- Pour l'environnement de développement :
-- - Disable email confirmation : Activé (pour faciliter les tests)
-- 
-- Pour l'environnement de production :
-- - Enable email confirmation : Activé
-- - Enable email change confirmation : Activé

-- ----------------------------------------------------------------------------
-- 6. CONFIGURER LES RÈGLES DE MOT DE PASSE
-- ----------------------------------------------------------------------------

-- NOTE: Dans le Dashboard Supabase :
-- Authentication > Password
-- 
-- Configurer :
-- - Minimum password length : 8 caractères
-- - Require uppercase : Recommandé
-- - Require lowercase : Recommandé
-- - Require numbers : Recommandé
-- - Require special characters : Optionnel

-- ----------------------------------------------------------------------------
-- 7. COMMENTAIRES
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.handle_user_metadata() IS 'Met à jour les JWT claims lors de la création/modification d''un utilisateur';
COMMENT ON FUNCTION public.sync_user_metadata() IS 'Synchronise auth.users.raw_user_meta_data avec public.users';
COMMENT ON FUNCTION public.create_user_with_metadata(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, BOOLEAN) IS 'Crée un utilisateur avec les metadata correctes pour les JWT claims';

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================
-- 
-- 1. La configuration principale doit être faite via le Dashboard Supabase
--    - Authentication > URL Configuration
--    - Authentication > Providers
--    - Authentication > Password
-- 
-- 2. Les JWT claims sont automatiquement inclus dans les tokens Supabase
--    depuis auth.users.raw_user_meta_data
-- 
-- 3. Pour mettre à jour les claims :
--    - Via l'API : Supabase Admin API
--    - Via SQL : UPDATE auth.users SET raw_user_meta_data = ...
-- 
-- 4. Les claims sont accessibles dans les fonctions RLS via :
--    auth.jwt() -> 'claims' ->> 'tenant_id'
-- 
-- 5. Pour tester l'authentification :
--    - Local : http://localhost:3000
--    - Preview : https://*.vercel.app
--    - Production : https://*.academia-hub.com
-- 
-- ============================================================================
