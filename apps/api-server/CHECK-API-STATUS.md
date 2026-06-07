# 🔍 Vérification du Statut de l'API

## Problème Actuel

L'API backend retourne une erreur 500 lors des tentatives de login.

## ✅ Vérifications à Effectuer

### 1. Vérifier que l'API est démarrée

```bash
# Vérifier les processus en cours
netstat -ano | grep :3000

# Ou sur Linux/Mac
lsof -i :3000
```

### 2. Vérifier les logs de l'API

Les logs de l'API devraient afficher l'erreur exacte. Cherchez :
- Erreurs de compilation
- Erreurs de dépendances manquantes
- Erreurs de connexion à la base de données
- Erreurs dans les guards

### 3. Vérifier que l'API a été redémarrée

**IMPORTANT** : Après les modifications des guards, l'API DOIT être redémarrée.

```bash
# Arrêter l'API (Ctrl+C)
# Puis redémarrer
cd apps/api-server
npm run start:dev
```

### 4. Tester l'endpoint de login directement

```bash
# Test avec curl
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "s.akpovitohou@gmail.com",
    "password": "C@ptain.Yehioracadhub2021"
  }'

# Ou avec le script de test
cd apps/api-server
node test-login.js
```

### 5. Vérifier la base de données

```bash
# Vérifier la connexion
cd apps/api-server
node test-db-connection.js

# Vérifier qu'un utilisateur existe
npx prisma studio
# Ou via SQL
psql -U postgres -d academia_helm -c "SELECT email, role, \"tenantId\" FROM users LIMIT 5;"
```

### 6. Vérifier les variables d'environnement

```bash
cd apps/api-server
cat .env | grep -E "JWT_SECRET|DB_|DATABASE_URL"
```

**Variables requises** :
- `JWT_SECRET` : Clé secrète pour signer les tokens JWT
- `DATABASE_URL` : URL de connexion PostgreSQL
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`

## 🐛 Erreurs Communes

### Erreur 500 : "Internal server error"
- **Cause** : Erreur non gérée dans l'API
- **Solution** : Vérifier les logs de l'API pour l'erreur exacte

### Erreur : "Tenant ID not found"
- **Cause** : Les guards n'ont pas été mis à jour ou l'API n'a pas été redémarrée
- **Solution** : Redémarrer l'API après les modifications

### Erreur : "EACCES" (Next.js)
- **Cause** : Problème de connexion réseau ou l'API n'est pas accessible
- **Solution** : Vérifier que l'API est démarrée et accessible sur le port 3000

### Erreur : "Invalid credentials"
- **Cause** : Mauvais email/mot de passe ou utilisateur non créé
- **Solution** : Exécuter le seed : `npx prisma db seed`

## 📝 Prochaines Étapes

1. **Redémarrer l'API** avec les modifications des guards
2. **Vérifier les logs** pour identifier l'erreur exacte
3. **Tester le login** avec le script de test
4. **Vérifier la base de données** pour s'assurer qu'un utilisateur existe
