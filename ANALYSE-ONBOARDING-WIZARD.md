# 📊 Analyse du Wizard d'Onboarding - Academia Hub

**Date d'analyse** : 2025-01-17  
**Composant** : `OnboardingWizard.tsx`  
**Fichier** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx`

---

## 🎯 Vue d'Ensemble

Le wizard d'onboarding est un composant React complexe de **1286 lignes** qui gère le processus d'inscription complet d'un établissement scolaire en **4 phases** :

1. **Phase 1** : Informations de l'établissement
2. **Phase 2** : Informations du promoteur
3. **Phase 3** : Plan & Options
4. **Phase 4** : Paiement initial (FedaPay)

---

## 📋 Architecture du Composant

### Structure des Données

```typescript
interface OnboardingData {
  // Phase 1: Établissement
  schoolName: string;
  schoolType: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  bilingual: boolean;
  schoolsCount: number;
  logoUrl?: string;

  // Phase 2: Promoteur
  firstName: string;
  lastName: string;
  promoterPhone: string;
  promoterEmail: string;
  password: string;
  otp: string;

  // Phase 3: Plan
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';
  bilingualEnabled: boolean;

  // Draft ID
  draftId?: string;
}
```

### États du Composant

```typescript
const [step, setStep] = useState(1);                    // Étape actuelle (1-4)
const [isSubmitting, setIsSubmitting] = useState(false); // État de soumission
const [errors, setErrors] = useState<FormErrors>({});    // Erreurs de validation
const [showPassword, setShowPassword] = useState(false);  // Affichage mot de passe
const [otpSent, setOtpSent] = useState(false);           // OTP envoyé
const [otpVerified, setOtpVerified] = useState(false);  // OTP vérifié
const [passwordStrength, setPasswordStrength] = useState({...}); // Force du mot de passe
const [paymentUrl, setPaymentUrl] = useState<string | null>(null); // URL de paiement
const [priceCalculation, setPriceCalculation] = useState({...}); // Calcul des prix
```

---

## 🔄 Flux de Données

### Architecture API

```
Frontend (OnboardingWizard.tsx)
    ↓
Next.js API Routes (Proxy)
    ↓
Backend NestJS API
    ↓
Prisma + PostgreSQL
```

### Routes API Utilisées

1. **`POST /api/onboarding/draft`** - Créer un draft (Phase 1)
2. **`POST /api/onboarding/promoter`** - Ajouter infos promoteur (Phase 2)
3. **`POST /api/onboarding/plan`** - Sélectionner le plan (Phase 3)
4. **`POST /api/onboarding/payment`** - Créer session de paiement (Phase 4)
5. **`POST /api/onboarding/otp/generate`** - Générer OTP
6. **`POST /api/onboarding/otp/verify`** - Vérifier OTP

---

## 📝 Phase 1 : Informations de l'Établissement

### Champs Requis

- ✅ **Nom officiel** (`schoolName`)
- ✅ **Type d'établissement** (`schoolType`) : Maternelle, Primaire, Secondaire, Mixte
- ✅ **Pays** (`country`) : Bénin, Togo, Côte d'Ivoire, Sénégal
- ✅ **Ville** (`city`)
- ✅ **Téléphone** (`phone`) : Format validé avec code pays
- ✅ **Email** (`email`) : Format email validé
- ✅ **Nombre d'écoles** (`schoolsCount`) : 1 ou 2

### Champs Optionnels

- ⚪ **Option bilingue** (`bilingual`) : +5 000 FCFA/mois
- ⚪ **Logo** (`logoUrl`)

### Validation

```typescript
// Validation du téléphone
const normalizePhoneNumber = (phone: string, country: string): string => {
  // Normalise le numéro avec le code pays (+229 pour Bénin, etc.)
  // Format attendu : +CODE + 10 chiffres
}

