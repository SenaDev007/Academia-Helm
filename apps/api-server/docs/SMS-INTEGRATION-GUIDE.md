# 📱 Intégration SMS - Academia Hub

**Date** : Guide d'intégration SMS  
**Statut** : ✅ **Service SMS implémenté avec support Twilio**

---

## 📋 Vue d'Ensemble

Service SMS centralisé pour l'envoi de codes OTP, supportant :
- ✅ Twilio (production)
- ✅ SMS Gateway générique
- ✅ Mode Mock (développement)

---

## 🔧 Configuration

### Variables d'Environnement

#### Option 1 : Twilio (Recommandé pour Production)

```bash
# Provider
SMS_PROVIDER=twilio

# Twilio Credentials
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+22961234567  # Format international
```

#### Option 2 : SMS Gateway Générique

```bash
# Provider
SMS_PROVIDER=sms-gateway

# Gateway Configuration
SMS_GATEWAY_URL=https://api.sms-gateway.com/send
SMS_GATEWAY_API_KEY=your_api_key_here
```

#### Option 3 : Mode Mock (Développement)

```bash
# Provider
SMS_PROVIDER=mock

# Aucune autre configuration requise
# Les SMS seront loggés dans la console
```

---

## 📦 Installation Twilio

### 1. Installer le package Twilio

```bash
cd apps/api-server
npm install twilio
```

### 2. Configurer les Variables d'Environnement

Ajouter dans `.env` :

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+22961234567
```

### 3. Obtenir les Credentials Twilio

1. Créer un compte sur [Twilio](https://www.twilio.com/)
2. Aller dans **Console** → **Account Info**
3. Copier **Account SID** et **Auth Token**
4. Obtenir un numéro de téléphone dans **Phone Numbers** → **Buy a Number**

---

## 🔌 Utilisation

### Service SMS

Le service SMS est automatiquement injecté dans `OtpService`.

**Message OTP formaté** :
- `LOGIN` : "Votre code de connexion Academia Hub est: 123456. Valable 5 minutes..."
- `DEVICE_VERIFICATION` : "Code de vérification d'appareil: 123456..."
- `SENSITIVE_ACTION` : "Code de confirmation: 123456..."

### Exemple d'Appel

```typescript
import { SmsService } from '@/auth/services/sms.service';

// Injecté automatiquement dans OtpService
await smsService.sendSms({
  to: '+22961234567',
  message: 'Votre code OTP est: 123456',
});
```

---

## 🧪 Test

### Mode Mock (Développement)

En mode `mock`, les SMS sont loggés dans la console :

```
[MOCK SMS] To: +22961234567
[MOCK SMS] Message: Votre code de connexion Academia Hub est: 123456...
```

### Mode Production (Twilio)

Les SMS sont envoyés via Twilio et retournent un `messageId` (SID).

---

## ⚠️ Sécurité

- ✅ **Credentials** : Stockés dans variables d'environnement
- ✅ **Numéros** : Validation format international
- ✅ **Rate Limiting** : Géré par Twilio
- ✅ **Logging** : Messages OTP loggés (sans le code complet)

---

## 📊 Monitoring

### Logs

Tous les envois SMS sont loggés :

```typescript
// Succès
SMS sent via Twilio to +22961234567: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

// Erreur
Failed to send SMS via twilio: Error message
```

### Audit

Les envois OTP sont journalisés dans `auth_audit_logs` :

```sql
SELECT * FROM auth_audit_logs 
WHERE action = 'OTP_SENT' 
ORDER BY createdAt DESC;
```

---

## 🔧 Troubleshooting

### Erreur : "Configuration Twilio incomplète"

**Solution** : Vérifier que toutes les variables sont définies :
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

### Erreur : "Failed to send SMS via Twilio"

**Causes possibles** :
- Credentials invalides
- Numéro de téléphone invalide (format international requis)
- Limite de quota Twilio atteinte
- Problème réseau

**Solution** : Vérifier les logs et le dashboard Twilio.

---

## 📝 Notes

- **Format Numéro** : Toujours utiliser le format international (`+22961234567`)
- **Mode Mock** : Activé par défaut en développement
- **Coûts** : Twilio facture par SMS envoyé (consulter la tarification)

---

**Le service SMS est maintenant opérationnel !** ✅
