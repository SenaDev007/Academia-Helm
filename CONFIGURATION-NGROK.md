# Configuration de ngrok pour FedaPay Webhook

## ✅ Status

- ✅ ngrok installé (version 3.35.0)
- ⚠️ Configuration authtoken requise

## 📋 Étapes de configuration

### 1. Créer un compte ngrok (si pas déjà fait)

1. Aller sur : https://dashboard.ngrok.com/signup
2. Créer un compte gratuit
3. Récupérer votre authtoken depuis : https://dashboard.ngrok.com/get-started/your-authtoken

### 2. Configurer ngrok avec votre authtoken

Ouvrir un terminal et exécuter :

```bash
"C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe" config add-authtoken VOTRE_AUTHTOKEN_ICI
```

Remplacez `VOTRE_AUTHTOKEN_ICI` par le token récupéré depuis le dashboard ngrok.

### 3. Utiliser ngrok

#### Option A : Utiliser le script helper

```bash
# Démarrer ngrok pour le port 3000 (par défaut)
.\start-ngrok.bat

# Ou spécifier un autre port
.\start-ngrok.bat 3001
```

#### Option B : Utiliser directement

```bash
"C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe" http 3000
```

### 4. Récupérer l'URL publique

Après avoir démarré ngrok, vous verrez quelque chose comme :

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

Copiez l'URL `https://abc123.ngrok-free.app` (la vôtre sera différente).

### 5. URL complète du webhook FedaPay

Construisez l'URL du webhook ainsi :

```
https://abc123.ngrok-free.app/api/billing/fedapay/webhook
```

Remplacez `abc123.ngrok-free.app` par votre URL ngrok.

### 6. Configurer le webhook dans FedaPay

1. Aller dans FedaPay Sandbox → Webhooks
2. Cliquer sur "+ Nouveau webhook"
3. URL : `https://abc123.ngrok-free.app/api/billing/fedapay/webhook`
4. Désactiver la vérification SSL (ngrok gère HTTPS)
5. Activer "Désactiver le webhook lorsque l'application génère des erreurs"
6. Sélectionner les événements :
   - ✅ `transaction.approved`
   - ✅ `transaction.declined`
7. Cliquer sur "Créer"

### 7. Récupérer le secret webhook

Après création du webhook :
1. Ouvrir les détails du webhook dans FedaPay
2. Copier le "Webhook Secret" (commence par `whsec_`)
3. Ajouter dans `apps/api-server/.env` :

```env
FEDAPAY_WEBHOOK_SECRET=whsec_votre_secret_ici
```

### 8. Redémarrer le serveur backend

Après avoir ajouté le secret, redémarrer le serveur :

```bash
cd apps/api-server
npm run start:dev
```

## 🔧 Optionnel : Ajouter ngrok au PATH

Pour utiliser `ngrok` directement sans chemin complet :

1. Ouvrir "Variables d'environnement" dans Windows
2. Ajouter `C:\Users\HP\Downloads\ngrok-v3-stable-windows-386` au PATH
3. Redémarrer le terminal

Ensuite, vous pourrez utiliser simplement :
```bash
ngrok http 3000
```

## 📝 Notes importantes

- ⚠️ L'URL ngrok change à chaque redémarrage (version gratuite)
- ⚠️ Gardez ngrok actif pendant les tests
- ⚠️ En production, utilisez votre domaine réel, pas ngrok
- ✅ L'interface web de ngrok est disponible sur http://localhost:4040 (logs des requêtes)

## 🚀 Commandes utiles

```bash
# Démarrer ngrok pour le port 3000
.\start-ngrok.bat 3000

# Voir la version
"C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe" version

# Vérifier la configuration
"C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe" config check
```
