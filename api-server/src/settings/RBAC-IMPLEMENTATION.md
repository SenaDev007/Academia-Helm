# RBAC Avancé — Implémentation Academia Hub

## Ordre de vérification (critique)

Le **PermissionGuard** applique strictement cet ordre :

1. **JWT** — Utilisateur authentifié (JwtAuthGuard)
2. **Tenant** — Contexte tenant résolu ; isolation : seul PLATFORM_OWNER/SUPER_ADMIN peut utiliser `tenant_id` (query/header) pour un autre tenant
3. **Rôle** — Rôles de l’utilisateur pour ce tenant (table `user_roles`)
4. **Permission** — Module + action en base (`role_permissions` → `permissions`)
5. **Feature flag** — Module activé pour le tenant (`tenant_features`)

Tout écart dans cet ordre peut créer des failles de sécurité.

## Base de données

- **roles** : `id`, `tenant_id` (nullable = rôles globaux), `name`, `description`, `isSystemRole`, `canAccessOrion`, `canAccessAtlas`, `allowedLevelIds`, `createdAt`, `updatedAt`
- **permissions** : `id`, `name` (unique), `resource` (module_key), `action` (action_key), `description`
- **role_permissions** : `roleId`, `permissionId`, `levelScope` (niveau scolaire optionnel)
- **user_roles** : `userId`, `roleId`, `tenantId` (contexte d’assignation pour isolation)

Contraintes : un utilisateur peut avoir plusieurs rôles ; isolation stricte par tenant ; rôles système non modifiables/supprimables.

## API protégées (Paramètres → Rôles & utilisateurs)

Toutes les routes RBAC exigent **PARAMETRES:read** ou **PARAMETRES:write** selon l’action :

| Méthode | Route | Permission |
|--------|--------|------------|
| GET | /settings/roles | PARAMETRES read |
| GET | /settings/roles/:id | PARAMETRES read |
| POST | /settings/roles | PARAMETRES write |
| PUT | /settings/roles/:id | PARAMETRES write |
| DELETE | /settings/roles/:id | PARAMETRES write |
| GET | /settings/permissions | PARAMETRES read |
| GET | /settings/permissions/grouped | PARAMETRES read |
| PUT | /settings/roles/:id/permissions | PARAMETRES write |
| GET | /settings/users | PARAMETRES read |
| POST | /settings/users/:userId/assign-role | PARAMETRES write |
| POST | /settings/users/:userId/revoke-role | PARAMETRES write |

## Isolation tenant

- **resolveTid** (controller) : utilisateur normal → uniquement `user.tenantId` ; PLATFORM_OWNER/SUPER_ADMIN → peut passer `tenant_id` (query/header).
- **PermissionGuard.resolveTenantId** : même règle (pas de cross-tenant pour un utilisateur classique).
- **assignRoleToUser** : l’utilisateur cible doit appartenir au même tenant que le contexte ; sinon `ForbiddenException`.
- **userHasPermission** : ne considère que les rôles assignés pour ce tenant (ou rôles globaux).

## Audit

Toutes les actions RBAC sont journalisées via `SettingsHistoryService.logSettingChange` (catégorie `roles`, sous-catégorie `security`) :

- Création / modification / suppression de rôle
- Mise à jour des permissions d’un rôle
- Assignation / révocation de rôle à un utilisateur

## Mapping permission (resource) → feature flag

Le guard refuse l’accès si le module n’est pas activé pour le tenant. Correspondance (dans `permission.guard.ts`) :

- ELEVES, INSCRIPTIONS, DOCUMENTS_SCOLAIRES → STUDENTS
- EXAMENS, BULLETINS → EXAMS
- FINANCES, RECOUVREMENT, DEPENSES → FINANCE
- RH, PAIE → HR_PAYROLL
- ORGANISATION_PEDAGOGIQUE, MATERIEL_PEDAGOGIQUE → PEDAGOGY
- COMMUNICATION → COMMUNICATION
- ORION → ORION ; ATLAS → ATLAS
- PARAMETRES, ANNEES_SCOLAIRES → pas de vérification feature (toujours autorisé si permission)
- QHSE, BIBLIOTHEQUE, TRANSPORT, CANTINE, INFIRMERIE, EDUCAST, BOUTIQUE → id. nom feature

## Rôles système (seed)

Rôles créés avec `tenantId: null`, `isSystemRole: true` : PLATFORM_OWNER, PLATFORM_ADMIN, PROMOTEUR, DIRECTEUR, SECRETAIRE, COMPTABLE, SECRETAIRE_COMPTABLE, CENSEUR, SURVEILLANT, ENSEIGNANT, PARENT, ELEVE.

## Utilisation du guard sur d’autres modules

Pour protéger une route par permission (ex. FINANCES en écriture) :

```ts
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('FINANCES', 'write')
async createPayment(...) { ... }
```

L’ordre des guards doit rester : **JwtAuthGuard** puis **PermissionGuard**.
