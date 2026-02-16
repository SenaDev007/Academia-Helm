# 🔍 Debug - Pourquoi le paiement FedaPay échoue

## 📋 Problèmes identifiés

### 1. ⚠️ **Callback URL inaccessible (localhost)**

**Problème** : Le callback URL est configuré comme `http://localhost:3001/onboarding/callback?draftId=...`

**Pourquoi ça échoue** :
- FedaPay ne peut pas accéder à `localhost` depuis ses serveurs
- Après le paiement, FedaPay essaie de rediriger vers cette URL mais échoue
- Cela peut causer l'échec de la transaction

**Solution** :
- Utiliser un tunnel public (ngrok, Cloudflare Tunnel, etc.)
- Configurer `FRONTEND_URL` avec l'URL publique du tunnel

```bash
# Exemple avec ngrok
ngrok http 3001

# Puis dans .env (api-server)
FRONTEND_URL=https://votre-tunnel.ngrok.io
```

### 2. ⚠️ **Webhook URL inaccessible**

**Problème** : Le webhook URL est configuré comme `http://localhost:3000/api/billing/fedapay/webhook`

**Pourquoi ça échoue** :
- FedaPay ne peut pas envoyer les webhooks vers `localhost`
- Les événements de transaction (succès/échec) ne sont pas reçus
- Le backend ne peut pas mettre à jour le statut du paiement

**Solution** :
- Utiliser un tunnel public pour l'API aussi
- Configurer `API_URL` avec l'URL publique du tunnel

```bash
# Exemple avec ngrok (2 tunnels)
ngrok http 3000  # Pour l'API
ngrok http 3001  # Pour le frontend

# Puis dans .env (api-server)
API_URL=https://votre-tunnel-api.ngrok.io
FRONTEND_URL=https://votre-tunnel-frontend.ngrok.io
```

### 3. ⚠️ **Numéro de téléphone de test invalide**

**Problème** : Le numéro saisi peut simuler un échec en sandbox FedaPay.

**Pourquoi ça échoue** :
- En sandbox, FedaPay simule succès ou échec selon le numéro (ex. opérateur **Momo Test**).
- Seuls certains numéros sont considérés comme « paiement réussi ».

**Solution – Obtenir un paiement approuvé en sandbox** :
- Avec l’opérateur **Momo Test** (sandbox), utiliser l’un des numéros de **succès** :
  - **64000001**
  - **66000001**
- Vous pouvez les préfixer par l’indicatif pays (ex. **229** pour le Bénin) : `22964000001` ou `22966000001`.
- Tout autre numéro simule un **transaction.declined** (paiement refusé).

### 4. ⚠️ **Page FedaPay : icône d’avertissement sans formulaire de paiement**

**Problème** : Après avoir cliqué sur « Payer », la page FedaPay n’affiche pas le formulaire (numéro, opérateur) mais seulement une icône d’avertissement.

**Cause possible** : En sandbox, FedaPay attend le mode **momo_test**. Si la transaction est créée avec un autre mode (ex. mtn_open), la page de paiement peut afficher une erreur générique.

**Solution** : L’API utilise désormais automatiquement `momo_test` en sandbox. Redémarrez l’API et recréez une session de paiement. Si le problème persiste, vérifiez les logs API au moment de la création de la transaction (callback_url valide, montant ≤ 20 000 XOF en sandbox).

### 5. ⚠️ **Webhook non configuré dans FedaPay**

**Problème** : Le webhook n'est peut-être pas configuré dans le compte FedaPay

**Pourquoi ça échoue** :
- FedaPay ne peut pas notifier le backend des changements de statut
- Les transactions restent en "pending" même après paiement

**Solution** :
1. Se connecter au dashboard FedaPay (sandbox)
2. Aller dans Settings > Webhooks
3. Ajouter le webhook URL : `https://votre-tunnel-api.ngrok.io/api/billing/fedapay/webhook`
4. Sélectionner les événements : `transaction.approved`, `transaction.declined`, `transaction.failed`

## 🔧 Solutions immédiates

### Solution 1 : Utiliser ngrok pour le développement

```bash
# Terminal 1 : Tunnel pour le frontend
ngrok http 3001

# Terminal 2 : Tunnel pour l'API
ngrok http 3000

# Mettre à jour .env (api-server)
FRONTEND_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
API_URL=https://yyyy-yy-yy-yy-yy.ngrok-free.app
```

**Important** : Redémarrer l'API après modification du `.env`

### Solution 2 : Vérifier les logs FedaPay

1. Se connecter au dashboard FedaPay sandbox
2. Aller dans Transactions
3. Vérifier les détails de la transaction échouée
4. Regarder les messages d'erreur spécifiques

### Solution 3 : Tester avec un numéro de succès sandbox

Utiliser **64000001** ou **66000001** (ou avec indicatif pays, ex. **22964000001**) dans le formulaire FedaPay (opérateur Momo Test) pour obtenir un `transaction.approved`.

### Solution 4 : Simuler un webhook « approved » en dev (sans FedaPay)

Pour tester la création du tenant sans refaire un vrai paiement FedaPay :

1. Créer une session de paiement onboarding comme d’habitude (vous obtenez un `paymentId`).
2. Appeler l’endpoint **dev uniquement** (désactivé en production) :

```http
POST /api/billing/fedapay/simulate-approved
Content-Type: application/json

{ "paymentId": "<votre-paymentId>" }
```

3. Le backend traite ce cas comme un `transaction.approved` : mise à jour du paiement, du draft et création du tenant comme pour un vrai webhook.

**Note** : En production cet endpoint retourne 400. Utiliser uniquement en développement (`NODE_ENV !== 'production'`).

## 📊 Vérifications à faire

### 1. Vérifier les logs backend

```bash
# Chercher les erreurs FedaPay dans les logs
grep -i "fedapay" logs/api-server.log
grep -i "transaction" logs/api-server.log
grep -i "webhook" logs/api-server.log
```

### 2. Vérifier les webhooks reçus

```sql
-- Vérifier les webhooks reçus dans la base de données
SELECT * FROM "PaymentWebhookLog" 
WHERE provider = 'fedapay' 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### 3. Vérifier le statut de la transaction dans FedaPay

- Se connecter au dashboard FedaPay sandbox
- Aller dans Transactions
- Vérifier le statut et les détails de la transaction

## 🎯 Actions recommandées

1. **Immédiat** : Configurer ngrok pour rendre les URLs accessibles depuis FedaPay
2. **Court terme** : Vérifier la configuration du webhook dans FedaPay
3. **Moyen terme** : Mettre en place un environnement de staging avec des URLs publiques
4. **Long terme** : Automatiser les tests de paiement avec des numéros de test validés

## 📝 Notes importantes

- En mode sandbox, FedaPay peut avoir des limitations spécifiques
- Les numéros de téléphone de test peuvent être différents selon l'opérateur
- Le callback URL et le webhook URL doivent être accessibles publiquement
- Les transactions en sandbox peuvent avoir des délais plus longs

## 🔗 Ressources

- [Documentation FedaPay - Webhooks](https://docs.fedapay.com/webhooks)
- [Documentation FedaPay - Sandbox](https://docs.fedapay.com/sandbox)
- [ngrok Documentation](https://ngrok.com/docs)
