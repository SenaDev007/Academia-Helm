# 📚 EXEMPLES D'UTILISATION - SYSTÈME DE RÔLES ET PERMISSIONS

## 🎯 Exemples pratiques d'utilisation

---

## 1️⃣ Protection d'un Controller complet

### Exemple : Controller Élèves

```typescript
import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PortalAccessGuard } from '../../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequiredModule } from '../../common/decorators/required-module.decorator';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator';
import { Module } from '../../common/enums/module.enum';
import { PermissionAction } from '../../common/enums/permission-action.enum';

@Controller('api/students')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.ELEVES)
export class StudentsController {
  
  // Lecture : Tous les rôles avec READ sur ELEVES
  @Get()
  @RequiredPermission(PermissionAction.READ)
  async findAll() {
    // Seuls les rôles avec READ peuvent accéder
  }

  // Écriture : Seuls les rôles avec WRITE ou MANAGE
  @Post()
  @RequiredPermission(PermissionAction.WRITE)
  async create() {
    // Seuls les rôles avec WRITE/MANAGE peuvent créer
  }

  // Gestion complète : Seuls les rôles avec MANAGE
  @Delete(':id')
  @RequiredPermission(PermissionAction.MANAGE)
  async remove() {
    // Seuls les rôles avec MANAGE peuvent supprimer
  }
}
```

---

## 2️⃣ Protection d'une route spécifique

### Exemple : Route financière sensible

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PortalAccessGuard } from '../../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequiredModule } from '../../common/decorators/required-module.decorator';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator';
import { Module } from '../../common/enums/module.enum';
import { PermissionAction } from '../../common/enums/permission-action.enum';

@Controller('api/payments')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class PaymentsController {
  
  // Route publique (lecture) - pas de permission spéciale
  @Get()
  async findAll() {
    // Accessible à tous les utilisateurs authentifiés
  }

  // Route protégée - Seuls les comptables et promoteurs
  @Post('validate')
  @UseGuards(ModulePermissionGuard)
  @RequiredModule(Module.FINANCES)
  @RequiredPermission(PermissionAction.MANAGE)
  async validatePayment() {
    // Seuls les rôles avec MANAGE sur FINANCES peuvent valider
  }
}
```

---

## 3️⃣ Vérification conditionnelle dans un Service

### Exemple : Service avec logique métier

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PermissionsService } from '../../common/services/permissions.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { Module } from '../../common/enums/module.enum';
import { PermissionAction } from '../../common/enums/permission-action.enum';

@Injectable()
export class StudentsService {
  constructor(private permissionsService: PermissionsService) {}

  async createStudent(data: any, userRole: UserRole) {
    // Vérifier la permission avant l'opération
    if (!this.permissionsService.hasPermission(
      userRole,
      Module.ELEVES,
      PermissionAction.WRITE
    )) {
      throw new ForbiddenException('Insufficient permissions to create student');
    }

    // Logique de création...
  }

  async getAccessibleModules(userRole: UserRole) {
    // Récupérer tous les modules accessibles pour l'UI
    return this.permissionsService.getAccessibleModules(userRole);
  }
}
```

---

## 4️⃣ Middleware de redirection (Frontend)

### Exemple : Redirection automatique après login

```typescript
// Dans le service d'authentification frontend
import { Portal } from '@/enums/portal.enum';
import { UserRole, ROLE_PORTAL_MAP } from '@/enums/user-role.enum';

async login(credentials: LoginDto) {
  const response = await authApi.login(credentials);
  const user = response.user;
  const role = user.role as UserRole;
  
  // Récupérer le portail autorisé
  const authorizedPortal = ROLE_PORTAL_MAP[role];
  
  // Rediriger vers le portail approprié
  const portalPaths = {
    [Portal.PLATEFORME]: '/platform/dashboard',
    [Portal.ECOLE]: '/app/dashboard',
    [Portal.ENSEIGNANT]: '/teacher/dashboard',
    [Portal.PARENT_ELEVE]: '/parent/dashboard',
  };
  
  router.push(portalPaths[authorizedPortal]);
}
```

---

## 5️⃣ Conditionnement de l'UI (Frontend)

### Exemple : Afficher/masquer des menus

```typescript
// Hook React pour vérifier les permissions
import { useMemo } from 'react';
import { UserRole } from '@/enums/user-role.enum';
import { Module } from '@/enums/module.enum';
import { PermissionAction } from '@/enums/permission-action.enum';
import { hasPermission } from '@/utils/permissions';

export function usePermissions(userRole: UserRole) {
  const canAccessModule = useMemo(
    (module: Module, action?: PermissionAction) => {
      return hasPermission(userRole, module, action);
    },
    [userRole]
  );

  return { canAccessModule };
}

// Utilisation dans un composant
function NavigationMenu({ userRole }: { userRole: UserRole }) {
  const { canAccessModule } = usePermissions(userRole);

  return (
    <nav>
      {canAccessModule(Module.ELEVES) && (
        <MenuItem to="/app/students">Élèves</MenuItem>
      )}
      {canAccessModule(Module.FINANCES, PermissionAction.MANAGE) && (
        <MenuItem to="/app/finances">Finances</MenuItem>
      )}
      {canAccessModule(Module.ORION) && (
        <MenuItem to="/app/orion">ORION</MenuItem>
      )}
    </nav>
  );
}
```

---

## 6️⃣ Vérification dans un Guard personnalisé

### Exemple : Guard pour opérations sensibles

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsService } from '../../common/services/permissions.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { Module } from '../../common/enums/module.enum';
import { PermissionAction } from '../../common/enums/permission-action.enum';

@Injectable()
export class FinancialOperationGuard implements CanActivate {
  constructor(private permissionsService: PermissionsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userRole = request.userRole as UserRole;

    // Vérifier la permission financière
    if (!this.permissionsService.hasPermission(
      userRole,
      Module.FINANCES,
      PermissionAction.MANAGE
    )) {
      throw new ForbiddenException(
        'Only users with financial management permissions can perform this operation'
      );
    }

    return true;
  }
}
```

---

## 7️⃣ Endpoint pour récupérer les permissions (API)

### Exemple : Controller pour permissions UI

```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PortalAccessGuard } from '../../common/guards/portal-access.guard';
import { PermissionsService } from '../../common/services/permissions.service';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('api/permissions')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get('my-permissions')
  async getMyPermissions(@Request() req: any) {
    const userRole = req.userRole as UserRole;

    return {
      role: userRole,
      portal: this.permissionsService.getAuthorizedPortal(userRole),
      modules: this.permissionsService.getPermissionsForUI(userRole),
      accessibleModules: this.permissionsService.getAccessibleModules(userRole),
    };
  }
}
```

---

## 8️⃣ Validation dans un DTO

### Exemple : DTO avec validation de permission

```typescript
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Module } from '../../common/enums/module.enum';
import { PermissionAction } from '../../common/enums/permission-action.enum';

export class CreateStudentDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  // Le service vérifiera la permission avant de créer
}
```

---

## 📝 Notes importantes

1. **Ordre des Guards** : Toujours dans cet ordre
   ```typescript
   @UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
   ```

2. **Décorateurs** : `@RequiredModule` et `@RequiredPermission` doivent être utilisés ensemble

3. **Actions par défaut** : Si `@RequiredPermission` n'est pas spécifié, `READ` est utilisé par défaut

4. **Performance** : Les permissions sont calculées en mémoire, pas de requête DB

5. **Audit** : Toutes les tentatives d'accès sont loggées automatiquement

---

**Date de création**: 2024
**Version**: 1.0.0
