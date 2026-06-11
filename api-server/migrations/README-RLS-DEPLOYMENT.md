# Guide de déploiement RLS Supabase

## 📋 Résumé

Ce guide explique comment déployer le système Row Level Security (RLS) complet sur Supabase pour Academia Hub.

## 🚀 Étapes de déploiement

### 1. Prérequis

- Accès au Dashboard Supabase
- Accès à la base de données PostgreSQL (via Supabase SQL Editor ou CLI)
- Backup de la base de données (recommandé)

### 2. Exécuter les migrations SQL

#### Étape 1 : Migration RLS complète

Exécuter le fichier `005_supabase_rls_complete.sql` dans le SQL Editor de Supabase :

1. Ouvrir le Dashboard Supabase
2. Aller dans **SQL Editor**
3. Créer une nouvelle requête
4. Copier-coller le contenu de `005_supabase_rls_complete.sql`
5. Exécuter la requête

Cette migration :
- ✅ Crée les fonctions helper RLS
- ✅ Active RLS sur toutes les tables avec `tenant_id`
- ✅ Crée les politiques pour tous les rôles
- ✅ Configure l'accès parents aux enfants
- ✅ Optimise avec des index automatiques

#### Étape 2 : Configuration Auth

Exécuter le fichier `006_supabase_auth_config.sql` :

1. Dans le SQL Editor
2. Créer une nouvelle requête
3. Copier-coller le contenu de `006_supabase_auth_config.sql`
4. Exécuter la requête

Cette migration :
- ✅ Crée les triggers de synchronisation metadata
- ✅ Configure les fonctions helper pour la création d'utilisateurs

### 3. Configuration Dashboard Supabase

#### 3.1 URLs de redirection

1. Aller dans **Authentication > URL Configuration**
2. Ajouter les URLs suivantes dans **Redirect URLs** :

```
http://localhost:3000/**
http://localhost:3001/**
https://*.vercel.app/**
https://*.academia-hub.com/**
```

3. Définir les **Site URLs** :
   - **Development** : `http://localhost:3000`
   - **Production** : `https://app.academia-hub.com`

#### 3.2 Providers d'authentification

1. Aller dans **Authentication > Providers**
2. Activer **Email/Password**
3. Configurer les providers OAuth si nécessaire (Google, Microsoft, etc.)

#### 3.3 Règles de mot de passe

1. Aller dans **Authentication > Password**
2. Configurer :
   - Minimum length : `8`
   - Require uppercase : `✓`
   - Require lowercase : `✓`
   - Require numbers : `✓`
   - Require special characters : `☐` (optionnel)

### 4. Mettre à jour les JWT Claims des utilisateurs existants

Exécuter cette requête pour mettre à jour tous les utilisateurs existants :

```sql
-- Mettre à jour les metadata de tous les utilisateurs existants
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'tenant_id', (SELECT "tenantId" FROM public.users WHERE id = auth.users.id),
  'role', (SELECT role FROM public.users WHERE id = auth.users.id),
  'is_super_admin', (SELECT "isSuperAdmin" FROM public.users WHERE id = auth.users.id)
)
WHERE EXISTS (SELECT 1 FROM public.users WHERE id = auth.users.id);
```

### 5. Vérification

#### 5.1 Vérifier que RLS est activé

```sql
-- Vérifier les tables avec RLS activé
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
ORDER BY tablename;
```

#### 5.2 Vérifier les politiques RLS

```sql
-- Lister toutes les politiques
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

#### 5.3 Vérifier les fonctions helper

```sql
-- Vérifier que les fonctions existent
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
AND proname IN (
  'current_tenant_id',
  'is_super_admin',
  'is_orion',
  'user_role',
  'is_parent_of_student',
  'user_student_ids',
  'has_tenant_access'
);
```

#### 5.4 Tester l'isolation tenant

```sql
-- Se connecter en tant qu'utilisateur d'un tenant
-- (Remplacer 'tenant-uuid' par un UUID réel)
SELECT auth.current_tenant_id(); -- Devrait retourner le tenant_id

-- Tester l'accès aux données
SELECT COUNT(*) FROM students; -- Ne devrait retourner que les étudiants du tenant
```

### 6. Tests de sécurité

#### Test 1 : Isolation tenant

1. Se connecter en tant qu'utilisateur du tenant A
2. Vérifier qu'on ne voit que les données du tenant A
3. Vérifier qu'on ne peut pas accéder aux données du tenant B

#### Test 2 : Accès parent

1. Se connecter en tant que parent
2. Vérifier qu'on voit les données de ses enfants
3. Vérifier qu'on ne voit pas les données des autres enfants

#### Test 3 : ORION (lecture seule)

1. Se connecter avec le rôle ORION
2. Vérifier qu'on peut lire les données
3. Vérifier qu'on ne peut pas écrire (INSERT/UPDATE/DELETE)

#### Test 4 : Super admin

1. Se connecter en tant que super admin
2. Vérifier qu'on a accès à toutes les données
3. Vérifier qu'on peut modifier toutes les données

## 🔧 Dépannage

### Problème : L'utilisateur ne voit aucune donnée

**Solution** :
```sql
-- Vérifier les JWT claims
SELECT 
  id,
  email,
  raw_user_meta_data->>'tenant_id' as tenant_id,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE id = 'user-uuid';

-- Mettre à jour les claims si manquants
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'tenant_id', 'tenant-uuid',
  'role', 'teacher'
)
WHERE id = 'user-uuid';
```

### Problème : Les parents ne voient pas leurs enfants

**Solution** :
```sql
-- Vérifier la relation parent-enfant
SELECT 
  u.id as user_id,
  u.email,
  g.id as guardian_id,
  sg."studentId",
  s."firstName",
  s."lastName"
FROM users u
JOIN guardians g ON g."userId" = u.id
JOIN student_guardians sg ON sg."guardianId" = g.id
JOIN students s ON s.id = sg."studentId"
WHERE u.id = 'parent-uuid';
```

### Problème : Erreur "permission denied"

**Solution** :
```sql
-- Vérifier les permissions du rôle
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'academia_app';
```

## 📊 Monitoring

### Vérifier l'utilisation RLS

```sql
-- Statistiques sur les politiques RLS
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY policy_count DESC;
```

### Audit des accès

Les accès peuvent être audités via la table `audit_logs` si elle est activée.

## 🎯 Checklist finale

- [ ] Migrations SQL exécutées avec succès
- [ ] URLs de redirection configurées dans le Dashboard
- [ ] Providers d'authentification configurés
- [ ] Règles de mot de passe configurées
- [ ] JWT claims mis à jour pour tous les utilisateurs
- [ ] RLS activé sur toutes les tables concernées
- [ ] Politiques créées et testées
- [ ] Tests de sécurité effectués
- [ ] Documentation à jour
- [ ] Équipe formée sur RLS

## 📞 Support

En cas de problème :
1. Consulter la documentation : `docs/SUPABASE-RLS-SECURITY.md`
2. Vérifier les logs Supabase
3. Tester les politiques individuellement
4. Contacter l'équipe sécurité si nécessaire

## 🔐 Sécurité

**IMPORTANT** :
- ⚠️ Ne jamais désactiver RLS en production
- ⚠️ Toujours tester les migrations sur un environnement de staging
- ⚠️ Garder un backup avant chaque migration
- ⚠️ Vérifier régulièrement les politiques RLS
- ⚠️ Auditer les accès via les logs Supabase
