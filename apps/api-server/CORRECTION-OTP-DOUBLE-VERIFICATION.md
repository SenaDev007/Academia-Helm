# ✅ Correction : Problème de Double Vérification OTP

## 📋 Problème Identifié

L'OTP était vérifié **deux fois** dans le workflow d'onboarding :

1. **Première vérification** : Quand l'utilisateur clique sur "Vérifier" dans l'interface
   - Appel à `/api/onboarding/otp/verify`
   - L'OTP est marqué comme `verified: true` dans la base de données

2. **Deuxième vérification** : Quand l'utilisateur clique sur "Continuer"
   - Appel à `/api/onboarding/promoter` → `addPromoterInfo()`
   - Tentative de vérifier l'OTP à nouveau avec `verifyOTP()`
   - **Problème** : `verifyOTP()` cherche un OTP avec `verified: false`
   - L'OTP a déjà été marqué comme `verified: true`, donc il n'est pas trouvé
   - **Résultat** : Erreur "Code OTP invalide ou expiré" même si l'OTP est valide

---

## ✅ Solution Implémentée

### 1. Modification de `addPromoterInfo()` dans `onboarding.service.ts`

**Avant** :
```typescript
if (data.otpCode) {
  otpVerified = await this.otpService.verifyOTP(draftId, data.phone, data.otpCode);
  if (!otpVerified) {
    throw new BadRequestException('Code OTP invalide ou expiré');
  }
}
```

**Après** :
```typescript
if (data.otpCode) {
  // D'abord, vérifier si un OTP a déjà été vérifié pour ce draft et ce téléphone
  const hasValidOTP = await this.otpService.hasValidOTP(draftId, data.phone);
  if (hasValidOTP) {
    // L'OTP a déjà été vérifié via l'endpoint /otp/verify
    otpVerified = true;
    this.logger.log(`✅ OTP already verified for draft ${draftId} - Phone: ${data.phone}`);
  } else {
    // Sinon, vérifier l'OTP fourni
    otpVerified = await this.otpService.verifyOTP(draftId, data.phone, data.otpCode);
    if (!otpVerified) {
      throw new BadRequestException('Code OTP invalide ou expiré');
    }
  }
} else {
  // Si aucun code OTP n'est fourni, vérifier si un OTP a déjà été vérifié
  const hasValidOTP = await this.otpService.hasValidOTP(draftId, data.phone);
  if (hasValidOTP) {
    otpVerified = true;
    this.logger.log(`✅ Using previously verified OTP for draft ${draftId} - Phone: ${data.phone}`);
  } else {
    // En développement, on peut accepter sans OTP
    if (process.env.NODE_ENV === 'development') {
      this.logger.warn(`⚠️  DEV MODE: OTP verification skipped for draft ${draftId}`);
      otpVerified = true;
    } else {
      throw new BadRequestException('Code OTP requis pour valider le numéro de téléphone');
    }
  }
}
```

### 2. Amélioration de `verifyOTP()` dans `otp.service.ts`

**Amélioration** : Gestion flexible de la normalisation du numéro de téléphone

```typescript
async verifyOTP(draftId: string, phone: string, code: string): Promise<boolean> {
  // Normaliser le numéro de téléphone pour la comparaison
  const normalizedPhone = phone.replace(/\s+/g, '').trim();
  
  // Chercher avec le numéro exact ET avec des variations possibles
  const otp = await this.prisma.onboardingOTP.findFirst({
    where: {
      draftId,
      OR: [
        { phone: normalizedPhone },
        { phone: phone.trim() },
        { phone: phone.replace(/^\+/, '') }, // Sans le +
        { phone: `+${normalizedPhone}` }, // Avec le +
      ],
      code,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: {
      createdAt: 'desc', // Prendre le plus récent
    },
  });

  // Logs détaillés pour le débogage
  if (!otp) {
    const allOtps = await this.prisma.onboardingOTP.findMany({
      where: { draftId, code },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    this.logger.warn(`❌ Invalid or expired OTP for draft ${draftId} - Phone: ${phone} (normalized: ${normalizedPhone}) - Code: ${code}`);
    if (allOtps.length > 0) {
      this.logger.warn(`📋 Found ${allOtps.length} OTP(s) with this code for this draft:`);
      allOtps.forEach((o, idx) => {
        this.logger.warn(`  ${idx + 1}. Phone: ${o.phone}, Verified: ${o.verified}, Expires: ${o.expiresAt.toISOString()}`);
      });
    }
    return false;
  }

  // Marquer l'OTP comme vérifié
  await this.prisma.onboardingOTP.update({
    where: { id: otp.id },
    data: {
      verified: true,
      verifiedAt: new Date(),
    },
  });

  this.logger.log(`✅ OTP verified for draft ${draftId} - Phone: ${otp.phone} (requested: ${phone})`);
  return true;
}
```

