# 📡 API Endpoints Documentation

Documentation complète des endpoints de l'API Academia Hub.

## 🔐 Authentification

### POST /api/auth/register

Inscription d'un nouvel utilisateur.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "uuid-optional"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "uuid"
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

---

### POST /api/auth/login

Connexion d'un utilisateur.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "uuid"
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

---

### POST /api/auth/logout

Déconnexion (à implémenter côté client).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

### POST /api/auth/refresh

Rafraîchir le token d'accès.

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

---

## 👥 Utilisateurs

### GET /api/users/me

Récupérer le profil de l'utilisateur actuel.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "uuid",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### GET /api/users

Liste des utilisateurs du tenant.

**Headers:**
```
Authorization: Bearer <accessToken>
X-Tenant-ID: <tenant-id> (optionnel si dans JWT)
```

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "uuid"
  }
]
```

---

### GET /api/users/:id

Détails d'un utilisateur.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "uuid"
}
```

---

### PATCH /api/users/:id

Modifier un utilisateur.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "tenantId": "uuid"
}
```

---

### DELETE /api/users/:id

Supprimer un utilisateur.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```
204 No Content
```

---

## 🏢 Tenants

### POST /api/tenants

Créer un nouveau tenant.

**Request Body:**
```json
{
  "name": "École Primaire ABC",
  "slug": "ecole-abc",
  "subscriptionPlan": "free"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "École Primaire ABC",
  "slug": "ecole-abc",
  "status": "active",
  "subscriptionPlan": "free",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### GET /api/tenants

Liste de tous les tenants (admin uniquement).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "École Primaire ABC",
    "slug": "ecole-abc",
    "status": "active"
  }
]
```

---

### GET /api/tenants/:id

Détails d'un tenant.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": "uuid",
  "name": "École Primaire ABC",
  "slug": "ecole-abc",
  "status": "active",
  "subscriptionPlan": "free"
}
```

---

### GET /api/tenants/slug/:slug

Trouver un tenant par son slug.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": "uuid",
  "name": "École Primaire ABC",
  "slug": "ecole-abc",
  "status": "active"
}
```

---

## 🎓 Étudiants

### POST /api/students

Créer un nouvel étudiant.

**Headers:**
```
Authorization: Bearer <accessToken>
X-Tenant-ID: <tenant-id> (optionnel si dans JWT)
```

**Request Body:**
```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "dateOfBirth": "2010-05-15",
  "gender": "M",
  "email": "jean.dupont@example.com",
  "phone": "+33612345678",
  "address": "123 Rue Example, Paris"
}
```

**Response:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "firstName": "Jean",
  "lastName": "Dupont",
  "dateOfBirth": "2010-05-15T00:00:00.000Z",
  "gender": "M",
  "email": "jean.dupont@example.com",
  "phone": "+33612345678",
  "address": "123 Rue Example, Paris",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### GET /api/students

Liste des étudiants du tenant.

**Headers:**
```
Authorization: Bearer <accessToken>
X-Tenant-ID: <tenant-id> (optionnel si dans JWT)
```

**Response:**
```json
[
  {
    "id": "uuid",
    "firstName": "Jean",
    "lastName": "Dupont",
    "dateOfBirth": "2010-05-15T00:00:00.000Z",
    "email": "jean.dupont@example.com"
  }
]
```

---

### GET /api/students/:id

Détails d'un étudiant.

**Headers:**
```
Authorization: Bearer <accessToken>
X-Tenant-ID: <tenant-id> (optionnel si dans JWT)
```

**Response:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "firstName": "Jean",
  "lastName": "Dupont",
  "dateOfBirth": "2010-05-15T00:00:00.000Z",
  "gender": "M",
  "email": "jean.dupont@example.com",
  "phone": "+33612345678",
  "address": "123 Rue Example, Paris"
}
```

---

### PATCH /api/students/:id

Modifier un étudiant.

**Headers:**
```
Authorization: Bearer <accessToken>
X-Tenant-ID: <tenant-id> (optionnel si dans JWT)
```

**Request Body:**
```json
{
  "email": "nouveau.email@example.com",
  "phone": "+33698765432"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "nouveau.email@example.com",
  "phone": "+33698765432",
  ...
}
```

---

### DELETE /api/students/:id

Supprimer un étudiant.

**Headers:**
```
Authorization: Bearer <accessToken>
X-Tenant-ID: <tenant-id> (optionnel si dans JWT)
```

**Response:**
```
204 No Content
```

---

## 🔒 Authentification Requise

Tous les endpoints (sauf `/api/auth/register` et `/api/auth/login`) nécessitent :

```
Authorization: Bearer <accessToken>
```

## 🌍 Multi-tenant

Pour les endpoints tenant-scoped (students, etc.), le tenant est résolu via :

1. **Sous-domaine** : `school-a.academiahub.com`
2. **Header** : `X-Tenant-ID: <tenant-id>`
3. **JWT** : `tenantId` dans le payload du token

---

*Documentation API - Academia Hub*

