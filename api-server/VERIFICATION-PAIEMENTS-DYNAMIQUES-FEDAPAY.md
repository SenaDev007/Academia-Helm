# Vérification - Paiements Dynamiques FedaPay

## ✅ Conformité avec la Documentation FedaPay

### 1. Création de Transactions (API)

**Documentation FedaPay** : https://docs.fedapay.com/api/transactions#create-a-transaction

**Endpoint** : `POST /v1/transactions`

**Structure requise** :
```json
{
  "transaction": {
    "amount": 100000,
    "description": "Description",
    "callback_url": "https://...",
    "customer": {
      "email": "...",
      "firstname": "...",
      "lastname": "...",
      "phone_number": "..."
    },
    "metadata": {}
  }
}
```

**✅ Implémentation** : `FedaPayService.createTransaction()`
- ✅ Structure conforme : `{ transaction: { ... } }`
- ✅ Headers corrects : `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
- ✅ Gestion des erreurs : Vérification `response.ok`, parsing des erreurs
- ✅ Extraction de la réponse : `result.transaction || result`
- ✅ Retour des champs requis : `transactionId`, `reference`, `paymentUrl`, `status`, `amount`

### 2. Souscription Initiale (Onboarding)

**✅ Implémentation** : `FedaPayService.createOnboardingPaymentSession()`

**Fonctionnalités** :
- ✅ Montant calculé via `PricingService.calculateInitialPaymentPrice()` (paramétrable)
- ✅ Création de transaction via API FedaPay
- ✅ Support pages statiques (si `FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL` configuré)
- ✅ Support API dynamique (par défaut)
- ✅ Métadonnées complètes : `draftId`, `paymentId`, `reference`, `type`, `webhookUrl`
- ✅ Informations client : email, prénom, nom, téléphone
- ✅ Callback URL configurée
- ✅ Webhook URL configurée

**Endpoint** : `POST /billing/fedapay/create-onboarding-payment`

### 3. Paiement Mensuel/Annuel (Renouvellement)

**✅ Implémentation** : `FedaPayService.createRenewalPaymentSession()` (NOUVEAU)

**Fonctionnalités** :
- ✅ Montant calculé via `PricingService.calculateRenewalPrice()` (paramétrable)
- ✅ Création de transaction via API FedaPay
- ✅ Support pages statiques (si `FEDAPAY_STATIC_PAGE_MONTHLY_URL` configuré)
- ✅ Support API dynamique (par défaut)
- ✅ Métadonnées complètes : `subscriptionId`, `billingEventId`, `reference`, `type`, `cycle`, `webhookUrl`
- ✅ Informations client : email, prénom, nom, téléphone (depuis promoteur)
- ✅ Callback URL configurée
- ✅ Webhook URL configurée
- ✅ Création de `BillingEvent` avec type `RENEWAL`
- ✅ Détection automatique du cycle (MONTHLY/YEARLY)

**Endpoint** : `POST /billing/fedapay/create-renewal-payment`

### 4. Webhook FedaPay

**Documentation FedaPay** : https://docs.fedapay.com/webhooks#verify-webhook-signature

**✅ Implémentation** : `FedaPayService.handleWebhook()`

**Vérifications de sécurité** :
- ✅ Signature webhook : `verifyWebhookSignature()` avec HMAC SHA256
- ✅ Event type : `transaction.approved`, `transaction.declined`, etc.
- ✅ Transaction status : Vérification `approved` ou `declined`
- ✅ Montant : Vérification serveur (montant attendu vs montant reçu)
- ✅ Reference connue : Recherche dans `OnboardingPayment` ou `BillingEvent`
- ✅ Idempotence : Table `PaymentWebhookLog` pour éviter les doublons

**Gestion des événements** :
- ✅ `transaction.approved` → `handlePaymentSuccess()`
- ✅ `transaction.declined` → `handlePaymentFailure()`
- ✅ Support onboarding ET renewal dans `handlePaymentSuccess()`

**Endpoint** : `POST /billing/fedapay/webhook`

### 5. Structure des Réponses FedaPay

**Réponse attendue** :
```json
{
  "transaction": {
    "id": "...",
    "reference": "...",
    "payment_url": "...",
    "status": "pending",
    "amount": 100000
  }
}
```

**✅ Implémentation** :
- ✅ Extraction : `result.transaction || result`
- ✅ Fallback : `transaction.payment_url || transaction.url || transaction.paymentUrl`
- ✅ Validation : Vérification de `transaction.id`
- ✅ Logging : Log des transactions créées

## 📋 Résumé des Endpoints

### Backend API

1. **Souscription Initiale** :
   - `POST /billing/fedapay/create-onboarding-payment`
   - Body : `{ draftId: string }`
   - Retour : `{ paymentId, reference, paymentUrl, amount, status }`

2. **Renouvellement** :
   - `POST /billing/fedapay/create-renewal-payment`
   - Body : `{ subscriptionId: string }`
   - Retour : `{ billingEventId, reference, paymentUrl, amount, cycle, status }`

3. **Webhook** :
   - `POST /billing/fedapay/webhook`
   - Headers : `x-fedapay-signature` (ou variantes)
   - Body : Payload FedaPay

## 🔧 Configuration Requise

### Variables d'Environnement

```env
# FedaPay API
FEDAPAY_API_KEY=pk_sandbox_... ou pk_live_...
FEDAPAY_API_URL=https://sandbox-api.fedapay.com ou https://api.fedapay.com
FEDAPAY_WEBHOOK_SECRET=whsec_...

# Pages statiques (optionnel)
FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL=https://sandbox-me.fedapay.com/zc6PFcSr
FEDAPAY_STATIC_PAGE_MONTHLY_URL=https://sandbox-me.fedapay.com/WWJQrruC

# URLs
FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000
```

## ✅ Points de Conformité

### Structure API
- ✅ Payload conforme : `{ transaction: { ... } }`
- ✅ Headers corrects : `Authorization: Bearer`, `Content-Type: application/json`
- ✅ Endpoint correct : `/v1/transactions`

### Gestion des Paiements
- ✅ Souscription initiale : Implémentée
- ✅ Renouvellement mensuel/annuel : Implémentée
- ✅ Support pages statiques : Implémenté
- ✅ Support API dynamique : Implémenté

### Sécurité
- ✅ Vérification signature webhook : Implémentée
- ✅ Vérification montant : Implémentée
- ✅ Idempotence : Implémentée via `PaymentWebhookLog`
- ✅ Validation référence : Implémentée

### Métadonnées
- ✅ Métadonnées complètes : `draftId`, `paymentId`, `subscriptionId`, `billingEventId`, `type`, `cycle`
- ✅ Informations client : email, prénom, nom, téléphone
- ✅ Callback et webhook URLs : Configurées

## 🎯 Conclusion

**✅ TOUS LES POINTS SONT CONFORMES À LA DOCUMENTATION FEDAPAY**

- ✅ Structure API conforme
- ✅ Souscription initiale implémentée
- ✅ Paiement mensuel/annuel implémenté
- ✅ Webhook sécurisé implémenté
- ✅ Support pages statiques et API dynamique
- ✅ Gestion des erreurs complète
- ✅ Idempotence garantie

---

**Date** : Vérification complète des paiements dynamiques FedaPay ✅
