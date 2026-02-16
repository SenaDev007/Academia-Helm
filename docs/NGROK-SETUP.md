# 🚀 Configuration ngrok pour FedaPay

## Étape 1 : Créer un compte ngrok (si pas déjà fait)

1. Aller sur https://ngrok.com
2. Cliquer sur "Sign up" (gratuit)
3. Créer un compte avec votre email
4. Une fois connecté, aller sur : https://dashboard.ngrok.com/get-started/your-authtoken
5. **Copier votre authtoken** (exemple : `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5`)

## Étape 2 : Configurer ngrok (une seule fois)

```bash
ngrok config add-authtoken VOTRE_AUTHTOKEN_ICI
```

Remplacez `VOTRE_AUTHTOKEN_ICI` par l'authtoken que vous avez copié.

## Étape 3 : Démarrer les tunnels

Vous avez besoin de **2 tunnels** : un pour le frontend (port 3001) et un pour l'API (port 3000).

### Option A : Un seul tunnel à la fois (pour tester)

**Terminal 1 - Frontend :**
```bash
ngrok http 3001
```

**Terminal 2 - API :**
```bash
ngrok http 3000
```

### Option B : Deux tunnels en même temps (recommandé)

Ouvrir **2 terminaux séparés** :

**Terminal 1 (Frontend) :**
```bash
ngrok http 3001
```

**Terminal 2 (API) :**
```bash
ngrok http 3000
```

## Étape 4 : Récupérer les URLs

Dans chaque terminal ngrok, vous verrez :

```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:3001
```

**Copiez l'URL `https://xxxx-xx-xx-xx-xx.ngrok-free.app`** (celle qui commence par `https://`)

## Étape 5 : Mettre à jour le .env

Dans `apps/api-server/.env`, remplacer :

```env
FRONTEND_URL=https://VOTRE_URL_FRONTEND_NGROK.ngrok-free.app
API_URL=https://VOTRE_URL_API_NGROK.ngrok-free.app
```

**Important :** Redémarrer l'API après modification du `.env`

### Si après paiement vous voyez "The endpoint is offline" (ERR_NGROK_3200)

Cela signifie que l’URL de callback (FRONTEND_URL) n’est plus valide :

1. **Relancez ngrok** pour le frontend : `ngrok http 3001`
2. **Copiez la nouvelle URL** affichée (Forwarding) — avec ngrok gratuit elle change à chaque démarrage
3. **Mettez à jour** `FRONTEND_URL` dans `apps/api-server/.env` avec cette URL
4. **Redémarrez l’API** (sinon l’ancienne URL reste utilisée pour le callback)
5. **Gardez la fenêtre ngrok ouverte** pendant tout le test (création du paiement + paiement + redirection)

Si vous utilisiez localtunnel pour l’API et qu’il affiche "connection refused", utilisez un **second tunnel ngrok** pour le port 3000 et mettez `API_URL` à cette URL ngrok.

## Étape 6 : Configurer le webhook dans FedaPay

1. Se connecter au dashboard FedaPay sandbox : https://dashboard.fedapay.com
2. Aller dans **Settings** > **Webhooks**
3. Cliquer sur **Add Webhook**
4. URL du webhook : `https://VOTRE_URL_API_NGROK.ngrok-free.app/api/billing/fedapay/webhook`
5. Sélectionner les événements :
   - ✅ `transaction.approved`
   - ✅ `transaction.declined`
   - ✅ `transaction.failed`
6. Cliquer sur **Save**

## ⚠️ Notes importantes

- Les URLs ngrok changent à chaque redémarrage (sauf avec un compte payant)
- Gardez les terminaux ngrok ouverts pendant vos tests
- Si vous redémarrez ngrok, mettez à jour le `.env` et le webhook FedaPay

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. Les tunnels ngrok sont actifs (2 terminaux ouverts)
2. Le `.env` contient les bonnes URLs ngrok
3. L'API a été redémarrée
4. Le webhook est configuré dans FedaPay
5. Tester un paiement et vérifier les logs backend
