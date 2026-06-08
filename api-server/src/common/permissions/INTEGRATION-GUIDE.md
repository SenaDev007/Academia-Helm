# 🚀 GUIDE D'INTÉGRATION - SYSTÈME DE RÔLES ET PERMISSIONS

## 📋 Vue d'ensemble

Ce guide explique comment intégrer le système de rôles et permissions dans les controllers existants et le frontend.

---

## 🔧 BACKEND - Intégration dans les Controllers

### Étape 1 : Importer les nouveaux guards et décorateurs

```typescript
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';
```

### Étape 2 : Ajouter les guards au controller

```typescript
@Controller('api/students')
@UseGuards(
  JwtAuthGuard,
  PortalAccessGuard, // ✅ NOUVEAU - Vérifie le portail autorisé
  // ... autres guards existants
  ModulePermissionGuard, // ✅ NOUVEAU - Vérifie les permissions par module
)
@RequiredModule(Module.ELEVES) // ✅ NOUVEAU - Spécifie le module requis
export class StudentsController {}
```

### Étape 3 : Protéger les routes spécifiques

```typescript
@Get()
@RequiredPermission(PermissionAction.READ) // Par défaut READ
async findAll() {}

@Post()
@RequiredPermission(PermissionAction.WRITE) // Écriture requise
async create() {}

@Delete(':id')
@RequiredPermission(PermissionAction.MANAGE) // Gestion complète requise
async remove() {}
```

---

## 🎨 FRONTEND - Intégration dans l'UI

### Étape 1 : Installer les dépendances (si nécessaire)

```bash
npm install @tanstack/react-query
```

### Étape 2 : Utiliser le hook `usePermissions`

```typescript
import { usePermissions } from '@/lib/permissions/use-permissions';
import { Module } from '@/lib/permissions/module.enum';
import { PermissionAction } from '@/lib/permissions/permission-action.enum';

function MyComponent() {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div>
      {hasPermission(Module.ELEVES) && (
        <Link href="/app/students">Élèves</Link>
      )}
      
      {hasPermission(Module.FINANCES, PermissionAction.MANAGE) && (
        <Button onClick={handleDelete}>Supprimer</Button>
      )}
    </div>
  );
}
```

### Étape 3 : Conditionner les menus

```typescript
// Exemple : Navigation conditionnelle
function Navigation() {
  const { hasPermission, getAccessibleModules } = usePermissions();
  const modules = getAccessibleModules();

  return (
    <nav>
      {modules.map(module => (
        <MenuItem key={module} module={module} />
      ))}
    </nav>
  );
}
```

---

## 📊 Exemples d'application

### Controller Élèves (✅ Appliqué)

```typescript
@Controller('students')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.ELEVES)
export class StudentsController {
  @Get()
  @RequiredPermission(PermissionAction.READ)
  async findAll() {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE)
  async create() {}
}
```

### Controller Paiements (✅ Appliqué)

```typescript
@Controller('payments')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.FINANCES)
export class PaymentsController {
  @Get()
  @RequiredPermission(PermissionAction.READ)
  async findAll() {}

  @Post()
  @RequiredPermission(PermissionAction.MANAGE) // Seuls comptables/promoteurs
  async create() {}
}
```

### Controller Matériel Pédagogique (✅ Appliqué)

```typescript
@Controller('api/pedagogy/pedagogical-materials')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.MATERIEL_PEDAGOGIQUE)
export class PedagogicalMaterialsController {
  @Get()
  @RequiredPermission(PermissionAction.READ)
  async findAll() {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE)
  async create() {}
}
```

---

## 🔄 Migration progressive

### Phase 1 : Controllers critiques (✅ Fait)
- ✅ StudentsController
- ✅ PaymentsController
- ✅ PedagogicalMaterialsController

### Phase 2 : Autres controllers métier
- [ ] ExamsController
- [ ] GradesController
- [ ] TeachersController
- [ ] ClassesController
- [ ] etc.

### Phase 3 : Frontend
- [ ] Intégrer `usePermissions` dans tous les composants
- [ ] Conditionner tous les menus
- [ ] Masquer les boutons selon les permissions
- [ ] Redirection automatique après login

---

## 🧪 Tests

### Test d'une permission

```typescript
// Backend
it('should deny access to non-authorized role', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/students')
    .set('Authorization', `Bearer ${teacherToken}`)
    .expect(403);
});

// Frontend
it('should hide menu item without permission', () => {
  const { queryByText } = render(<Navigation role={UserRole.ELEVE} />);
  expect(queryByText('Finances')).not.toBeInTheDocument();
});
```

---

## 📝 Checklist d'intégration

### Backend
- [x] Guards créés (PortalAccessGuard, ModulePermissionGuard)
- [x] Décorateurs créés (@RequiredModule, @RequiredPermission)
- [x] Service PermissionsService créé
- [x] Endpoint `/api/permissions/my-permissions` créé
- [x] Appliqué à StudentsController
- [x] Appliqué à PaymentsController
- [x] Appliqué à PedagogicalMaterialsController
- [ ] Appliquer aux autres controllers

### Frontend
- [x] Hook `usePermissions` créé
- [x] Enums Module et PermissionAction créés
- [x] Composant ConditionalMenu créé (exemple)
- [ ] Intégrer dans la navigation principale
- [ ] Intégrer dans les dashboards
- [ ] Redirection après login

---

## 🚨 Points d'attention

1. **Ordre des guards** : Toujours `PortalAccessGuard` avant `ModulePermissionGuard`
2. **Décorateurs** : `@RequiredModule` au niveau controller, `@RequiredPermission` au niveau route
3. **Actions par défaut** : Si `@RequiredPermission` n'est pas spécifié, `READ` est utilisé
4. **Performance** : Les permissions sont en mémoire, pas de requête DB
5. **Cache** : Le frontend cache les permissions 5 minutes

---

## 📚 Documentation complémentaire

- **ROLES-AND-PERMISSIONS.md** : Documentation complète du système
- **USAGE-EXAMPLES.md** : Exemples pratiques détaillés
- **IMPLEMENTATION-SUMMARY.md** : Résumé de l'implémentation

---

**Date de création**: 2024
**Version**: 1.0.0
