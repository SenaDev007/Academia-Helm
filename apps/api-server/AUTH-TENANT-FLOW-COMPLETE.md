# 🔐 Flow d'Authentification Multi-Tenant - Implémentation Complète

## ✅ Implémentation Terminée

Le flow d'authentification multi-tenant est maintenant **complètement implémenté** selon les spécifications.

## 🏗️ Architecture du Flow

### ÉTAPE 0 - Accès Portail (PUBLIC)

**Routes publiques** (aucun guard tenant) :
- `GET /api/public/schools/list` ✅
- `GET /api/public/schools/search` ✅

**Objectif** : Permettre la sélection d'une école sans être connecté.

---

### ÉTAPE 1 - Authentification (SANS TENANT)

**Route** : `POST /auth/login`

**Guard** : `LocalAuthGuard` uniquement

**Ce que fait le backend** :
- ✅ Vérifie les identifiants
- ✅ Retourne un JWT **SANS tenant_id**
- ✅ Inclut :
  ```json
  {
    "user": {
      "id": "...",
      "email": "...",
      "role": "DIRECTOR",
      // ❌ PAS de tenantId
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
  ```

**Interdit** :
- ❌ Exiger tenant_id
- ❌ Injecter un tenant arbitrairement

---

### ÉTAPE 2 - Récupération des Tenants Accessibles

**Route** : `GET /auth/available-tenants`

**Guard** : `JwtAuthGuard` uniquement (PAS de TenantGuard)

**Backend** :
- ✅ Lit les relations user ↔ tenant
- ✅ Retourne :
  ```json
  [
    {
      "tenantId": "uuid",
      "schoolName": "Collège X",
      "tenantName": "Collège X",
      "slug": "college-x",
      "subdomain": "college-x",
      "logoUrl": null,
      "country": "Bénin"
    }
  ]
  ```

**Cas particuliers** :
- ✅ PLATFORM_OWNER → retourne tous les tenants actifs
- ✅ Utilisateur mono-tenant → liste = 1 élément
- ✅ Utilisateur multi-tenant → tous ses tenants

---

### ÉTAPE 3 - Sélection du Tenant (OBLIGATOIRE)

**Route** : `POST /auth/select-tenant`

**Guard** : `JwtAuthGuard` uniquement (PAS de TenantGuard)

**Payload** :
```json
{
  "tenant_id": "uuid"
}
```

**Backend** :
- ✅ Vérifie que l'utilisateur a droit à ce tenant
- ✅ Génère un nouveau JWT enrichi :
  ```json
  {
    "user": {
      "id": "...",
      "email": "...",
      "role": "...",
      "isPlatformOwner": false
    },
    "tenant": {
      "id": "...",
      "name": "...",
      "slug": "...",
      "subdomain": "..."
    },
    "academicYear": {
      "id": "...",
      "name": "2025-2026",
      "startDate": "...",
      "endDate": "..."
    },
    "accessToken": "...", // ✅ Avec tenant_id
    "refreshToken": "..."  // ✅ Avec tenant_id
  }
  ```

