# 🔐 Authentification OTP Contextuelle - Academia Hub

**Date** : Implémentation complète  
**Statut** : ✅ **Système OTP contextuel implémenté**

---

## 📋 Vue d'Ensemble

Système d'authentification OTP intelligent (2FA contextuel) pour Academia Hub avec :
- ✅ Authentification adaptative (OTP requis selon le contexte)
- ✅ Tracking des appareils (user_devices)
- ✅ Liaison stricte des sessions (tenant_id + academic_year_id + device_id)
- ✅ OTP par SMS (validité courte, tentatives limitées)
- ✅ Audit logs complets

---

## 🏗️ Architecture

### Tables

1. **user_devices** : Tracking des appareils utilisateurs
2. **otp_codes** : Codes OTP générés et validés
3. **device_sessions** : Sessions liées aux appareils
4. **auth_audit_logs** : Logs d'audit complets

### Services

1. **DeviceTrackingService** : Gestion des appareils
2. **OtpService** : Génération et validation OTP
3. **DeviceSessionService** : Gestion des sessions device
4. **ContextualAuthGuard** : Middleware d'authentification contextuelle

---

## 🔄 Flow d'Authentification Contextuelle

### Quand OTP est Requis ?

L'OTP est requis si :
1. **Nouvel appareil** : Device non trusted
2. **Nouveau tenant** : Changement de tenant
3. **Nouvelle année scolaire** : Changement d'année académique
4. **Action sensible** : Action nécessitant vérification
5. **Session expirée** : Session inactive ou expirée

### Quand OTP n'est PAS Requis ?

L'OTP n'est pas requis si :
- Appareil trusted
- Session active pour le contexte actuel (tenant_id + academic_year_id + device_id)
- Même contexte que la dernière connexion

---

## 🔑 Services

### DeviceTrackingService

**Gestion des appareils**

```typescript
// Créer ou récupérer un appareil
const device = await deviceTrackingService.createOrGetDevice(
  userId,
  tenantId,
  {
    deviceType: 'desktop',
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    deviceName: 'Mon Ordinateur',
  }
);

// Vérifier si appareil est trusted
const isTrusted = await deviceTrackingService.isDeviceTrusted(deviceId);

// Marquer appareil comme trusted
await deviceTrackingService.trustDevice(deviceId);

// Révoquer un appareil
await deviceTrackingService.revokeDevice(deviceId, userId);

// Lister les appareils d'un utilisateur
const devices = await deviceTrackingService.getUserDevices(userId, tenantId);
```

### OtpService

**Génération et validation OTP**

```typescript
// Générer un OTP
const otp = await otpService.generateOtp({
  userId,
  tenantId,
  deviceId,
  purpose: 'LOGIN',
  phoneNumber: '+22961234567',
});

// Vérifier un OTP
const result = await otpService.verifyOtp({
  userId,
  tenantId,
  code: '123456',
  deviceId,
  otpId: otp.otpId,
});
```

**Caractéristiques** :
- Code à 6 chiffres
- Validité : 5 minutes
- Tentatives max : 3
- Envoi par SMS (à configurer)

### DeviceSessionService

**Gestion des sessions device**

```typescript
// Créer une session
const session = await deviceSessionService.createSession({
  userId,
  tenantId,
  academicYearId,
  deviceId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

// Valider une session
const validation = await deviceSessionService.validateSession(sessionToken);

// Invalider une session (logout)
await deviceSessionService.invalidateSession(sessionToken, userId);
```

**Liaison stricte** :
- `tenant_id` : OBLIGATOIRE
- `academic_year_id` : OBLIGATOIRE
- `device_id` : OBLIGATOIRE

---

## 🔒 ContextualAuthGuard

**Middleware d'authentification contextuelle**

Le guard vérifie automatiquement :
1. Session valide
2. Device trusted
3. Contexte valide (tenant_id + academic_year_id + device_id)
4. OTP si nécessaire

**Utilisation** :

```typescript
@UseGuards(ContextualAuthGuard)
@Get('protected')
async protectedRoute(@Request() req) {
  // req.session contient :
  // - userId
  // - tenantId
  // - academicYearId
  // - deviceId
}
```

**Réponse si OTP requis** :

