# Sécurité Supabase RLS - Academia Hub

## 📋 Vue d'ensemble

Ce document décrit le système complet de Row Level Security (RLS) implémenté pour Academia Hub sur Supabase. Le système garantit l'isolation complète des données entre tenants (écoles) et le contrôle d'accès par rôle.

## 🎯 Objectifs

1. **Isolation multi-tenant** : Un utilisateur ne peut voir que les données de son tenant
2. **Accès par rôle** : Contrôle granulaire selon le rôle (admin, teacher, parent, etc.)
3. **Accès parents** : Les parents ne voient que les données de leurs enfants
4. **ORION en lecture seule** : Le rôle ORION ne peut que lire les données
5. **Super admin global** : Accès complet pour les super administrateurs

## 🏗️ Architecture

### Rôles PostgreSQL

| Rôle | Permissions | Usage |
|------|-------------|-------|
| `academia_app` | SELECT, INSERT, UPDATE, DELETE | API Backend |
| `academia_super_admin` | ALL | Administrateurs système |
| `academia_orion` | SELECT ONLY | IA analytique (ORION) |

### Fonctions Helper RLS

```sql
-- Récupérer le tenant_id de l'utilisateur authentifié
auth.current_tenant_id() → UUID

-- Vérifier si super admin
auth.is_super_admin() → BOOLEAN

-- Vérifier si ORION
auth.is_orion() → BOOLEAN

-- Vérifier si parent d'un étudiant
auth.is_parent_of_student(student_id) → BOOLEAN

-- Liste des étudiants d'un parent
auth.user_student_ids() → SETOF UUID

-- Vérifier l'accès tenant
auth.has_tenant_access(tenant_id) → BOOLEAN
```

## 🔒 Politiques RLS

### Tables principales

#### 1. **Tenants**
- **SELECT** : Tous (nécessaire pour résolution subdomain)
- **INSERT/UPDATE/DELETE** : Super admin uniquement

#### 2. **Users**
- **SELECT** : Super admin, ORION, ou tenant correspondant, ou utilisateur lui-même
- **INSERT/UPDATE/DELETE** : Super admin ou tenant correspondant

#### 3. **Students**
- **SELECT** : Super admin, ORION, tenant correspondant, ou parent de l'étudiant
- **INSERT/UPDATE/DELETE** : Super admin ou tenant correspondant

#### 4. **Guardians**
- **SELECT** : Super admin, ORION, tenant correspondant, ou guardian lui-même
- **INSERT/UPDATE/DELETE** : Super admin ou tenant correspondant

#### 5. **StudentGuardians**
- **SELECT** : Super admin, ORION, tenant correspondant, ou parent concerné
- **INSERT/UPDATE/DELETE** : Super admin ou tenant correspondant

#### 6. **Autres tables avec tenant_id**
- **SELECT** : Super admin, ORION, ou tenant correspondant
- **INSERT/UPDATE/DELETE** : Super admin ou tenant correspondant (pas ORION)

### Tables liées aux étudiants (accès parents)

Pour les tables contenant `studentId` ou `student_id`, une politique supplémentaire permet aux parents d'accéder aux données de leurs enfants :

- Grades
- Absences
- Exams
- Homework
- Disciplinary actions
- etc.

## 🔑 Configuration JWT Claims

Les JWT tokens Supabase doivent contenir les claims suivants :

```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "role": "teacher",
  "is_super_admin": false
}
```

### Mise à jour des claims

Les claims sont automatiquement synchronisés via le trigger `sync_user_metadata_trigger` qui met à jour `auth.users.raw_user_meta_data` quand `public.users` est modifié.

## 🌐 Configuration Supabase Auth

### URLs de redirection autorisées

Dans le Dashboard Supabase : **Authentication > URL Configuration**

```
- http://localhost:3000/**
- http://localhost:3001/**
- https://*.vercel.app/**
- https://*.academia-hub.com/**
```

### Site URLs

- **Développement** : `http://localhost:3000`
- **Production** : `https://app.academia-hub.com`

### Providers

- **Email/Password** : Activé
- **OAuth** : Configuré selon besoins (Google, Microsoft, etc.)

### Règles de mot de passe

- Longueur minimum : 8 caractères
- Majuscules : Recommandé
- Minuscules : Recommandé
- Chiffres : Recommandé
- Caractères spéciaux : Optionnel

## 📝 Utilisation dans l'application

### Backend (NestJS)

```typescript
// Dans un middleware/guard
async setTenantContext(req: Request, res: Response, next: NextFunction) {
  const user = await this.authService.getUser(req);
  
  // Les claims sont automatiquement disponibles via Supabase
  // Pas besoin de SET LOCAL car Supabase gère via JWT
  
  next();
}
```