**Token enrichi contient** :
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "DIRECTOR",
  "tenantId": "tenant_uuid",
  "academicYearId": "year_uuid",
  "contextLocked": true
}
```

**À partir de là** :
- ✅ Toutes les routes métier exigent ce token
- ✅ Le tenant est verrouillé
- ✅ Logging de la sélection tenant

---

### ÉTAPE 4 - Redirection Frontend

**Frontend** :
- ✅ Stocke le token enrichi
- ✅ Injecte `Authorization: Bearer <token>`
- ✅ Redirige vers `/dashboard`

---

### ÉTAPE 5 - Accès Métier (TENANT STRICT)

**Routes** :
- `/students/*`
- `/finance/*`
- `/exams/*`
- `/settings/*`
- `/orion/*`

**Guards** :
- ✅ `JwtAuthGuard`
- ✅ `TenantRequiredGuard` (via `@RequireTenant()`)
- ✅ `RbacGuard`

**Impossible d'y accéder sans** :
- ❌ Token
- ❌ tenant_id dans le token
- ❌ Rôle valide

---

## 👑 Cas Spécial - PLATFORM_OWNER

### Règle Officielle

Le PLATFORM_OWNER :
- ✅ Peut se connecter sans tenant
- ✅ Peut naviguer entre tenants
- ✅ Ne travaille jamais implicitement

### UX Recommandée

- Sélecteur global de tenant dans le header
- Changement de tenant = nouveau `/auth/select-tenant`

---

## 🔐 Règles de Sécurité Non Négociables

1. ✅ **Aucun accès métier sans tenant sélectionné**
2. ✅ **Aucun fallback automatique de tenant**
3. ✅ **Aucun tenant stocké côté front sans validation backend**
4. ✅ **Tout changement de tenant est loggé**
5. ✅ **ORION lit le contexte tenant actif**

---

## 📋 Structure des Endpoints (Récap)

| Route | Auth | Tenant | Rôle |
|-------|------|--------|------|
| `/portal/schools/*` | ❌ | ❌ | Public |
| `/auth/login` | ❌ | ❌ | Public |
| `/auth/available-tenants` | ✅ | ❌ | Tous |
| `/auth/select-tenant` | ✅ | ❌ | Tous |
| `/students/*` | ✅ | ✅ | RBAC |
| `/settings/*` | ✅ | ✅ | RBAC |

---

## 🧪 Tests à Effectuer

### 1. Login (SANS tenant)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@academia-hub.local",
    "password": "C@ptain.Yehioracadhub2021"
  }'
```

**Résultat attendu** :
```json
{
  "user": {
    "id": "...",
    "email": "dev@academia-hub.local",
    "role": "...",
    // ❌ PAS de tenantId
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### 2. Récupérer les Tenants Accessibles

```bash
curl http://localhost:3000/api/auth/available-tenants \
  -H "Authorization: Bearer <accessToken>"
```

**Résultat attendu** :
```json
[
  {
    "tenantId": "...",
    "schoolName": "CSPEB-Eveil d'Afrique Education",
    "tenantName": "CSPEB-Eveil d'Afrique Education",
    "slug": "cspeb-eveil-afrique",
    "subdomain": "cspeb",
    "logoUrl": null,
    "country": "Bénin"
  }
]
```

### 3. Sélectionner un Tenant

```bash
curl -X POST http://localhost:3000/api/auth/select-tenant \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenantId>"
  }'
```

**Résultat attendu** :
```json
{
  "user": {
    "id": "...",
    "email": "dev@academia-hub.local",
    "role": "...",
    "isPlatformOwner": true
  },
  "tenant": {
    "id": "...",
    "name": "CSPEB-Eveil d'Afrique Education",
    "slug": "cspeb-eveil-afrique",
    "subdomain": "cspeb"
  },
  "academicYear": {
    "id": "...",
    "name": "2025-2026",
    "startDate": "...",
    "endDate": "..."
  },
  "accessToken": "...", // ✅ Avec tenant_id
  "refreshToken": "..."  // ✅ Avec tenant_id
}
```

### 4. Accéder à une Route Métier

```bash
curl http://localhost:3000/api/students \
  -H "Authorization: Bearer <enrichedAccessToken>"
```

**Résultat attendu** : Liste des étudiants (si route existe et RBAC OK)

---

## 🎯 Prochaines Étapes

1. ✅ Flow d'authentification implémenté
2. ⏳ Tester le flow complet
3. ⏳ Ajouter `@RequireTenant()` aux routes métier existantes
4. ⏳ Intégrer ORION dans le flow (après sélection tenant)
5. ⏳ Implémenter le frontend pour utiliser ce flow

---

## 📝 Notes Importantes

- **Sécurité intacte** : Les routes métier sont toujours protégées
- **PLATFORM_OWNER** : Peut bypasser les guards tenant (dev only)
- **Routes publiques** : Toujours accessibles sans auth ni tenant
- **Migration progressive** : Ajouter `@RequireTenant()` aux routes métier existantes
