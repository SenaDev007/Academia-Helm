# 🔧 Fix RLS pour PostgreSQL Local

**Problème** : Le script RLS original (`rls-policies.sql`) utilise le schéma `auth` qui n'existe pas dans PostgreSQL local.

**Erreur** :
```
ERROR: schema "auth" does not exist
```

---

## ✅ Solution : Script RLS Adapté

**Nouveau fichier** : `apps/api-server/prisma/migrations/rls-policies-local.sql`

**Changements** :
- ✅ Utilise le schéma `public` au lieu de `auth`
- ✅ Fonctions : `public.tenant_id()`, `public.is_super_admin()`, `public.is_orion()`
- ✅ Ajout de `DROP POLICY IF EXISTS` pour rendre le script idempotent
- ✅ Compatible avec PostgreSQL local (pas Supabase)

---

## 📋 Application via pgAdmin

### Étape 1 : Fermer l'ancien script
Si vous avez déjà `rls-policies.sql` ouvert dans pgAdmin :
1. Fermez l'onglet `rls-policies.sql`

### Étape 2 : Charger le nouveau script
1. Dans le Query Tool, cliquez sur **"Open File"** (📁)
2. Naviguez vers : `apps/api-server/prisma/migrations/rls-policies-local.sql`
3. Ouvrez le fichier

### Étape 3 : Exécuter
1. Vérifiez que le script est chargé (vous verrez `public.tenant_id()` au lieu de `auth.tenant_id()`)
2. Cliquez sur **"Execute"** (▶️) ou appuyez sur `F5`
3. Attendez la fin de l'exécution

**Résultat attendu** :
- ✅ Pas d'erreur "schema auth does not exist"
- ✅ Messages "CREATE FUNCTION", "ALTER TABLE", "CREATE POLICY" sans erreur
- ✅ Quelques warnings "already exists" sont normaux (script idempotent)

---

## ✅ Vérification

### 1. Vérifier que les fonctions sont créées

```sql
-- Dans pgAdmin Query Tool
SELECT 
  proname as function_name,
  nspname as schema_name
FROM pg_proc 
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
WHERE proname IN ('tenant_id', 'is_super_admin', 'is_orion')
AND nspname = 'public';
```

**Résultat attendu** : 3 fonctions trouvées dans le schéma `public`.

### 2. Vérifier que RLS est activé

```sql
-- Vérifier RLS sur les tables principales
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'users', 'students', 'academic_years', 'school_levels')
ORDER BY tablename;
```

**Résultat attendu** : `rls_enabled = true` pour toutes les tables listées.

### 3. Vérifier que les policies sont créées

```sql
-- Vérifier les policies RLS
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname
LIMIT 20;
```

**Résultat attendu** : Plusieurs policies listées (tenant_select, tenant_modify, user_tenant_isolation, etc.).

---

## 🔍 Différence entre les deux scripts

| Aspect | `rls-policies.sql` (Supabase) | `rls-policies-local.sql` (PostgreSQL Local) |
|--------|------------------------------|---------------------------------------------|
| Schéma fonctions | `auth.tenant_id()` | `public.tenant_id()` |
| Environnement | Supabase | PostgreSQL local |
| Idempotent | Partiel | Oui (DROP POLICY IF EXISTS) |

---

## ✅ Après Application

Une fois `rls-policies-local.sql` appliqué :

1. ✅ RLS est activé sur toutes les tables métier
2. ✅ Les fonctions helper sont dans le schéma `public`
3. ✅ Les policies RLS sont créées
4. ✅ Le script peut être relancé sans erreur (idempotent)

**RLS est maintenant configuré pour PostgreSQL local !** ✅
