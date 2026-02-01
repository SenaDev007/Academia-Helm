# Configuration des Pages de Paiement FedaPay

## 📋 Pages Créées

Vous avez créé deux pages de paiement dans FedaPay Sandbox :

1. **Souscription Initiale** : https://sandbox-me.fedapay.com/zc6PFcSr
   - Montant : 100 000 FCFA (fixe)
   - Usage : Paiement initial onboarding

2. **Paiement Mensuel** : https://sandbox-me.fedapay.com/WWJQrruC
   - Montant : Variable (selon plan)
   - Usage : Renouvellement mensuel

## ⚙️ Configuration

### Option 1 : Utiliser les Pages Statiques (Recommandé pour tests)

Ajoutez dans `apps/api-server/.env` :

```env
# Pages de paiement statiques FedaPay
FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL=https://sandbox-me.fedapay.com/zc6PFcSr
FEDAPAY_STATIC_PAGE_MONTHLY_URL=https://sandbox-me.fedapay.com/WWJQrruC

# URLs de callback
FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000
```

**Avantages** :
- ✅ Configuration simple
- ✅ Pas besoin de créer des transactions via API
- ✅ Idéal pour les tests

**Inconvénients** :
- ⚠️ Montant fixe (100 000 FCFA pour souscription)
- ⚠️ Moins flexible pour les paiements mensuels variables

### Option 2 : Utiliser l'API Dynamique (Recommandé pour production)

Ne pas définir `FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL` dans `.env`.

Le système créera automatiquement des transactions via l'API FedaPay.

**Avantages** :
- ✅ Montant calculé dynamiquement (paramétrable)
- ✅ Métadonnées spécifiques par paiement
- ✅ Plus flexible

**Inconvénients** :
- ⚠️ Nécessite une clé API valide
- ⚠️ Plus complexe à configurer

## 🔧 Configuration Recommandée

### Pour les Tests (Sandbox)

```env
# Utiliser les pages statiques
FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL=https://sandbox-me.fedapay.com/zc6PFcSr
FEDAPAY_STATIC_PAGE_MONTHLY_URL=https://sandbox-me.fedapay.com/WWJQrruC

# FedaPay Configuration
FEDAPAY_API_KEY=pk_sandbox_wqOUAg2XKEdY1wScET0R4TCv
FEDAPAY_API_URL=https://sandbox-api.fedapay.com
FEDAPAY_WEBHOOK_SECRET=whsec_votre_secret_ici

# URLs
FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000
```

### Pour la Production

```env
# Ne pas utiliser les pages statiques (utiliser l'API)
# FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL=  # Commenté ou non défini

# FedaPay Configuration
FEDAPAY_API_KEY=pk_live_votre_cle_live
FEDAPAY_API_URL=https://api.fedapay.com
FEDAPAY_WEBHOOK_SECRET=whsec_votre_secret_live

# URLs Production
FRONTEND_URL=https://academiahub.com
API_URL=https://api.academiahub.com
```

## 📝 Configuration des Pages FedaPay

### Page Souscription Initiale

**URL** : https://sandbox-me.fedapay.com/zc6PFcSr

**Configuration recommandée** :
- ✅ Montant fixe : 100 000 FCFA
- ✅ Collecte téléphone : Activé
- ✅ Lien de retour : `http://localhost:3001/onboarding/callback` (dev) ou votre URL de production
- ✅ Message de succès : "Merci pour votre paiement ! Votre établissement sera activé sous peu."

### Page Paiement Mensuel

**URL** : https://sandbox-me.fedapay.com/WWJQrruC

**Note** : Pour les paiements mensuels, il est recommandé d'utiliser l'API dynamique car le montant varie selon le plan choisi.

## 🔄 Comment ça fonctionne

### Avec Pages Statiques

1. L'utilisateur complète l'onboarding
2. Le backend génère une référence unique
3. L'utilisateur est redirigé vers la page statique avec les paramètres :
   - `callback_url` : URL de retour après paiement
   - `reference` : Référence unique du paiement
   - `metadata` : Métadonnées (draftId, paymentId)
4. Après paiement, FedaPay redirige vers `callback_url`
5. Le webhook FedaPay notifie le backend

### Avec API Dynamique

1. L'utilisateur complète l'onboarding
2. Le backend crée une transaction FedaPay via l'API
3. FedaPay retourne une `payment_url` unique
4. L'utilisateur est redirigé vers cette URL
5. Après paiement, le webhook notifie le backend

## ⚠️ Important

- **Webhook obligatoire** : Que vous utilisiez les pages statiques ou l'API, le webhook doit être configuré
- **Signature webhook** : Le secret webhook doit être configuré dans `.env`
- **Callback URL** : Doit pointer vers votre frontend pour rediriger l'utilisateur après paiement

## 🧪 Test

1. Démarrer le serveur backend
2. Compléter l'onboarding
3. Vérifier la redirection vers la page FedaPay
4. Effectuer un paiement de test
5. Vérifier la réception du webhook
6. Vérifier l'activation du tenant

---

**Date** : Configuration pages de paiement FedaPay ✅
