/**
 * ============================================================================
 * PORTAL MODULE - DOCUMENTATION COMPLÈTE
 * ============================================================================
 * 
 * Module d'accès multi-portails pour Academia Hub
 * 
 * ============================================================================
 */

# MODULE PORTAL - ACCÈS MULTI-PORTAILS

## 🎯 OBJECTIF

Fournir un système d'accès sécurisé et contextuel pour les différents portails Academia Hub :
- **Portail École** : Direction, Administration, Promoteur
- **Portail Enseignant** : Enseignants & Encadreurs
- **Portail Parents & Élèves** : Suivi scolaire & paiements

## 📦 ARCHITECTURE

### Modèles de Données

- **PortalSession** : Sessions de portail (contexte d'accès sécurisé)
- **SchoolSearchLog** : Logs de recherche d'écoles (audit + rate limiting)
- **OrionAccessLog** : Logs d'accès ORION (initialisation au login)

### Services

- **SchoolSearchService** : Recherche publique d'établissements
- **PortalSessionService** : Gestion des sessions de portail
- **PortalAuthService** : Authentification multi-portails
- **OrionInitService** : Initialisation ORION au login direction

### Controllers

- **PublicPortalController** : API publique pour recherche d'écoles
- **PortalController** : Gestion des portails et initialisation ORION
- **PortalAuthController** : Authentification spécifique par portail

## 🔐 AUTHENTIFICATION MULTI-PORTAILS

### Portail École

**Endpoint** : `POST /api/portal/auth/school`

**Body** :
```json
{
  "tenantId": "uuid",
  "email": "directeur@ecole.com",
  "password": "password"
}
```

**Rôles autorisés** : DIRECTOR, SUPER_DIRECTOR, ADMIN, ACCOUNTANT

### Portail Enseignant

**Endpoint** : `POST /api/portal/auth/teacher`

**Body** :
```json
{
  "tenantId": "uuid",
  "teacherIdentifier": "EMP001",
  "password": "password"
}
```

**Rôles autorisés** : TEACHER uniquement

### Portail Parent

**Endpoint** : `POST /api/portal/auth/parent`

**Étape 1 - Demande OTP** :
```json
{
  "tenantId": "uuid",
  "phone": "+22912345678"
}
```

**Étape 2 - Vérification OTP** :
```json
{
  "tenantId": "uuid",
  "phone": "+22912345678",
  "otp": "123456"
}
```

## 🛡️ SÉCURITÉ

### Rate Limiting

- **Recherche écoles** : 20 requêtes par minute
- **Global** : 3 niveaux (short, medium, long)
- **ThrottlerGuard** : Protection globale contre abus

### Guards

- **PortalTypeGuard** : Vérification du type de portail
- **JwtAuthGuard** : Authentification JWT
- **RBAC** : Vérification des rôles par portail

## 🧠 INTÉGRATION ORION

### Initialisation Automatique

Lorsqu'un directeur/promoteur se connecte via le Portail École :

1. **Génération KPIs** : Calcul automatique des KPIs système
2. **Génération Alertes** : Détection automatique des alertes critiques
3. **Log d'accès** : Enregistrement dans `orion_access_logs`

### Endpoints ORION

- `GET /api/portal/orion/kpis/:tenantId` : Récupère les KPIs
- `GET /api/portal/orion/alerts/:tenantId` : Récupère les alertes
- `GET /api/portal/orion/dashboard/:tenantId` : Dashboard complet

## 📋 FLUX D'UTILISATION

1. **Sélection du portail** → Page `/portal`
2. **Recherche établissement** → Autocomplete intelligent
3. **Sélection établissement** → Récupération tenantId + slug
4. **Redirection** → `https://{slug}.academia-hub.com/login?portal={type}`
5. **Authentification** → Endpoint spécifique au portail
6. **Initialisation ORION** → Si directeur/promoteur
7. **Accès dashboard** → Avec contexte portail

## 🔄 EXEMPLES D'UTILISATION

### Recherche d'écoles

```typescript
GET /api/public/schools/search?q=collège

Response:
[
  {
    "id": "uuid",
    "name": "Collège X",
    "slug": "college-x",
    "logoUrl": "https://...",
    "city": "Cotonou",
    "schoolType": "SECONDAIRE"
  }
]
```

### Authentification Portail École

```typescript
POST /api/portal/auth/school
{
  "tenantId": "uuid",
  "email": "directeur@ecole.com",
  "password": "password"
}

Response:
{
  "user": { ... },
  "token": "jwt-token",
  "sessionId": "uuid",
  "portalType": "SCHOOL"
}
```

## 📝 NOTES IMPORTANTES

- **OTP Parents** : En développement, l'OTP est retourné dans la réponse. En production, il sera envoyé via SMS/WhatsApp.
- **Rate Limiting** : Configurable via `ThrottlerModule` dans `app.module.ts`.
- **ORION** : Lecture seule, aucune action automatique, uniquement alertes et recommandations.