### Frontend (Next.js)

```typescript
// Les tokens Supabase contiennent automatiquement les claims
const { data: { user } } = await supabase.auth.getUser();

// Les claims sont accessibles via user.user_metadata
const tenantId = user.user_metadata.tenant_id;
const role = user.user_metadata.role;
```

## 🧪 Tests

### Tester l'isolation tenant

```sql
-- Se connecter en tant qu'utilisateur d'un tenant
SET ROLE academia_app;
SET LOCAL app.current_tenant_id = 'tenant-1-uuid';

-- Vérifier que seules les données du tenant sont visibles
SELECT * FROM students; -- Ne retourne que les étudiants du tenant-1
```

### Tester l'accès parent

```sql
-- Se connecter en tant que parent
SET ROLE academia_app;
SET LOCAL app.current_user_id = 'parent-uuid';

-- Vérifier l'accès aux enfants
SELECT * FROM students WHERE id IN (SELECT * FROM auth.user_student_ids());
```

### Tester ORION (lecture seule)

```sql
-- Se connecter en tant qu'ORION
SET ROLE academia_orion;
SET LOCAL app.is_orion = true;

-- Peut lire
SELECT * FROM students;

-- Ne peut pas écrire (erreur)
INSERT INTO students (...) VALUES (...); -- ❌ ERREUR
```

## 🚨 Sécurité

### Points importants

1. **RLS est évalué AVANT chaque requête** : Garantit l'isolation au niveau base de données
2. **ORION ne peut JAMAIS écrire** : Contrôle via RLS et trigger
3. **Pas de bypass possible** : Les politiques sont évaluées côté PostgreSQL
4. **Claims JWT sécurisés** : Signés par Supabase, non modifiables par le client

### Bonnes pratiques

- ✅ Toujours utiliser les fonctions helper (`auth.current_tenant_id()`, etc.)
- ✅ Ne jamais désactiver RLS en production
- ✅ Tester les politiques régulièrement
- ✅ Auditer les accès via `audit_logs`
- ✅ Mettre à jour les claims lors des changements de rôle/tenant

## 📊 Performance

### Index automatiques

Un index est créé automatiquement sur `tenantId` pour toutes les tables concernées, optimisant les requêtes RLS :

```sql
CREATE INDEX IF NOT EXISTS idx_table_name_tenant_id ON table_name("tenantId");
```

### Optimisations

- Les politiques utilisent des index pour améliorer les performances
- Les fonctions helper sont marquées `STABLE` pour permettre la mise en cache
- Les requêtes complexes (parents) sont optimisées avec des sous-requêtes efficaces

## 🔍 Dépannage

### Problème : L'utilisateur ne voit aucune donnée

**Cause** : Les JWT claims ne contiennent pas `tenant_id`

**Solution** :
```sql
-- Vérifier les claims
SELECT auth.jwt() -> 'claims';

-- Mettre à jour les metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'tenant_id', 'tenant-uuid',
  'role', 'teacher'
)
WHERE id = 'user-uuid';
```

### Problème : Les parents ne voient pas leurs enfants

**Cause** : La relation `student_guardians` n'est pas correctement configurée

**Solution** :
```sql
-- Vérifier la relation
SELECT * FROM student_guardians sg
JOIN guardians g ON sg."guardianId" = g.id
WHERE g."userId" = 'parent-uuid';

-- Vérifier que le guardian a bien un userId
SELECT * FROM guardians WHERE "userId" = 'parent-uuid';
```

### Problème : ORION peut écrire (ne devrait pas)

**Cause** : Le trigger n'est pas actif ou RLS mal configuré

**Solution** :
```sql
-- Vérifier que RLS est activé
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'students';

-- Vérifier les politiques
SELECT * FROM pg_policies WHERE tablename = 'students';
```

## 📚 Références

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT Claims in Supabase](https://supabase.com/docs/guides/auth/jwt-claims)

## 🎯 Checklist de déploiement

- [ ] Migrations SQL exécutées (`005_supabase_rls_complete.sql`)
- [ ] Configuration Auth Supabase effectuée (URLs, providers)
- [ ] JWT claims configurés pour tous les utilisateurs existants
- [ ] Tests d'isolation tenant effectués
- [ ] Tests d'accès parent effectués
- [ ] Tests ORION (lecture seule) effectués
- [ ] Audit des permissions effectué
- [ ] Documentation à jour
- [ ] Formation équipe sur RLS

## 📞 Support

Pour toute question sur la sécurité RLS :
- Consulter ce document
- Vérifier les logs Supabase
- Tester les politiques individuellement
- Contacter l'équipe sécurité si nécessaire
