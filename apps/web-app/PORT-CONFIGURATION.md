# 🔌 Configuration des Ports - API et Frontend

## 📋 Configuration Actuelle

### API Server (NestJS)
- **Port** : `3000`
- **Configuration** : `apps/api-server/.env`
  ```env
  PORT=3000
  ```
- **Fichier** : `apps/api-server/src/main.ts`
  ```typescript
  const port = process.env.PORT || 3000;
  ```

### Frontend (Next.js)
- **Port** : `3001`
- **Configuration** : `apps/web-app/.env.local`
  ```env
  PORT=3001
  ```
- **Script** : `apps/web-app/package.json`
  ```json
  "dev": "next dev -p 3001"
  ```

## ✅ Solution Appliquée

### Problème
Next.js ne lit **pas automatiquement** la variable `PORT` depuis `.env.local` pour le serveur de développement. Par défaut, Next.js utilise le port `3000`, ce qui créait un conflit avec l'API.

### Correction
Modification du script `dev` dans `package.json` pour utiliser explicitement le port `3001` via l'option `-p 3001` :
- Le port est maintenant **hardcodé** dans le script pour éviter tout conflit
- Compatible avec Windows, macOS et Linux
- Simple et fiable

## 🚀 Démarrage

### API Server
```bash
cd apps/api-server
npm run start:dev
# ✅ Démarré sur http://localhost:3000/api
```

### Frontend
```bash
cd apps/web-app
npm run dev
# ✅ Démarré sur http://localhost:3001
```

## 🔍 Vérification

Vérifier que les ports sont corrects :

```bash
# Vérifier le port de l'API
netstat -ano | findstr :3000

# Vérifier le port du frontend
netstat -ano | findstr :3001
```

## ⚠️ Notes Importantes

1. **Ports différents** : L'API et le frontend doivent utiliser des ports différents
2. **Variables d'environnement** : Les ports peuvent être surchargés via les variables d'environnement
3. **Production** : En production, les ports sont généralement gérés par le serveur web (Nginx, etc.)
