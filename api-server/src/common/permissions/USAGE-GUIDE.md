# 🔐 GUIDE D'UTILISATION - PERMISSIONS VERROUILLÉES

## 📋 Vue d'ensemble

Le système de permissions est **100% verrouillé** selon la matrice officielle. Tous les accès sont vérifiés strictement.

---

## 🎯 Utilisation dans les Controllers

### Exemple basique

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { StrictPermissionGuard } from '../guards/strict-permission.guard';
import { RequiredModule } from '../decorators/required-module.decorator';
import { RequiredPermission } from '../decorators/required-permission.decorator';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';

@Controller('students')
@UseGuards(JwtAuthGuard, StrictPermissionGuard)
export class StudentsController {
  @Get()
  @RequiredModule(Module.ELEVES)
  @RequiredPermission(PermissionAction.READ)
  async findAll() {
    // Seuls les rôles autorisés peuvent accéder
    // Promoteur, Directeur, Secrétaire, Comptable, Enseignant, Parent, Élève
  }

  @Post()
  @RequiredModule(Module.ELEVES)
  @RequiredPermission(PermissionAction.WRITE)
  async create() {
    // Seuls Promoteur, Directeur, Secrétaire peuvent créer
  }
}
```

---

## 🛡️ Guards disponibles

### 1. StrictPermissionGuard

Guard principal pour vérifier les permissions strictes.

```typescript
@UseGuards(StrictPermissionGuard)
@RequiredModule(Module.FINANCES)
@RequiredPermission(PermissionAction.READ)
```

**Comportement** :
- ✅ Vérifie le rôle + module + action
- ✅ Promoteur = super-set (accès à tout)
- ✅ PLATFORM_OWNER bypass (dev only)
- ✅ Trace tous les refus d'accès

### 2. OrionReadonlyGuard

Guard spécial pour ORION (lecture seule).

```typescript
@UseGuards(OrionReadonlyGuard)
@RequiredModule(Module.ORION)
@RequiredPermission(PermissionAction.READ)
```

**Comportement** :
- ✅ Autorise uniquement `READ`
- ❌ Bloque `WRITE`, `DELETE`, `MANAGE`
- ⚠️ ORION = lecture seule, jamais d'écriture

---

## 🎯 Décorateurs

### @RequiredModule

Définit le module requis pour l'endpoint.

```typescript
@RequiredModule(Module.ELEVES)
```

### @RequiredPermission

Définit l'action requise (par défaut: `READ`).

```typescript
@RequiredPermission(PermissionAction.WRITE)
```

---

## 🔍 Vérification programmatique

### Dans un Service

```typescript
import { StrictPermissionsService } from '../services/strict-permissions.service';

@Injectable()
export class MyService {
  constructor(
    private strictPermissionsService: StrictPermissionsService,
  ) {}

  async doSomething(user: any, module: Module, action: PermissionAction) {
    const userRole = user.role as UserRole;
    
    if (!this.strictPermissionsService.hasPermission(userRole, module, action, user)) {
      throw new ForbiddenException('Access denied');
    }

    // Continuer...
  }
}
```

---

## 📊 Récupérer les permissions d'un utilisateur

```typescript
import { StrictPermissionsService } from '../services/strict-permissions.service';

// Récupérer tous les modules accessibles
const modules = this.strictPermissionsService.getAccessibleModules(userRole);

// Récupérer toutes les permissions pour un module
const permissions = this.strictPermissionsService.getRolePermissionsForModule(
  userRole,
  Module.ELEVES,
);
```

---

## 🚫 Traçage des refus d'accès

Tous les refus sont automatiquement tracés dans `AuditLog` avec :
- User ID
- User Email
- User Role
- Module
- Action
- Reason
- Timestamp

### Récupérer les refus récents

```typescript
import { AccessDeniedLogService } from '../services/access-denied-log.service';

const recentDenials = await this.accessDeniedLogService.getRecentAccessDenials(100);
const userDenials = await this.accessDeniedLogService.getAccessDenialsForUser(userId, 50);
```

---

## 🎯 Règles importantes

### 1. Promoteur = Super-set

Le rôle **Promoteur** a automatiquement accès à :
- ✅ Tous les modules
- ✅ Toutes les actions
- ✅ Aucun écran masqué

### 2. ORION = Lecture seule

ORION ne permet **JAMAIS** :
- ❌ CREATE
- ❌ UPDATE
- ❌ DELETE
- ❌ MANAGE

ORION permet **UNIQUEMENT** :
- ✅ READ

### 3. PLATFORM_OWNER (DEV only)

En développement, `PLATFORM_OWNER` peut bypasser toutes les vérifications.

⚠️ **Désactivé en production**

---

## 📝 Exemple complet

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { StrictPermissionGuard } from '../guards/strict-permission.guard';
import { RequiredModule } from '../decorators/required-module.decorator';
import { RequiredPermission } from '../decorators/required-permission.decorator';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';

@Controller('finance')
@UseGuards(JwtAuthGuard, StrictPermissionGuard)
export class FinanceController {
  @Get()
  @RequiredModule(Module.FINANCES)
  @RequiredPermission(PermissionAction.READ)
  async findAll() {
    // Promoteur, Comptable, Secrétaire-Comptable, Directeur, Parent, Élève
  }

  @Post()
  @RequiredModule(Module.FINANCES)
  @RequiredPermission(PermissionAction.WRITE)
  async create() {
    // Promoteur, Comptable, Secrétaire-Comptable uniquement
  }

  @Post(':id/approve')
  @RequiredModule(Module.FINANCES)
  @RequiredPermission(PermissionAction.MANAGE)
  async approve() {
    // Promoteur, Comptable uniquement
  }
}
```

---

## ✅ Checklist avant déploiement

- [ ] Tous les endpoints protégés avec `StrictPermissionGuard`
- [ ] Module et action correctement définis
- [ ] ORION endpoints protégés avec `OrionReadonlyGuard`
- [ ] Tests de permissions effectués
- [ ] Documentation à jour

---

**Status**: ✅ **PRÊT POUR PRODUCTION**
