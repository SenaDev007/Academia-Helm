# 🔐 Configuration - Mode Développement (PLATFORM_OWNER)

## ✅ Implémentation Complète

Le bouton **"Mode Développement"** sur la page portail utilise maintenant automatiquement les identifiants `PLATFORM_OWNER` depuis `.env` pour se connecter et donner un accès complet à l'application.

## 📋 Configuration Requise

### 1. Variables d'environnement (`.env`)

Assurez-vous que ces variables sont définies dans `apps/api-server/.env` :

```env
# Mode développement
APP_ENV=development
NODE_ENV=development

# Identifiants PLATFORM_OWNER
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
PLATFORM_OWNER_SECRET=C@ptain.Yehioracadhub2021
```

### 2. Utilisateur dans la base de données

L'utilisateur avec l'email `PLATFORM_OWNER_EMAIL` doit exister dans la base de données avec le mot de passe hashé correspondant à `PLATFORM_OWNER_SECRET`.

**Vérification** :
```sql
SELECT id, email, "passwordHash" FROM users WHERE email = 'dev@academia-hub.local';
```

**Si l'utilisateur n'existe pas**, créez-le avec le script de seed ou manuellement.

## 🔄 Workflow

### Frontend → Backend

1. **Page Portail** (`apps/web-app/src/app/portal/page.tsx`)
   - Bouton "Mode Développement" → Appelle `/api/auth/dev-login`

2. **Route API Next.js** (`apps/web-app/src/app/api/auth/dev-login/route.ts`)
   - Vérifie que `NODE_ENV === 'development'`
   - Appelle le backend `/api/auth/dev-login`

3. **Route API Backend** (`apps/api-server/src/auth/auth.controller.ts`)
   - Vérifie que `APP_ENV === 'development'` ou `NODE_ENV === 'development'`
   - Récupère `PLATFORM_OWNER_EMAIL` et `PLATFORM_OWNER_SECRET` depuis `ConfigService`
   - Appelle `AuthService.login()` avec ces identifiants
   - Retourne les tokens JWT

4. **Session Frontend**
   - Stocke les tokens dans les cookies
   - Redirige vers `/app`

## 🔐 Accès Complet PLATFORM_OWNER

Le système PLATFORM_OWNER permet de bypasser :

- ✅ **TenantValidationGuard** - Validation des tenants
- ✅ **TenantIsolationGuard** - Isolation des données par tenant
- ✅ **PortalAccessGuard** - Accès aux portails
- ✅ **ModulePermissionGuard** - Permissions des modules
- ✅ **PermissionsGuard** - Vérifications RBAC
- ✅ **AuditLogInterceptor** - Exclusion des audits métier (dev only)

**Guards qui vérifient PLATFORM_OWNER** :
- `apps/api-server/src/common/guards/tenant-validation.guard.ts`
- `apps/api-server/src/common/guards/tenant-isolation.guard.ts`
- `apps/api-server/src/common/guards/portal-access.guard.ts`
- `apps/api-server/src/common/guards/module-permission.guard.ts`
- `apps/api-server/src/security/guards/platform-owner.guard.ts`

**Service de détection** :
- `apps/api-server/src/security/platform-owner.service.ts`

## 🧪 Test

1. **Démarrer l'API** :
   ```bash
   cd apps/api-server
   npm run start:dev
   ```

2. **Démarrer le Frontend** :
   ```bash
   cd apps/web-app
   npm run dev
   ```

3. **Tester le bouton** :
   - Aller sur `http://localhost:3001/portal`
   - Cliquer sur "Mode Développement"
   - Vérifier que la connexion se fait automatiquement
   - Vérifier que vous êtes redirigé vers `/app`
   - Vérifier que vous avez accès complet à l'application

## ⚠️ Sécurité

- **UNIQUEMENT EN DÉVELOPPEMENT** : Le mode dev-login est désactivé en production
- **Variables d'environnement** : Les identifiants PLATFORM_OWNER ne doivent JAMAIS être commités en production
- **Base de données** : L'utilisateur PLATFORM_OWNER n'a pas besoin d'être un super admin dans la DB, le système le détecte automatiquement par email

## 📝 Notes

- Le mot de passe dans la base de données doit être hashé avec bcrypt
- Le hash doit correspondre à `PLATFORM_OWNER_SECRET`
- L'email doit correspondre exactement à `PLATFORM_OWNER_EMAIL` (case-sensitive)

## 🔧 Dépannage

### Erreur : "Dev login is only available in development mode"
- Vérifier que `APP_ENV=development` ou `NODE_ENV=development` dans `.env`

### Erreur : "PLATFORM_OWNER credentials not configured"
- Vérifier que `PLATFORM_OWNER_EMAIL` et `PLATFORM_OWNER_SECRET` sont définis dans `.env`

### Erreur : "Invalid credentials"
- Vérifier que l'utilisateur existe dans la base de données
- Vérifier que le mot de passe hashé correspond à `PLATFORM_OWNER_SECRET`
- Vérifier que l'email correspond exactement à `PLATFORM_OWNER_EMAIL`

### L'utilisateur n'a pas accès complet
- Vérifier que `PlatformOwnerService.isPlatformOwner()` retourne `true`
- Vérifier que les guards utilisent bien `PlatformOwnerService`
- Vérifier les logs du backend pour voir si PLATFORM_OWNER est détecté