// Validation de l'email
/^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validation du nombre d'écoles
schoolsCount >= 1 && schoolsCount <= 2
```

### Actions

1. **Création du draft** : `POST /api/onboarding/draft`
2. **Stockage du `draftId`** pour les phases suivantes
3. **Passage à la Phase 2** après validation

### Points d'Attention

- ⚠️ **Normalisation du téléphone** : Le numéro est normalisé avec le code pays avant l'envoi
- ⚠️ **Validation stricte** : Le formulaire bloque le passage à l'étape suivante si des erreurs existent
- ⚠️ **Gestion d'erreurs** : Affichage d'erreurs contextuelles pour chaque champ

---

## 👤 Phase 2 : Informations du Promoteur

### Champs Requis

- ✅ **Prénom** (`firstName`)
- ✅ **Nom** (`lastName`)
- ✅ **Email** (`promoterEmail`) : Sera l'identifiant de connexion
- ✅ **Téléphone** (`promoterPhone`) : Format validé
- ✅ **Mot de passe** (`password`) : Minimum 8 caractères
- ✅ **Confirmation mot de passe** (`confirmPassword`)
- ✅ **Code OTP** (`otp`) : 6 chiffres, vérifié

### Fonctionnalités

#### 1. Indicateur de Force du Mot de Passe

```typescript
const calculatePasswordStrength = (password: string) => {
  // Score 0-4 basé sur :
  // - Longueur (8+ = +1, 12+ = +2)
  // - Minuscules (+1)
  // - Majuscules (+1)
  // - Chiffres (+1)
  // - Caractères spéciaux (+1)
  
  // Labels : 'Très faible', 'Faible', 'Moyen', 'Fort'
  // Couleurs : red, orange, yellow, green
}
```

#### 2. Vérification OTP

**Flux OTP** :
1. Utilisateur entre son numéro de téléphone
2. Clic sur "Envoyer OTP"
3. Appel `POST /api/onboarding/otp/generate`
4. Code OTP envoyé par SMS/WhatsApp
5. Utilisateur entre le code (6 chiffres)
6. Clic sur "Vérifier"
7. Appel `POST /api/onboarding/otp/verify`
8. Si valide : `otpVerified = true`

**Mode Développement** :
- Le code OTP est affiché dans une alerte jaune en mode dev
- Permet de tester sans SMS réel

### Validation

```typescript
// Mot de passe
password.length >= 8
password === confirmPassword

// OTP
otp.length === 6
otpVerified === true

// Téléphone
// Format validé avec code pays
```

### Actions

1. **Envoi OTP** : `POST /api/onboarding/otp/generate`
2. **Vérification OTP** : `POST /api/onboarding/otp/verify`
3. **Ajout infos promoteur** : `POST /api/onboarding/promoter`
4. **Passage à la Phase 3** après validation

### Points d'Attention

- ⚠️ **OTP obligatoire** : Le formulaire bloque si l'OTP n'est pas vérifié
- ⚠️ **Mode dev** : En développement, l'OTP peut être ignoré (non recommandé)
- ⚠️ **Sécurité** : Le mot de passe est hashé côté backend (bcrypt)

---

## 💳 Phase 3 : Plan & Options

### Champs Requis

- ✅ **Plan** (`planCode`) : Code du plan sélectionné
- ✅ **Période de facturation** (`billingPeriod`) : 'monthly' ou 'yearly'

### Calcul des Prix

```typescript
const calculatePrice = async () => {
  // Pricing basé sur le nombre d'écoles
  const basePrices = {
    1: { monthly: 15000, yearly: 150000 },
    2: { monthly: 25000, yearly: 250000 },
    3: { monthly: 35000, yearly: 350000 },
    4: { monthly: 45000, yearly: 450000 },
  };
  
  const basePrice = basePrices[schoolsCount][billingPeriod];
  const bilingualPrice = bilingual && billingPeriod === 'monthly' ? 5000 : 0;
  const total = basePrice + bilingualPrice;
}
```

### Affichage

- **Période de facturation** : Boutons Mensuel / Annuel
- **Option bilingue** : Affichée si activée (+5 000 FCFA/mois)
- **Paiement initial** : 100 000 FCFA (fixe)
- **Total mensuel après essai** : Calculé dynamiquement

### Actions

1. **Sélection du plan** : `POST /api/onboarding/plan`
2. **Conversion planCode → planId** : Via API `/public/pricing`
3. **Passage à la Phase 4** après validation

### Points d'Attention

- ⚠️ **Conversion planCode** : Le frontend convertit `planCode` en `planId` via l'API publique
- ⚠️ **Prix initial fixe** : 100 000 FCFA (indépendant du plan)
- ⚠️ **Option bilingue** : Uniquement pour facturation mensuelle

---

## 💰 Phase 4 : Paiement Initial

### Montant

- **100 000 FCFA** : Paiement unique pour activation
- **Période d'essai** : 30 jours inclus
- **Accès complet** : Tous les modules

### Actions

1. **Création session de paiement** : `POST /api/onboarding/payment`
2. **Récupération URL FedaPay** : `paymentUrl` depuis la réponse
3. **Redirection** : `window.location.href = paymentUrl`

### Processus Post-Paiement

Après paiement réussi (via webhook FedaPay) :
1. Backend reçoit le callback
2. Création automatique du tenant
3. Création automatique de l'utilisateur admin
4. Activation du compte
5. Redirection vers `https://{subdomain}.academiahub.com/app`

### Points d'Attention

