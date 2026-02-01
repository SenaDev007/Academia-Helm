# ⚡ Démarrage Rapide de l'API

## 🚀 Solution pour Démarrage Rapide

Pour accélérer le démarrage du serveur API, ajoutez cette ligne dans `apps/api-server/.env` :

```env
SKIP_DB_CHECK=true
```

## 📋 Ce que ça fait

- ✅ Le serveur démarre **immédiatement** sans attendre la connexion DB
- ✅ La connexion DB se fait **lazy** (à la première requête)
- ✅ Gain de temps : **30-60s → 3-5s**

## 🔄 Redémarrer le Serveur

Après avoir ajouté la variable, redémarrez le serveur :

```bash
cd apps/api-server
npm run start:dev
```

## ⚠️ Important

- Cette option est **uniquement pour le développement**
- En production, la vérification DB est toujours active
- La première requête peut être légèrement plus lente (connexion DB)

## ✅ Vérification

Une fois le serveur démarré, testez :

```bash
curl http://localhost:3000/api/public/schools/list
```

Le serveur devrait répondre rapidement !
