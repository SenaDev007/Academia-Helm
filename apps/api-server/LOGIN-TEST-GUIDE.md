# 🧪 Guide de Test - Fonctionnalité de Login

## 📋 Prérequis

1. **PostgreSQL** doit être démarré et accessible
2. **API Server** doit être démarré sur le port 3000
3. **Frontend** doit être démarré sur le port 3001 (optionnel pour test complet)

## 🔐 Identifiants de Test

### Utilisateur Directeur (CSPEB)
- **Email**: `s.akpovitohou@gmail.com`
- **Password**: `C@ptain.Yehioracadhub2021`
- **Rôle**: `DIRECTOR`
- **Tenant**: CSPEB-Eveil d'Afrique Education

### Super Admin
- **Email**: `yehiortech@gmail.com`
- **Password**: `C@ptain.Superadmin1`
- **Rôle**: `SUPER_DIRECTOR`
- **isSuperAdmin**: `true`

## 🧪 Test 1: API Directe (Backend)

### Méthode 1: Script Node.js

```bash
cd apps/api-server
node test-login.js [email] [password]
```

**Exemple:**
```bash
node test-login.js s.akpovitohou@gmail.com "C@ptain.Yehioracadhub2021"
```

### Méthode 2: cURL

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "s.akpovitohou@gmail.com",
    "password": "C@ptain.Yehioracadhub2021"
  }'
```

### Réponse Attendue (Succès)

```json
{
  "user": {
    "id": "...",
    "email": "s.akpovitohou@gmail.com",
    "firstName": "...",
    "lastName": "...",
    "tenantId": "..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Réponse Attendue (Erreur)

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

## 🧪 Test 2: Via Route API Next.js (Frontend → Backend)

### URL
```
POST http://localhost:3001/api/auth/login
```

### Body
```json
{
  "email": "s.akpovitohou@gmail.com",
  "password": "C@ptain.Yehioracadhub2021",
  "tenantSubdomain": "cspeb"
}
```

### Réponse Attendue

```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "s.akpovitohou@gmail.com",
    "firstName": "...",
    "lastName": "...",
    "tenantId": "..."
  },
  "tenant": {
    "id": "...",
    "name": "CSPEB-Eveil d'Afrique Education",
    "subdomain": "cspeb",
    "subscriptionStatus": "ACTIVE_SUBSCRIBED"
  }
}
```

## 🧪 Test 3: Interface Web (Frontend)

1. Ouvrir le navigateur: `http://localhost:3001/login`
2. Entrer les identifiants:
   - Email: `s.akpovitohou@gmail.com`
   - Password: `C@ptain.Yehioracadhub2021`
3. Cliquer sur "Se connecter"
4. Vérifier la redirection vers `/app`

## 🔍 Vérifications

### ✅ Checklist de Test

- [ ] L'API répond sur `http://localhost:3000/api/health`
- [ ] Le script `test-login.js` fonctionne
- [ ] La route `/api/auth/login` répond correctement
- [ ] Les tokens JWT sont générés
- [ ] La session est stockée dans les cookies (frontend)
- [ ] La redirection fonctionne après login
- [ ] Les erreurs sont gérées correctement (mauvais mot de passe, utilisateur inexistant)

### 🐛 Dépannage

#### Erreur: "ECONNREFUSED"
- **Cause**: L'API server n'est pas démarré
- **Solution**: `cd apps/api-server && npm run start:dev`

#### Erreur: "Invalid credentials"
- **Cause**: Mauvais email/mot de passe ou utilisateur non créé
- **Solution**: Vérifier que le seed a été exécuté: `npx prisma db seed`

#### Erreur: "Database connection failed"
- **Cause**: PostgreSQL n'est pas accessible
- **Solution**: Vérifier que PostgreSQL est démarré et que les credentials dans `.env` sont corrects

#### Erreur: "JWT_SECRET not configured"
- **Cause**: Variable d'environnement manquante
- **Solution**: Ajouter `JWT_SECRET=your-secret-key` dans `apps/api-server/.env`

## 📝 Notes

- Les tokens JWT expirent après 15 minutes (accessToken) et 7 jours (refreshToken)
- La session frontend est stockée dans les cookies `academia_session` et `academia_token`
- Le tenant est automatiquement détecté depuis le sous-domaine ou le paramètre `tenantSubdomain`