```json
{
  "code": "OTP_REQUIRED",
  "message": "Vérification OTP requise",
  "requiresOtp": true
}
```

---

## 📡 Endpoints API

### POST /auth/otp/generate

Génère et envoie un code OTP.

**Request** :
```json
{
  "userId": "user-id",
  "tenantId": "tenant-id",
  "deviceId": "device-id",
  "purpose": "LOGIN",
  "phoneNumber": "+22961234567"
}
```

**Response** :
```json
{
  "success": true,
  "otpId": "otp-id",
  "expiresAt": "2024-01-01T12:05:00Z",
  "message": "Code OTP envoyé avec succès"
}
```

### POST /auth/otp/verify

Vérifie un code OTP.

**Request** :
```json
{
  "code": "123456",
  "deviceId": "device-id",
  "otpId": "otp-id"
}
```

**Response** :
```json
{
  "success": true,
  "valid": true,
  "deviceId": "device-id",
  "message": "Code OTP vérifié avec succès"
}
```

### GET /auth/otp/devices

Liste les appareils d'un utilisateur.

**Response** :
```json
{
  "success": true,
  "devices": [
    {
      "id": "device-id",
      "deviceName": "Mon Ordinateur",
      "deviceType": "desktop",
      "isTrusted": true,
      "lastUsedAt": "2024-01-01T10:00:00Z",
      "trustedAt": "2024-01-01T09:00:00Z",
      "createdAt": "2024-01-01T09:00:00Z"
    }
  ]
}
```

### DELETE /auth/otp/devices/:deviceId

Révoque un appareil.

**Response** :
```json
{
  "success": true,
  "message": "Appareil révoqué avec succès"
}
```

---

## 🔐 Sécurité

### Device Hash

Le `device_hash` est généré à partir de :
- `userId`
- `tenantId`
- `userAgent`
- `ipAddress`

Hash SHA-256 pour unicité et sécurité.

### OTP

- Code à 6 chiffres aléatoire
- Hash SHA-256 pour stockage
- Expiration : 5 minutes
- Tentatives : 3 max
- Invalidation automatique après utilisation

### Sessions

- Token de session unique (32 bytes hex)
- Expiration : 24 heures
- Refresh token : 30 jours
- Invalidation automatique si :
  - Device révoqué
  - Contexte change (tenant/academic_year/device)
  - Session expirée

---

## 📊 Audit Logs

Toutes les actions sont journalisées dans `auth_audit_logs` :

- `LOGIN` : Connexion réussie
- `LOGOUT` : Déconnexion
- `OTP_SENT` : OTP envoyé
- `OTP_VERIFIED` : OTP vérifié
- `OTP_FAILED` : OTP échoué
- `DEVICE_TRUSTED` : Appareil marqué comme trusted
- `DEVICE_REVOKED` : Appareil révoqué
- `SESSION_EXPIRED` : Session expirée
- `CONTEXT_CHANGED` : Changement de contexte

---

## ⚙️ Configuration

### Variables d'Environnement

```bash
# JWT Secret
JWT_SECRET=your-secret-key-change-in-production

# SMS Service (à configurer)
SMS_SERVICE=twilio # ou 'sms-gateway'
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 📝 Migration

### Appliquer la Migration

```bash
# PostgreSQL
psql -U postgres -d academia_helm -f prisma/migrations/add-otp-device-tables.sql

# Ou via Prisma
npx prisma migrate dev --name add_otp_device_tables
```

### Vérifier les Tables

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_devices', 'otp_codes', 'device_sessions', 'auth_audit_logs');
```

---

## ✅ Checklist d'Implémentation

- [x] Tables Prisma (user_devices, otp_codes, device_sessions, auth_audit_logs)
- [x] Service DeviceTrackingService
- [x] Service OtpService
- [x] Service DeviceSessionService
- [x] Guard ContextualAuthGuard
- [x] Controller OtpController
- [x] Endpoints API OTP
- [x] Audit logs complets
- [ ] Intégration SMS (à configurer)
- [ ] Schéma SQLite miroir (pour offline)
- [ ] UI gestion des appareils (frontend)

---

**Le système d'authentification OTP contextuelle est maintenant opérationnel !** ✅