### 3. Amélioration de `hasValidOTP()` dans `otp.service.ts`

**Amélioration** : Gestion flexible de la normalisation du numéro de téléphone

```typescript
async hasValidOTP(draftId: string, phone: string): Promise<boolean> {
  // Normaliser le numéro de téléphone pour la comparaison
  const normalizedPhone = phone.replace(/\s+/g, '').trim();
  
  const otp = await this.prisma.onboardingOTP.findFirst({
    where: {
      draftId,
      OR: [
        { phone: normalizedPhone },
        { phone: phone.trim() },
        { phone: phone.replace(/^\+/, '') }, // Sans le +
        { phone: `+${normalizedPhone}` }, // Avec le +
      ],
      verified: true,
      verifiedAt: { not: null },
    },
    orderBy: {
      verifiedAt: 'desc', // Prendre le plus récent
    },
  });

  return !!otp;
}
```

---

## 🔄 Nouveau Workflow

### Scénario : Utilisateur vérifie l'OTP puis continue

1. **Étape 1** : Utilisateur entre le code OTP et clique sur "Vérifier"
   - Appel à `/api/onboarding/otp/verify`
   - `verifyOTP()` trouve l'OTP avec `verified: false`
   - L'OTP est marqué comme `verified: true`
   - ✅ **Résultat** : OTP vérifié avec succès

2. **Étape 2** : Utilisateur clique sur "Continuer"
   - Appel à `/api/onboarding/promoter` → `addPromoterInfo()`
   - `addPromoterInfo()` appelle `hasValidOTP()` pour vérifier si un OTP a déjà été vérifié
   - ✅ **Résultat** : OTP déjà vérifié trouvé, accepté directement
   - L'onboarding continue sans erreur

### Scénario : Utilisateur continue sans vérifier l'OTP d'abord

1. **Étape 1** : Utilisateur entre le code OTP directement dans le formulaire
   - Pas d'appel à `/api/onboarding/otp/verify`
   - L'OTP n'est pas encore vérifié

2. **Étape 2** : Utilisateur clique sur "Continuer"
   - Appel à `/api/onboarding/promoter` → `addPromoterInfo()`
   - `hasValidOTP()` retourne `false` (pas d'OTP vérifié)
   - `verifyOTP()` est appelé avec le code fourni
   - ✅ **Résultat** : OTP vérifié et marqué comme `verified: true`
   - L'onboarding continue

---

## ✅ Avantages

1. **Pas de double vérification** : L'OTP n'est vérifié qu'une seule fois
2. **Flexibilité** : Accepte un OTP déjà vérifié ou vérifie un nouveau code
3. **Normalisation robuste** : Gère les variations de format de numéro de téléphone
4. **Logs détaillés** : Facilite le débogage en cas de problème
5. **UX améliorée** : L'utilisateur peut vérifier l'OTP avant de continuer ou le faire en une seule étape

---

## 🎯 Résultat

✅ **Problème résolu** : L'OTP peut maintenant être vérifié une première fois via `/api/onboarding/otp/verify`, puis accepté automatiquement lors de l'appel à `addPromoterInfo()` sans erreur.

✅ **Robustesse améliorée** : La normalisation flexible du numéro de téléphone permet de gérer les variations de format.

✅ **Logs améliorés** : Des logs détaillés facilitent le débogage en cas de problème.

---

**Date de correction** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : ✅ **CORRIGÉ**
