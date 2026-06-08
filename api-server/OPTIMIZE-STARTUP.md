# ⚡ Optimisation du Démarrage de l'API

## 🐌 Problème

Le serveur API prend trop de temps à démarrer (plus de 30 secondes).

## ✅ Solutions Appliquées

### 1. Connexion Lazy à la Base de Données

La connexion Prisma peut maintenant être différée jusqu'à la première requête en ajoutant dans `.env` :

```env
SKIP_DB_CHECK=true
```

Cela permet au serveur de démarrer immédiatement sans attendre la connexion DB.

### 2. Vérification Optionnelle de la DB

En développement, la vérification de la connexion DB est optionnelle. Pour l'activer :

```env
VERIFY_DB=true
```

## 🚀 Utilisation Rapide

Pour un démarrage ultra-rapide en développement, ajoutez dans `apps/api-server/.env` :

```env
SKIP_DB_CHECK=true
```

Le serveur démarrera en quelques secondes. La connexion DB se fera automatiquement à la première requête.

## ⚠️ Notes

- En **production**, la vérification DB est toujours active
- La connexion lazy fonctionne bien pour le développement
- Pour les tests, utilisez `VERIFY_DB=true` pour s'assurer que la DB est accessible

## 📊 Temps de Démarrage

- **Avant** : 30-60 secondes
- **Après (SKIP_DB_CHECK=true)** : 3-5 secondes
