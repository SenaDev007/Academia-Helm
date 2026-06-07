# 🔐 PLATFORM OWNER - RÔLE SYSTÈME (DEV ONLY)

## ⚠️ IMPORTANT

**Ce rôle n'est PAS un rôle métier.**
**Il n'existe pas fonctionnellement pour les clients.**
**Il est lié à l'environnement de développement.**

---

## 🎯 OBJECTIF

Permettre au fondateur de travailler librement en environnement development, sans casser le RBAC métier existant.

---

## 🔧 CONFIGURATION

### Variables d'environnement (`.env`)

```env
APP_ENV=development
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
```

⚠️ **En production, ces variables n'existent pas.**

---

## 🚀 UTILISATION

### 1. Connexion

Connectez-vous avec l'email défini dans `PLATFORM_OWNER_EMAIL`.

### 2. Vérification du statut

```bash
GET /api/dev/platform-owner/status
```

Réponse :
```json
{
  "isPlatformOwner": true,
  "isEnabled": true,
  "platformOwnerEmail": "dev@academia-hub.local",
  "environment": "development",
  "message": "🔐 You are PLATFORM_OWNER (DEV ONLY)"
}
```

### 3. Forçage du contexte

Utilisez les headers HTTP pour forcer le contexte :

```bash
# Forcer tenant
x-tenant-id: <tenant-id>

# Forcer année scolaire
x-academic-year-id: <academic-year-id>

# Forcer niveau scolaire
x-school-level-id: <school-level-id>

# Forcer classe
x-class-id: <class-id>
```

Exemple :
```bash
curl -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: tenant-123" \
     -H "x-academic-year-id: year-456" \
     http://localhost:3000/api/students
```

### 4. Vérification du contexte forcé

```bash
GET /api/dev/platform-owner/context
```

---

## 🔐 CAPACITÉS DU PLATFORM_OWNER

| Capacité | Oui / Non |
|----------|-----------|
| Accéder à TOUS les tenants | ✅ |
| Bypasser RBAC | ✅ |
| Changer d'année scolaire | ✅ |
| Activer/désactiver modules | ✅ |
| Simuler n'importe quel rôle | ✅ |
| Voir toutes les données | ✅ |
| Modifier le schéma | ✅ |
| Forcer sync offline | ✅ |
| Désactiver ORION | ✅ |

---

## 🚫 RESTRICTIONS

### ❌ Non visible dans l'UI
### ❌ Non assignable depuis l'interface
### ❌ Non utilisable par un client
### ❌ Non audité (pas de traces dans les logs métier)
### ❌ Désactivé en production

---

## 🧩 ARCHITECTURE

### Composants

1. **PlatformOwnerService** : Détection du PLATFORM_OWNER
2. **PlatformOwnerGuard** : Bypass RBAC
3. **ContextForcerService** : Forçage du contexte
4. **PlatformOwnerContextInterceptor** : Injection du contexte forcé
5. **PlatformOwnerAuditExclusionInterceptor** : Exclusion des audits

### Guards modifiés

- `PortalAccessGuard` : Bypass si PLATFORM_OWNER
- `ModulePermissionGuard` : Bypass si PLATFORM_OWNER

### Interceptors

- `AuditLogInterceptor` : Ignore si `skipAudit = true`

---

## 🧪 TESTS

### Vérifier que vous êtes PLATFORM_OWNER

```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/dev/platform-owner/status
```

### Tester le forçage de contexte

```bash
curl -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: tenant-123" \
     -H "x-academic-year-id: year-456" \
     http://localhost:3000/api/dev/platform-owner/context
```

---

## 🔒 SÉCURITÉ

### En développement

- ✅ PLATFORM_OWNER actif
- ✅ Bypass RBAC
- ✅ Forçage contexte
- ✅ Exclusion audits

### En production

- ❌ PLATFORM_OWNER désactivé
- ❌ Impossible à utiliser
- ❌ Aucune trace

---

## 📝 NOTES

- Le PLATFORM_OWNER n'est **jamais** stocké en base
- Il est détecté dynamiquement via l'email
- Il n'apparaît pas dans les audits métier
- Il n'impacte pas les KPI
- ORION l'ignore complètement

---

**Date de création**: 2024
**Version**: 1.0.0