- ⚠️ **Redirection** : Redirection complète (pas de popup)
- ⚠️ **Gestion d'erreurs** : Affichage d'erreurs si la session de paiement échoue
- ⚠️ **Webhook** : Le callback de paiement est géré côté backend

---

## 🔍 Analyse Technique

### Points Forts

✅ **Architecture modulaire** : 4 phases bien séparées  
✅ **Validation robuste** : Validation en temps réel à chaque étape  
✅ **Gestion d'erreurs** : Messages d'erreur contextuels  
✅ **UX soignée** : Indicateurs de progression, indicateur de force du mot de passe  
✅ **Sécurité** : OTP obligatoire, validation stricte  
✅ **Calcul dynamique** : Prix calculés en temps réel  
✅ **Mode développement** : Affichage du code OTP en dev  

### Points d'Amélioration

#### 1. **Gestion OTP Incomplète**

**Problème** :
```typescript
// Ligne 441-459 : handleSendOtp
const handleSendOtp = async () => {
  // TODO: Appeler l'API OTP
  // Pour l'instant, simuler l'envoi
  await new Promise((resolve) => setTimeout(resolve, 1000));
  setOtpSent(true);
}
```

**Solution** :
```typescript
const handleSendOtp = async () => {
  if (!data.promoterPhone) {
    setErrors({ promoterPhone: 'Veuillez entrer votre numéro de téléphone' });
    return;
  }

  setIsSubmitting(true);
  try {
    const normalizedPhone = normalizePhoneNumber(data.promoterPhone, data.country);
    const response = await fetch('/api/onboarding/otp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: data.draftId,
        phone: normalizedPhone,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur lors de l\'envoi du code OTP');
    }

    const result = await response.json();
    setOtpSent(true);
    setOtpCode(result.code); // En dev seulement
    setOtpExpiresAt(new Date(result.expiresAt));
    setErrors({});
  } catch (error: any) {
    setErrors({ otp: error.message || 'Erreur lors de l\'envoi du code OTP' });
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 2. **Vérification OTP Incomplète**

**Problème** :
```typescript
// Ligne 461-479 : handleVerifyOtp
const handleVerifyOtp = async () => {
  // TODO: Vérifier l'OTP via l'API
  // Pour l'instant, simuler la vérification
  await new Promise((resolve) => setTimeout(resolve, 1000));
  setOtpVerified(true);
}
```

**Solution** :
```typescript
const handleVerifyOtp = async () => {
  if (!data.otp || data.otp.length !== 6) {
    setErrors({ otp: 'Le code OTP doit contenir 6 chiffres' });
    return;
  }

  if (!data.draftId) {
    setErrors({ otp: 'Draft ID manquant' });
    return;
  }

  setIsSubmitting(true);
  try {
    const normalizedPhone = normalizePhoneNumber(data.promoterPhone, data.country);
    const response = await fetch('/api/onboarding/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: data.draftId,
        phone: normalizedPhone,
        code: data.otp,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Code OTP invalide');
    }

    const result = await response.json();
    if (result.valid) {
      setOtpVerified(true);
      setErrors({});
    } else {
      setErrors({ otp: result.message || 'Code OTP invalide ou expiré' });
    }
  } catch (error: any) {
    setErrors({ otp: error.message || 'Erreur lors de la vérification du code OTP' });
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 3. **Gestion de l'État du Draft**

**Problème** : Le `draftId` n'est pas persisté si l'utilisateur rafraîchit la page.

**Solution** : Utiliser `localStorage` ou `sessionStorage` pour persister le draft :

```typescript
// Sauvegarder le draft
useEffect(() => {
  if (data.draftId) {
    localStorage.setItem('onboarding_draft_id', data.draftId);
  }
}, [data.draftId]);

// Restaurer le draft au chargement
useEffect(() => {
  const savedDraftId = localStorage.getItem('onboarding_draft_id');
  if (savedDraftId) {
    // Récupérer le draft depuis l'API
    fetch(`/api/onboarding/draft?draftId=${savedDraftId}`)
      .then(res => res.json())
      .then(draft => {
        // Restaurer les données
        setData({ ...data, draftId: draft.id, ...draft });
        setStep(draft.currentStep || 1);
      });
  }
}, []);
```

#### 4. **Validation du Nombre d'Écoles**

**Problème** : La validation limite à 1 ou 2 écoles, mais le calcul de prix supporte jusqu'à 4.

**Solution** : Aligner la validation avec le pricing :

```typescript
// Ligne 273-275
if (data.schoolsCount < 1 || data.schoolsCount > 4) {
  newErrors.schoolsCount = 'Le nombre d\'écoles doit être entre 1 et 4';
}
```

Et mettre à jour le select :
```typescript
<select value={data.schoolsCount} onChange={...}>
  <option value={1}>1 école</option>
  <option value={2}>2 écoles</option>
  <option value={3}>3 écoles</option>
  <option value={4}>4 écoles</option>
</select>
```

#### 5. **Gestion des Erreurs API**

**Problème** : Les erreurs API ne sont pas toujours bien gérées.

**Solution** : Améliorer la gestion d'erreurs :

```typescript
const handleNext = async () => {
  if (!validateStep(step)) {
    return;
  }

  setIsSubmitting(true);
  try {
    // ... appel API
  } catch (error: any) {
    // Gérer différents types d'erreurs
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      setErrors({ submit: 'Erreur de connexion. Vérifiez votre connexion internet.' });
    } else if (error.message?.includes('timeout')) {
      setErrors({ submit: 'La requête a pris trop de temps. Veuillez réessayer.' });
    } else {
      setErrors({ submit: error.message || 'Une erreur est survenue' });
    }
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 6. **TypeScript : confirmPassword Manquant**

**Problème** : `confirmPassword` est utilisé mais n'est pas dans l'interface `OnboardingData`.

**Solution** : Ajouter `confirmPassword` à l'interface :

```typescript
interface OnboardingData {
  // ...
  password: string;
  confirmPassword: string; // Ajouter
  otp: string;
  // ...
}
```

---

## 🎨 UX/UI

### Points Forts

✅ **Barre de progression** : Indicateur visuel clair des 4 étapes  
✅ **Navigation** : Boutons Retour/Continuer bien placés  
✅ **Validation visuelle** : Champs en erreur mis en évidence  
✅ **Indicateur de force** : Mot de passe avec barre de progression colorée  
✅ **Messages d'aide** : Textes explicatifs pour chaque champ  
✅ **Design cohérent** : Utilisation de Tailwind CSS avec palette bleue  

### Améliorations Suggérées

1. **Sauvegarde automatique** : Sauvegarder les données à chaque étape
2. **Confirmation avant paiement** : Modal de confirmation avant redirection FedaPay
3. **Loading states** : Skeleton loaders pendant les appels API
4. **Animations** : Transitions entre les étapes
5. **Accessibilité** : Améliorer les labels ARIA et la navigation au clavier

---

## 🔒 Sécurité

### Points Forts

✅ **Validation côté client et serveur**  
✅ **OTP obligatoire** pour vérifier le téléphone  
✅ **Mot de passe hashé** côté backend (bcrypt)  
✅ **Validation stricte** des formats (email, téléphone)  
✅ **Normalisation** des numéros de téléphone  

### Recommandations

1. **Rate limiting** : Limiter les tentatives OTP (max 3 par heure)
2. **CSRF protection** : Ajouter des tokens CSRF
3. **Sanitization** : Nettoyer les entrées utilisateur
4. **HTTPS** : Forcer HTTPS en production
5. **CSP headers** : Content Security Policy

---

## 📊 Métriques

### Complexité

- **Lignes de code** : 1286
- **États** : 9 états principaux
- **Fonctions** : 8 fonctions principales
- **Appels API** : 6 endpoints différents
- **Phases** : 4 phases distinctes

### Performance

- **Taille du bundle** : À vérifier (composant volumineux)
- **Re-renders** : Optimisation possible avec `useMemo` et `useCallback`
- **Appels API** : Certains appels pourraient être mis en cache

---

## 🚀 Recommandations Prioritaires

### Priorité Haute

1. ✅ **Implémenter les appels OTP réels** (actuellement simulés)
2. ✅ **Ajouter `confirmPassword` à l'interface TypeScript**
3. ✅ **Persister le draft dans localStorage**
4. ✅ **Améliorer la gestion d'erreurs API**

### Priorité Moyenne

5. ⚠️ **Optimiser les re-renders** avec `useMemo`/`useCallback`
6. ⚠️ **Ajouter des tests unitaires**
7. ⚠️ **Séparer le composant en sous-composants** (Phase1, Phase2, etc.)

### Priorité Basse

8. ⏳ **Ajouter des animations de transition**
9. ⏳ **Améliorer l'accessibilité**
10. ⏳ **Ajouter des analytics** (suivi des abandons)

---

## 📝 Conclusion

Le wizard d'onboarding est **bien structuré** mais nécessite quelques **améliorations critiques** :

✅ **Forces** :
- Architecture claire en 4 phases
- Validation robuste
- UX soignée
- Sécurité prise en compte

⚠️ **Améliorations** :
- Implémenter les appels OTP réels
- Persister le draft
- Améliorer la gestion d'erreurs
- Optimiser les performances

**Verdict** : Le wizard est **fonctionnel** mais nécessite des **corrections** pour être **production-ready**.

---

**Document généré le** : 2025-01-17  
**Version** : 1.0.0
