# Instructions - Configuration Pages de Paiement FedaPay

## 📋 Pages Créées

Vous avez créé deux pages de paiement dans FedaPay Sandbox :

1. **Souscription Initiale** : https://sandbox-me.fedapay.com/zc6PFcSr
   - Montant : 100 000 FCFA (fixe)
   - Usage : Paiement initial onboarding

2. **Paiement Mensuel** : https://sandbox-me.fedapay.com/WWJQrruC
   - Montant : Variable (selon plan)
   - Usage : Renouvellement mensuel

## ⚙️ Configuration dans .env

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

**Ou utilisez le script** :
```bash
cd apps/api-server
bash add-fedapay-pages-env.sh
```

### Option 2 : Utiliser l'API Dynamique (Recommandé pour production)

Ne pas définir `FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL` dans `.env`.

Le système créera automatiquement des transactions via l'API FedaPay.

## 🔧 Comment ça fonctionne maintenant

### Avec Pages Statiques (si configuré)

1. L'utilisateur complète l'onboarding
2. Le backend génère une référence unique
3. L'utilisateur est redirigé vers la page statique avec les paramètres :
   - `callback_url` : URL de retour après paiement
   - `reference` : Référence unique du paiement
   - `metadata` : Métadonnées (draftId, paymentId)
4. Après paiement, FedaPay redirige vers `callback_url`
5. Le webhook FedaPay notifie le backend

### Avec API Dynamique (par défaut)

1. L'utilisateur complète l'onboarding
2. Le backend crée une transaction FedaPay via l'API
3. FedaPay retourne une `payment_url` unique
4. L'utilisateur est redirigé vers cette URL
5. Après paiement, le webhook notifie le backend

## ⚠️ Configuration Importante des Pages FedaPay

### Page Souscription Initiale

**URL** : https://sandbox-me.fedapay.com/zc6PFcSr

**Vérifiez dans FedaPay** :
- ✅ Montant fixe : 100 000 FCFA
- ✅ Collecte téléphone : Activé
- ✅ Lien de retour : Configuré vers votre frontend
- ✅ Webhook : Configuré vers votre backend

### Page Paiement Mensuel

**URL** : https://sandbox-me.fedapay.com/WWJQrruC

**Note** : Pour les paiements mensuels, il est recommandé d'utiliser l'API dynamique car le montant varie selon le plan choisi.

## 🔄 Prochaines Étapes

1. **Ajouter les variables dans `.env`** :
   ```bash
   cd apps/api-server
   bash add-fedapay-pages-env.sh
   ```

2. **Configurer le webhook FedaPay** (si pas déjà fait) :
   - URL : `https://votre-url-ngrok.ngrok.io/api/billing/fedapay/webhook`
   - Événements : `transaction.approved`, `transaction.declined`

3. **Tester** :
   - Compléter l'onboarding
   - Vérifier la redirection vers la page FedaPay
   - Effectuer un paiement de test
   - Vérifier la réception du webhook

## 📝 Notes

- **Webhook obligatoire** : Que vous utilisiez les pages statiques ou l'API, le webhook doit être configuré
- **Signature webhook** : Le secret webhook doit être configuré dans `.env`
- **Callback URL** : Doit pointer vers votre frontend pour rediriger l'utilisateur après paiement

---

**Date** : Configuration pages de paiement ✅
