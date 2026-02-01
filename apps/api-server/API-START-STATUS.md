# 🚀 Statut du Démarrage de l'API

## ✅ Serveur API Démarré

Le serveur API backend a été démarré en arrière-plan avec la commande :

```bash
cd apps/api-server
npm run start:dev
```

## ⏱️ Temps de Démarrage

Le serveur NestJS peut prendre **30-60 secondes** pour démarrer complètement, surtout lors du premier démarrage après compilation.

## 🔍 Vérification

### 1. Vérifier que le serveur écoute sur le port 3000

```bash
netstat -ano | findstr :3000
```

Vous devriez voir une ligne avec `LISTENING` sur le port 3000.

### 2. Tester l'endpoint des écoles

```bash
curl http://localhost:3000/api/public/schools/list
```

Ou depuis le navigateur :
```
http://localhost:3000/api/public/schools/list
```

### 3. Vérifier les logs du serveur

Le serveur devrait afficher :
```
🚀 Academia Hub API Server is running on: http://localhost:3000/api
```

## 📋 Endpoints Disponibles

Une fois le serveur démarré, les endpoints suivants devraient être disponibles :

- ✅ `GET /api/public/schools/list` - Liste des écoles
- ✅ `GET /api/public/schools/search?q=...` - Recherche d'écoles
- ✅ `POST /api/auth/login` - Connexion
- ✅ `POST /api/auth/dev-login` - Connexion développement

## 🐛 Dépannage

### Le serveur ne démarre pas

1. Vérifier que le port 3000 n'est pas déjà utilisé :
   ```bash
   netstat -ano | findstr :3000
   ```

2. Vérifier les logs d'erreur dans le terminal

3. Vérifier que PostgreSQL est démarré :
   ```bash
   cd apps/api-server
   npm run test:db
   ```

### L'endpoint retourne 404

1. Vérifier que `PortalModule` est bien dans les imports de `app.module.ts`
2. Redémarrer le serveur après modification

### Le serveur prend trop de temps

- C'est normal lors du premier démarrage
- Les démarrages suivants sont plus rapides grâce au cache
- En mode développement, le serveur redémarre automatiquement après chaque modification

## 🎯 Prochaines Étapes

Une fois le serveur démarré :

1. ✅ Tester l'endpoint `/api/public/schools/list`
2. ✅ Vérifier que les 2 écoles apparaissent
3. ✅ Tester le sélecteur sur `/portal`
4. ✅ Tester les logins avec différents utilisateurs
