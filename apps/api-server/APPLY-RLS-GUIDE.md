# 🔒 Guide d'Application RLS - Academia Hub

**Date**: Configuration RLS (Row Level Security)  
**Fichier SQL**: `prisma/migrations/rls-policies.sql`  
**Statut**: ✅ **Fichier RLS prêt**

---

## 📋 Méthode 1 : Application via pgAdmin (Recommandé)

### Étape 1 : Ouvrir pgAdmin

1. Ouvrez pgAdmin 4
2. Connectez-vous à votre serveur PostgreSQL local
3. Développez : `PostgreSQL 18` → `Databases` → `academia_helm`

### Étape 2 : Ouvrir le Query Tool

1. Clic droit sur la base `academia_helm`
2. Cliquez sur **"Query Tool"** (ou `Alt + Shift + Q`)

### Étape 3 : Charger le fichier SQL RLS

**⚠️ IMPORTANT** : Utilisez la version adaptée pour PostgreSQL local !

1. Dans le Query Tool, cliquez sur **"Open File"** (📁)
2. Naviguez vers : `apps/api-server/prisma/migrations/rls-policies-local.sql`
3. Ouvrez le fichier

**Note** : `rls-policies-local.sql` est la version adaptée pour PostgreSQL local (sans schéma `auth` Supabase).  
Si vous utilisez Supabase, utilisez plutôt `rls-policies.sql`.

### Étape 4 : Exécuter le Script SQL

1. Vérifiez que tout le contenu SQL est chargé
2. Cliquez sur **"Execute"** (▶️) ou appuyez sur `F5`
3. Attendez la fin de l'exécution

**Résultat attendu** :
- ✅ Messages "CREATE FUNCTION", "ALTER TABLE", "CREATE POLICY" sans erreur
- ✅ Warnings sur "already exists" sont normaux (idempotent)

### Étape 5 : Vérifier RLS

Dans le Query Tool, exécutez :

```sql
-- Vérifier que RLS est activé sur les tables principales
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'users', 'students', 'academic_years', 'school_levels')
ORDER BY tablename;
```

**Résultat attendu** : `rls_enabled = true` pour toutes les tables listées.

---

## 📋 Méthode 2 : Application via Ligne de Commande

### Si psql est installé et dans le PATH :

```bash
cd apps/api-server

# Appliquer RLS
psql -U postgres -d academia_helm -f prisma/migrations/rls-policies.sql

# Vérifier
psql -U postgres -d academia_helm -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true LIMIT 10;"
```

### Si psql n'est pas dans le PATH :

**Windows** :
```powershell
# Trouver psql
# Généralement dans : C:\Program Files\PostgreSQL\18\bin\psql.exe

# Exécuter avec chemin complet
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d academia_helm -f prisma/migrations/rls-policies.sql
```

---

## ✅ Vérification Post-Application

### 1. Vérifier que les fonctions RLS sont créées

```sql
-- Dans pgAdmin Query Tool
SELECT 
  proname as function_name,
  pronargs as args
FROM pg_proc 
WHERE proname IN ('tenant_id', 'is_super_admin', 'is_orion');
```

**Résultat attendu** : 3 fonctions trouvées.

### 2. Vérifier que les policies sont créées

```sql
-- Vérifier les policies RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname
LIMIT 20;
```

**Résultat attendu** : Plusieurs policies listées (tenant_select, tenant_modify, user_tenant_isolation, etc.).

### 3. Vérifier que RLS est activé

```sql
-- Compter les tables avec RLS activé
SELECT COUNT(*) as tables_with_rls
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
```

**Résultat attendu** : Plusieurs dizaines de tables avec RLS activé.

---

## 📊 Ce que fait le Script RLS

Le fichier `rls-policies.sql` :

1. ✅ **Crée les rôles PostgreSQL** :
   - `academia_app` - Pour l'application (CRUD limité au tenant)
   - `academia_orion` - Pour ORION (lecture seule globale)
   - `academia_super_admin` - Pour super admin (accès global)

2. ✅ **Crée les fonctions helper** :
   - `auth.tenant_id()` - Récupère le tenant_id de l'utilisateur
   - `auth.is_super_admin()` - Vérifie si super admin
   - `auth.is_orion()` - Vérifie si ORION

3. ✅ **Active RLS sur toutes les tables métier** :
   - Tables avec `tenantId` → Isolation par tenant
   - Tables sans `tenantId` → Politique spécifique

4. ✅ **Crée les policies RLS** :
   - `tenant_select` - Lecture des tenants (tous)
   - `tenant_modify` - Modification (super admin uniquement)
   - `user_tenant_isolation` - Isolation des utilisateurs par tenant
   - `student_tenant_isolation` - Isolation des élèves par tenant
   - `student_parent_access` - Accès parent à leurs enfants
   - Et toutes les autres policies pour chaque table...

---

## ⚠️ Notes Importantes

1. **RLS est idempotent** : Le script peut être relancé plusieurs fois sans erreur (ignore les éléments existants)

2. **RLS nécessite SET LOCAL** : Pour que RLS fonctionne, l'application doit définir :
   ```sql
   SET LOCAL app.current_tenant_id = 'tenant-uuid';
   SET LOCAL app.current_user_id = 'user-uuid';
   SET LOCAL app.is_super_admin = false;
   SET LOCAL app.is_orion = false;
   ```

3. **RLS pour développement local** : RLS est principalement utile pour Supabase. Pour PostgreSQL local, vous pouvez le configurer pour tester la sécurité multi-tenant.

---

## 🎯 Après Application RLS

Une fois RLS appliqué :

1. ✅ Vérifier que toutes les tables ont RLS activé
2. ✅ Vérifier que les policies sont créées
3. ✅ Tester les requêtes Prisma (elles devraient fonctionner normalement)
4. ✅ Pour tester RLS, utiliser les fonctions helper avec SET LOCAL

---

**RLS prêt à être appliqué** ✅  
**Fichier SQL disponible** : `apps/api-server/prisma/migrations/rls-policies.sql`
