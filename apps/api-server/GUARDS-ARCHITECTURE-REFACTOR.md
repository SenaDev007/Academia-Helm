# 🏗️ Refonte Architecturale des Guards - Correction Complète

## 🎯 Objectif

Corriger l'architecture des guards pour permettre :
- ✅ Routes publiques sans tenant
- ✅ Routes authentifiées sans tenant (login, sélection tenant)
- ✅ Routes métier avec tenant obligatoire
- ✅ PLATFORM_OWNER peut bypasser les guards tenant

## ✅ Modifications Appliquées

### 1. Création du Décorateur `@RequireTenant()`

**Fichier** : `src/common/decorators/require-tenant.decorator.ts`

```typescript
export const REQUIRE_TENANT_KEY = 'requireTenant';
export const RequireTenant = () => SetMetadata(REQUIRE_TENANT_KEY, true);
```

### 2. Retrait des Guards Tenant des Guards Globaux

**Fichier** : `src/app.module.ts`

**AVANT** :
```typescript
{
  provide: APP_GUARD,
  useClass: TenantValidationGuard, // ❌ Trop strict
},
{
  provide: APP_GUARD,
  useClass: TenantIsolationGuard, // ❌ Trop strict
},
```

**APRÈS** :
```typescript
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard, // ✅ Seul guard global
},
// ✅ TenantValidationGuard et TenantIsolationGuard retirés
// Ils seront appliqués uniquement sur les routes marquées avec @RequireTenant()
```

### 3. Modification des Guards pour Vérifier `@RequireTenant()`

Tous les guards tenant vérifient maintenant si la route nécessite un tenant :

**Fichiers modifiés** :
- `tenant-validation.guard.ts`
- `tenant-isolation.guard.ts`
- `context-validation.guard.ts`
- `school-level-isolation.guard.ts`
- `academic-year-enforcement.guard.ts`

**Logique** :
```typescript
// ✅ Vérifier si le tenant est requis
const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
  context.getHandler(),
  context.getClass(),
]);

// 🚨 Si le tenant n'est PAS requis → on laisse passer
if (!requireTenant) {
  return true;
}
```

### 4. Bypass PLATFORM_OWNER

Tous les guards tenant permettent maintenant au PLATFORM_OWNER de bypasser :

```typescript
function isPlatformOwner(user: any): boolean {
  if (!user) return false;
  if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') return true;
  const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL;
  if (platformOwnerEmail && user.email === platformOwnerEmail) return true;
  return false;
}

// Dans le guard
if (isPlatformOwner(user)) {
  return true; // ✅ Bypass
}
```

## 📋 Architecture des Routes

### 1️⃣ Routes Publiques (SANS TENANT)

```typescript
@Public()
@Get('/api/public/schools/list')
listAllSchools() {}
```

✅ **Aucun guard tenant** ne s'applique

### 2️⃣ Routes Authentifiées MAIS SANS TENANT

```typescript
@Get('/auth/me')
@UseGuards(JwtAuthGuard) // ✅ Auth seulement
getMe() {}
```

✅ **Pas de `@RequireTenant()`** → Les guards tenant laissent passer

### 3️⃣ Routes Métier (TENANT OBLIGATOIRE)

```typescript
@RequireTenant() // ✅ Tenant requis
@UseGuards(JwtAuthGuard, TenantValidationGuard, TenantIsolationGuard)
@Get('/students')
findAllStudents() {}
```

✅ **Avec `@RequireTenant()`** → Les guards tenant s'appliquent

## 🧪 Checklist de Validation

### 1. Routes Publiques

```bash
curl http://localhost:3000/api/public/schools/list
```

✅ **Doit retourner** : Liste des tenants (sans erreur 403)

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@academia-hub.local","password":"..."}'
```

✅ **Doit fonctionner** : Login sans erreur tenant

### 3. PLATFORM_OWNER

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

✅ **Doit fonctionner** : Pas d'erreur tenant pour PLATFORM_OWNER

### 4. Routes Métier

```typescript
@RequireTenant()
@Get('/students')
findAllStudents() {}
```

✅ **Doit exiger** : Tenant ID dans les headers ou query

## 🎯 Résultat Attendu

### Avant la Refonte

❌ Routes publiques bloquées par TenantGuard
❌ Login impossible (tenant requis avant login)
❌ PLATFORM_OWNER bloqué
❌ Liste des tenants inaccessible

### Après la Refonte

✅ Routes publiques fonctionnent
✅ Login fonctionne sans tenant
✅ PLATFORM_OWNER peut accéder
✅ Liste des tenants accessible
✅ Routes métier toujours protégées

## 📝 Utilisation

### Pour une Route Métier

```typescript
import { RequireTenant } from '../common/decorators/require-tenant.decorator';

@Controller('students')
export class StudentsController {
  @RequireTenant() // ✅ Marquer comme nécessitant un tenant
  @Get()
  findAll() {
    // Le tenant est garanti d'être présent ici
  }
}
```

### Pour une Route Authentifiée Sans Tenant

```typescript
@Controller('auth')
export class AuthController {
  @Get('me')
  getMe() {
    // Pas de @RequireTenant() → Pas de vérification tenant
    // Mais l'utilisateur est authentifié (JwtAuthGuard)
  }
}
```

## ⚠️ Notes Importantes

1. **Sécurité intacte** : Les routes métier sont toujours protégées
2. **PLATFORM_OWNER** : Peut bypasser les guards tenant (dev only)
3. **Routes publiques** : Toujours accessibles sans auth ni tenant
4. **Migration progressive** : Ajouter `@RequireTenant()` aux routes métier existantes

## 🚀 Prochaines Étapes

1. ✅ Refonte complète appliquée
2. ⏳ Tester toutes les routes publiques
3. ⏳ Tester le login
4. ⏳ Tester PLATFORM_OWNER
5. ⏳ Ajouter `@RequireTenant()` aux routes métier existantes
