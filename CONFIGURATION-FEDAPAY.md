# 💳 Configuration FedaPay pour Academia Hub

**Date** : 2025-01-17  
**Version** : 1.0.0  
**Documentation FedaPay** : https://docs-v1.fedapay.com/

---

## 📋 Variables d'Environnement Requises

### Variables Obligatoires

```env
# ============================================================================
# INTÉGRATIONS - FEDAPAY (Paiements)
# ============================================================================

# Clé API FedaPay (obligatoire)
# Format : sk_live_... (production) ou sk_test_... (sandbox)
FEDAPAY_API_KEY=sk_test_votre_cle_api_fedapay

# Clé secrète API FedaPay (obligatoire pour certaines opérations)
# Format : sk_live_... (production) ou sk_test_... (sandbox)
FEDAPAY_SECRET_KEY=sk_test_votre_cle_secrete_fedapay

# Secret pour vérifier les webhooks FedaPay (obligatoire)
# Trouvé dans le dashboard FedaPay > Paramètres > Webhooks
FEDAPAY_WEBHOOK_SECRET=votre_webhook_secret_fedapay
```

### Variables Optionnelles

```env
# Mode d'environnement (sandbox ou production)
# Par défaut : sandbox
FEDAPAY_MODE=sandbox

# URL de base de l'API FedaPay
# Par défaut : https://api.fedapay.com
FEDAPAY_BASE_URL=https://api.fedapay.com
# OU
FEDAPAY_API_URL=https://api.fedapay.com

# URL de votre API pour les webhooks (obligatoire pour les webhooks)
# Format : https://votre-domaine.com/api/billing/fedapay/webhook
API_URL=https://api.academia-hub.com

# URLs des pages de paiement statiques FedaPay (optionnel)
# Si vous utilisez des pages de paiement pré-configurées dans FedaPay
FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL=https://fedapay.com/pages/votre-page-abonnement
FEDAPAY_STATIC_PAGE_MONTHLY_URL=https://fedapay.com/pages/votre-page-mensuel
```

---

## 🔑 Où Trouver les Clés FedaPay

### 1. Créer un Compte FedaPay

