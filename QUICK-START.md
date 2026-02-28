# 🚀 Démarrage Rapide - Academia Hub (Sans Docker)

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## ✅ Prérequis

- ✅ PostgreSQL installé et démarré localement
- ✅ Node.js et npm installés
- ✅ Dépendances installées (`npm install` dans chaque dossier)

---

## 🎯 Démarrage en 2 Étapes

### Étape 1 : Vérifier PostgreSQL

**Windows** :
```cmd
# Vérifier que le service PostgreSQL est démarré
# Ouvrir "Services" (services.msc) et vérifier que "PostgreSQL" est "En cours d'exécution"
```

**Linux/Mac** :
```bash
# Vérifier que PostgreSQL est démarré
pg_isready -h localhost -p 5432
```

Si PostgreSQL n'est pas démarré :
- **Windows** : Démarrer le service PostgreSQL dans "Services"
- **Linux** : `sudo systemctl start postgresql`
- **Mac** : `brew services start postgresql`

---

### Étape 2 : Démarrer l'Application

**Windows** :
```cmd
# Dans le dossier racine du projet
cd "D:\Projet YEHI OR Tech\Academia Hub Web"

# Démarrer avec le script orchestré
start-dev.bat
```

**Linux/Mac** :
```bash
# Dans le dossier racine du projet
cd "/chemin/vers/Academia Hub Web"

# Démarrer avec le script orchestré
./start-dev.sh
```

---

## 📊 Ce qui se passe automatiquement

Le script fait tout automatiquement :

1. ✅ **Vérifie PostgreSQL** - S'assure que PostgreSQL est accessible
2. ✅ **Applique les migrations** - Met à jour la base de données si nécessaire
3. ✅ **Démarre l'API** - Lance le serveur NestJS sur le port 3000
4. ✅ **Vérifie l'API** - Attend que l'API soit prête (health check)
5. ✅ **Démarre le Frontend** - Lance Next.js sur le port 3001

---

## 🌐 URLs

Une fois démarré, vous pouvez accéder à :

- **API** : http://localhost:3000/api
- **Frontend** : http://localhost:3001
- **Health Check** : http://localhost:3000/api/health

---

## 🛑 Arrêter l'Application

Appuyez sur **Ctrl+C** dans le terminal où le script tourne.

Le script arrêtera automatiquement l'API et le Frontend.

---

## 🐛 Problèmes Courants

### Erreur : "PostgreSQL n'est pas accessible"

**Solution** :
1. Vérifier que PostgreSQL est démarré (voir Étape 1)
2. Vérifier que le port 5432 n'est pas utilisé par un autre service

### Erreur : "API Server n'a pas démarré dans les temps"

**Solution** :
1. Vérifier les logs : `tail -f /tmp/academia-hub/api-server.log` (Linux/Mac)
2. Vérifier que le port 3000 n'est pas utilisé
3. Vérifier le fichier `.env` dans `apps/api-server/`

### Erreur : "Cannot find module"

**Solution** :
```bash
# Installer les dépendances
cd apps/api-server
npm install
cd ../web-app
npm install
```

---

## 📝 Variables d'Environnement

Assurez-vous que ces fichiers existent :

### `apps/api-server/.env`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academia_helm
PORT=3000
FRONTEND_URL=http://localhost:3001
```

### `apps/web-app/.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

---

## ✅ Checklist de Démarrage

- [ ] PostgreSQL est démarré
- [ ] Base de données `academia_helm` existe
- [ ] Fichier `.env` dans `apps/api-server/` configuré
- [ ] Fichier `.env.local` dans `apps/web-app/` configuré
- [ ] Dépendances installées (`npm install` dans chaque dossier)
- [ ] Être dans le dossier racine du projet
- [ ] Exécuter `start-dev.bat` (Windows) ou `./start-dev.sh` (Linux/Mac)

---

## 🎯 C'est tout !

Pas besoin de Docker, pas besoin de configuration complexe.

Juste :
1. PostgreSQL démarré
2. `start-dev.bat` ou `./start-dev.sh`

Et c'est parti ! 🚀

---

**Dernière mise à jour** : 2025-01-17
