# 🔧 Fix Types RLS - Correction Type TEXT vs UUID

**Problème identifié** : Erreur `text = uuid` lors de l'exécution du script RLS.

**Cause** : Dans Prisma, tous les IDs sont de type `String` (devenant `TEXT` en PostgreSQL), mais la fonction `tenant_id()` retournait `UUID`.

---

## ✅ Corrections Appliquées

### 1. Fonction `tenant_id()` - Type TEXT

**Avant** :
```sql
CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.current_tenant_id', TRUE))::UUID;
$$ LANGUAGE SQL STABLE;
```

**Après** :
```sql
CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS TEXT AS $$
  SELECT current_setting('app.current_tenant_id', TRUE);
$$ LANGUAGE SQL STABLE;
```

**Raison** : Les colonnes `tenantId` dans Prisma sont de type `String` → `TEXT` en PostgreSQL, pas `UUID`.

---

### 2. Suppression des castes UUID

**Avant** :
```sql
(user_id = (current_setting('app.current_user_id', TRUE))::UUID)
```

**Après** :
```sql
("userId" = current_setting('app.current_user_id', TRUE))
```

**Raison** : Les IDs sont `TEXT`, pas `UUID`. Pas besoin de cast.

---

### 3. Noms de colonnes en camelCase

Toutes les références aux colonnes utilisent maintenant `"tenantId"`, `"userId"`, `"studentId"`, `"guardianId"` (avec guillemets doubles) au lieu de `tenant_id`, `user_id`, etc.

**Exemple** :
```sql
-- Avant
WHERE sg.student_id = students.id

-- Après
WHERE sg."studentId" = students.id
```

---

### 4. Suppression référence `userId` dans `guardians`

Le modèle `Guardian` n'a **pas** de colonne `userId`. La référence a été supprimée :

```sql
-- Avant
("tenantId" = auth.tenant_id()) OR
("userId" = current_setting('app.current_user_id', TRUE))

-- Après
("tenantId" = auth.tenant_id())
```

---

## 📊 Vérification Schema Prisma

**Types confirmés** :
- `id` : `String @id @default(uuid())` → `TEXT` en PostgreSQL
- `tenantId` : `String` → `TEXT` en PostgreSQL
- `userId` : `String` → `TEXT` en PostgreSQL
- Tous les IDs sont `String`, pas `UUID` natif

---

## ✅ Fichiers Corrigés

- ✅ `apps/api-server/prisma/migrations/rls-policies-local.sql`
- ✅ `apps/api-server/prisma/migrations/rls-policies.sql`

---

## 🎯 Résultat

**Avant** : Erreur `l'opérateur n'existe pas : text = uuid`

**Après** : Script RLS compatible avec le schéma Prisma (TEXT partout)

---

**Le script RLS devrait maintenant s'exécuter sans erreur de type !** ✅