1. Allez sur [https://fedapay.com](https://fedapay.com)
2. Créez un compte ou connectez-vous
3. Accédez au **Dashboard**

### 2. Récupérer les Clés API

1. Dans le dashboard, allez dans **Paramètres** > **API Keys**
2. Vous trouverez :
   - **API Key** (clé publique) → `FEDAPAY_API_KEY`
   - **Secret Key** (clé secrète) → `FEDAPAY_SECRET_KEY`

**Format des clés** :
- **Sandbox (Test)** : `sk_test_...`
- **Production (Live)** : `sk_live_...`

### 3. Configurer les Webhooks

1. Dans le dashboard, allez dans **Paramètres** > **Webhooks**
2. Ajoutez une URL webhook :
   ```
   https://votre-domaine.com/api/billing/fedapay/webhook
   ```
3. Copiez le **Webhook Secret** → `FEDAPAY_WEBHOOK_SECRET`

---

## 📝 Configuration Complète dans `.env`

### Développement (Sandbox)

```env
# ============================================================================
# INTÉGRATIONS - FEDAPAY (Paiements) - SANDBOX
# ============================================================================
FEDAPAY_API_KEY=sk_test_votre_cle_api_sandbox
FEDAPAY_SECRET_KEY=sk_test_votre_cle_secrete_sandbox
FEDAPAY_WEBHOOK_SECRET=votre_webhook_secret_sandbox
FEDAPAY_MODE=sandbox
FEDAPAY_BASE_URL=https://api.fedapay.com
API_URL=http://localhost:3000
```

### Production (Live)

```env
# ============================================================================
# INTÉGRATIONS - FEDAPAY (Paiements) - PRODUCTION
# ============================================================================
FEDAPAY_API_KEY=sk_live_votre_cle_api_production
FEDAPAY_SECRET_KEY=sk_live_votre_cle_secrete_production
FEDAPAY_WEBHOOK_SECRET=votre_webhook_secret_production
FEDAPAY_MODE=production
FEDAPAY_BASE_URL=https://api.fedapay.com
API_URL=https://api.academia-hub.com
```

---

## 🔍 Utilisation dans le Code

### Service FedaPay Principal

**Fichier** : `apps/api-server/src/billing/services/fedapay.service.ts`

```typescript
// Utilise ces variables :
this.apiKey = this.configService.get<string>('FEDAPAY_API_KEY');
this.apiBaseUrl = this.configService.get<string>('FEDAPAY_API_URL') || 'https://api.fedapay.com';
```

### Service Payment Flows

**Fichier** : `apps/api-server/src/payment-flows/providers/fedapay.service.ts`

```typescript
// Utilise ces variables :
this.apiKey = process.env.FEDAPAY_API_KEY;
this.apiSecret = process.env.FEDAPAY_API_SECRET;
this.webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET;
this.baseUrl = process.env.FEDAPAY_BASE_URL || 'https://api.fedapay.com';
```

---

## 🌐 Configuration des Webhooks

### URL Webhook

L'URL webhook doit être configurée dans le dashboard FedaPay :

```
https://votre-domaine.com/api/billing/fedapay/webhook
```

### Endpoint dans l'Application

**Route** : `POST /api/billing/fedapay/webhook`

**Controller** : `apps/api-server/src/billing/billing.controller.ts`

```typescript
@Post('fedapay/webhook')
async handleFedaPayWebhook(@Body() body: any, @Headers() headers: any) {
  const signature = headers['x-fedapay-signature'] || headers['fedapay-signature'];
  return this.fedapayService.handleWebhook(body, signature);
}
```

### Vérification de Signature

Le service vérifie automatiquement la signature du webhook avec `FEDAPAY_WEBHOOK_SECRET` :

```typescript
verifyWebhookSignature(webhookData: any, signature: string): boolean {
  const webhookSecret = this.configService.get<string>('FEDAPAY_WEBHOOK_SECRET');
  // Vérification selon la documentation FedaPay
}
```

---

## 📚 Documentation FedaPay

### Liens Utiles

- **Documentation API** : https://docs-v1.fedapay.com/
- **Dashboard** : https://dashboard.fedapay.com
- **API Transactions** : https://docs-v1.fedapay.com/api/transactions
- **Webhooks** : https://docs-v1.fedapay.com/webhooks

### Endpoints FedaPay Utilisés

1. **Créer une Transaction**
   - `POST /v1/transactions`
   - Headers : `Authorization: Bearer {FEDAPAY_API_KEY}`

2. **Vérifier une Transaction**
   - `GET /v1/transactions/{id}`
   - Headers : `Authorization: Bearer {FEDAPAY_API_KEY}`

3. **Webhooks**
   - Reçoit les notifications de paiement
   - Vérifie la signature avec `FEDAPAY_WEBHOOK_SECRET`

---

## ✅ Checklist de Configuration

### Avant de Commencer

- [ ] Compte FedaPay créé
- [ ] Clés API récupérées (Sandbox et/ou Production)
- [ ] Webhook configuré dans le dashboard FedaPay
- [ ] Webhook Secret copié

### Configuration `.env`

- [ ] `FEDAPAY_API_KEY` défini
- [ ] `FEDAPAY_SECRET_KEY` défini (si utilisé)
- [ ] `FEDAPAY_WEBHOOK_SECRET` défini
- [ ] `FEDAPAY_MODE` défini (`sandbox` ou `production`)
- [ ] `FEDAPAY_BASE_URL` défini (optionnel, par défaut `https://api.fedapay.com`)
- [ ] `API_URL` défini pour les webhooks

### Test

- [ ] Test de création de transaction en sandbox
- [ ] Test de webhook en local (utiliser ngrok ou équivalent)
- [ ] Vérification de la signature du webhook
- [ ] Test en production (après validation sandbox)

---

## 🔒 Sécurité

### ⚠️ Important

1. **Ne jamais commiter les clés dans Git**
   - Le fichier `.env` doit être dans `.gitignore`
   - Utiliser des variables d'environnement système en production

2. **Utiliser des clés différentes pour chaque environnement**
   - Clés sandbox pour le développement
   - Clés production uniquement en production

3. **Protéger le Webhook Secret**
   - Ne jamais exposer dans le code client
   - Vérifier toujours la signature des webhooks

4. **Rotation des clés**
   - Changer régulièrement les clés en production
   - Régénérer les clés si compromission suspectée

---

## 🐛 Dépannage

### Erreur : "FEDAPAY_API_KEY not configured"

**Solution** :
1. Vérifier que `FEDAPAY_API_KEY` est défini dans `.env`
2. Redémarrer l'API Server après modification du `.env`
3. Vérifier que la clé commence par `sk_test_` (sandbox) ou `sk_live_` (production)

### Erreur : "Invalid FedaPay webhook signature"

**Solution** :
1. Vérifier que `FEDAPAY_WEBHOOK_SECRET` correspond au secret dans le dashboard FedaPay
2. Vérifier que l'URL webhook est correctement configurée
3. Vérifier que la signature est bien transmise dans les headers

### Erreur : "Failed to create payment transaction"

**Solution** :
1. Vérifier que les clés API sont valides
2. Vérifier que le mode (`sandbox`/`production`) correspond aux clés
3. Vérifier les logs FedaPay dans le dashboard
4. Vérifier la connexion internet et l'accessibilité de `https://api.fedapay.com`

---

## 📊 Exemple de Configuration Complète

```env
# ============================================================================
# INTÉGRATIONS - FEDAPAY (Paiements)
# ============================================================================

# Clés API (obligatoires)
FEDAPAY_API_KEY=sk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
FEDAPAY_SECRET_KEY=sk_test_xyz987wvu654tsr321qpo098nml765kji432hgf109edc876ba
FEDAPAY_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz

# Configuration (optionnelles)
FEDAPAY_MODE=sandbox
FEDAPAY_BASE_URL=https://api.fedapay.com
FEDAPAY_API_URL=https://api.fedapay.com

# URL de votre API pour les webhooks
API_URL=https://api.academia-hub.com

# Pages de paiement statiques (optionnel)
FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL=https://fedapay.com/pages/subscription
FEDAPAY_STATIC_PAGE_MONTHLY_URL=https://fedapay.com/pages/monthly
```

---

## 🎯 Résumé

| Variable | Obligatoire | Description | Exemple |
|---------|-------------|-------------|---------|
| `FEDAPAY_API_KEY` | ✅ Oui | Clé API publique FedaPay | `sk_test_...` |
| `FEDAPAY_SECRET_KEY` | ⚠️ Conditionnel | Clé secrète API (si utilisée) | `sk_test_...` |
| `FEDAPAY_WEBHOOK_SECRET` | ✅ Oui | Secret pour vérifier les webhooks | `whsec_...` |
| `FEDAPAY_MODE` | ⚠️ Optionnel | `sandbox` ou `production` | `sandbox` |
| `FEDAPAY_BASE_URL` | ⚠️ Optionnel | URL de l'API FedaPay | `https://api.fedapay.com` |
| `API_URL` | ✅ Oui | URL de votre API pour webhooks | `https://api.academia-hub.com` |

---

**Dernière mise à jour** : 2025-01-17  
**Documentation FedaPay** : https://docs-v1.fedapay.com/
