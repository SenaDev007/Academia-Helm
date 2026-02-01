# 🔧 Configuration Fedapay

## ✅ Résolution de l'avertissement

L'avertissement `Fedapay credentials not configured` a été résolu de deux façons :

1. **Message moins alarmant en développement** : Le message est maintenant informatif plutôt qu'un avertissement en développement
2. **Variables d'environnement ajoutées** : Les variables Fedapay ont été ajoutées dans `.env` (vides par défaut)

## 📝 Configuration Fedapay (Optionnel)

Fedapay est **optionnel** en développement. Vous pouvez ignorer cet avertissement si vous ne testez pas les paiements.

### Si vous voulez activer Fedapay :

1. **Créer un compte Fedapay**
   - Allez sur https://dashboard.fedapay.com
   - Créez un compte ou connectez-vous

2. **Obtenir vos clés API**
   - Dans le dashboard Fedapay, allez dans **Settings** → **API Keys**
   - Copiez votre **API Key** et **API Secret**
   - Pour les webhooks, créez un **Webhook Secret**

3. **Configurer dans `.env`**

   Ouvrez `apps/api-server/.env` et remplissez :

   ```env
   FEDAPAY_API_KEY=sk_live_votre_cle_api
   FEDAPAY_API_SECRET=votre_secret_api
   FEDAPAY_WEBHOOK_SECRET=votre_webhook_secret
   FEDAPAY_BASE_URL=https://api.fedapay.com
   ```

4. **Redémarrer l'API**

   ```bash
   cd apps/api-server
   npm run start:dev
   ```

   L'avertissement disparaîtra et les paiements fonctionneront.

## 🧪 Mode Test (Sandbox)

Pour tester sans utiliser de vrais paiements :

1. Utilisez les clés de **test** (sandbox) de Fedapay
2. Configurez `FEDAPAY_BASE_URL=https://sandbox-api.fedapay.com` (si disponible)

## ⚠️ Important

- **En développement** : Fedapay est optionnel, l'avertissement est informatif
- **En production** : Fedapay doit être configuré pour que les paiements fonctionnent
- **Sécurité** : Ne commitez jamais vos clés API dans Git. Utilisez `.env` qui est dans `.gitignore`

## 🔍 Vérification

Pour vérifier que Fedapay est bien configuré :

```bash
cd apps/api-server
node -e "require('dotenv').config(); console.log('API Key:', process.env.FEDAPAY_API_KEY ? '✅ Configuré' : '❌ Non configuré');"
```
