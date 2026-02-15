# Analyse de l'implémentation du wizard d'onboarding (signup)

**Date** : 2026-02-14  
**Périmètre** : Frontend (Next.js) + API (NestJS) + FedaPay

---

## 1. Vue d'ensemble

Le **signup** est un wizard en **4 phases** qui permet à un établissement scolaire de s'inscrire, de renseigner un promoteur, de choisir un plan tarifaire et de régler le premier paiement (FedaPay). À l'issue, un **tenant** (école) et un **utilisateur promoteur** doivent être créés.

| Phase | Rôle | Données clés |
|-------|------|---------------|
| **1** | Établissement | Nom, type, pays, ville, téléphone, email, bilingue, nb écoles (1–4), logo |
| **2** | Promoteur | Prénom, nom, téléphone, email, mot de passe, **OTP** (SMS/voice/WhatsApp) |
| **3** | Plan | Code plan (BASIC_MONTHLY, GROUP_2_YEARLY, etc.), mensuel/annuel, calcul de prix dynamique |
| **4** | Paiement | Session FedaPay (checkout intégré ou redirection), vérification du statut |

---

## 2. Architecture technique

### 2.1 Frontend

- **Page** : `apps/web-app/src/app/(public)/signup/page.tsx` → rend uniquement `<OnboardingWizard />`.
- **Composant principal** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx` (~2900 lignes).
- **Routes API Next.js** (proxies vers l’API NestJS) :
  - `POST /api/onboarding/draft` — créer un draft (phase 1).
  - `GET /api/onboarding/draft?draftId=...` — récupérer un draft.
  - `GET /api/onboarding/draft/check/[email]` — vérifier si un draft existe pour un email.
  - `POST /api/onboarding/promoter` — enregistrer le promoteur (phase 2).
  - `POST /api/onboarding/otp/generate` — envoyer un OTP.
  - `POST /api/onboarding/otp/verify` — vérifier l’OTP.
  - `POST /api/onboarding/plan` — enregistrer le plan (phase 3).
  - `POST /api/onboarding/payment` — créer la session de paiement (phase 4).
  - `POST /api/onboarding/payment/[paymentId]/verify` — vérifier le statut du paiement (côté backend + FedaPay).
- **Pricing** : `GET /api/public/pricing`, `POST /api/public/pricing/calculate`, `GET /api/public/pricing/initial` pour les montants et le calcul mensuel/annuel.
- **Upload logo** : `POST /api/onboarding/upload-logo` (phase 1).

Le middleware laisse `/signup` et `/onboarding-error` en accès public.

### 2.2 Backend (NestJS)

- **Module** : `apps/api-server/src/onboarding/`  
  - **Controller** : `onboarding.controller.ts` (routes `POST/GET draft`, promoter, plan, payment, OTP, verify).
  - **Services** :
    - `onboarding.service.ts` : création draft, promoteur, plan, session paiement, **vérification statut paiement**, **activation tenant** (`activateTenantAfterPayment`).
    - `otp.service.ts` : génération et vérification OTP (SMS/voice/WhatsApp).
    - `draft-cleanup.service.ts` : nettoyage des drafts expirés (>24h).
- **Paiement** : `FedaPayService` (billing) — création transaction, webhook, et lors de la **vérification** de transaction : mise à jour du paiement et du draft.

### 2.3 Modèle de données (résumé)

- **OnboardingDraft** : infos établissement + promoteur (hash mot de passe) + `selectedPlanId`, `priceSnapshot`, statuts (`DRAFT` → `PENDING_PAYMENT` → `PAYMENT_COMPLETED` / `COMPLETED`).
- **OnboardingPayment** : lien draft, montant, référence, `metadata` (transactionId FedaPay), statut (`PENDING` → `COMPLETED` / `SUCCESS`).
- Après activation : **Tenant**(s), **Subscription** (TRIAL_ACTIVE 30j), **User** (promoteur), **SchoolLevel**, **AcademicTrack**, **GradingPolicy**, **SalaryPolicy**, **BillingEvent**.

---

## 3. Flux détaillé

### 3.1 Phase 1 — Établissement

1. L’utilisateur remplit le formulaire (nom, type, pays, ville, téléphone, email, bilingue, nb écoles, optionnellement logo).
2. **Vérification draft par email** : debounce 1s sur l’email → `GET /api/onboarding/draft/check/:email`. Si un draft existe, une bannière propose de « Reprendre » ou « Nouvelle inscription ».
3. À la soumission :  
   - Si logo : upload via `/api/onboarding/upload-logo`, puis création du draft avec `logoUrl`.  
   - Sinon : `POST /api/onboarding/draft` avec les champs établissement.  
   - En cas d’erreur « Un onboarding est déjà en cours pour cet email », le front peut récupérer `existingDraftId` et charger ce draft.
4. Les données sont aussi persistées en **localStorage** (`onboarding-draft`) à chaque changement lorsque `data.draftId` est défini.

### 3.2 Phase 2 — Promoteur

1. Formulaire : prénom, nom, téléphone, email, mot de passe, confirmation, OTP.
2. **Règles mot de passe** : longueur ≥ 8, au moins 3 types parmi (minuscule, majuscule, chiffre, spécial), pas plus de 2 caractères identiques consécutifs. Indicateur de force (Très faible → Fort).
3. **OTP** :  
   - `POST /api/onboarding/otp/generate` (phone normalisé, method: sms | voice | whatsapp).  
   - Affichage du code en dev si renvoyé par l’API. Compteur de réenvoi (30 s).  
   - `POST /api/onboarding/otp/verify` avec le code saisi.  
   - La soumission de la phase 2 envoie le promoteur + `otp` (code) à `POST /api/onboarding/promoter`. Le backend vérifie l’OTP (ou accepte en dev sans OTP si configuré).
4. Normalisation du téléphone côté front (code pays selon pays sélectionné) et côté backend pour la cohérence avec l’OTP.

### 3.3 Phase 3 — Plan

1. **Plan** : le `planCode` est dérivé automatiquement de `schoolsCount` et `billingPeriod` (ex. `BASIC_MONTHLY`, `GROUP_2_YEARLY`).
2. **Prix** : appel à `POST /api/public/pricing/calculate` pour `MONTHLY` et `YEARLY` (avec `planCode`, `schoolsCount`, `bilingual`) → affichage mensuel / annuel avec détail (base, bilingue, total).
3. Soumission : `POST /api/onboarding/plan` avec `draftId`, `planCode`, `billingPeriod`. La route Next.js peut convertir `planCode` en `planId` via l’API publique des plans puis envoie `planId` + `periodType` (MONTHLY/YEARLY) au backend. Le backend utilise `PricingService` pour calculer et enregistre `priceSnapshot` et passe le draft en `PENDING_PAYMENT`.

### 3.4 Phase 4 — Paiement

1. **Création de la session** : `POST /api/onboarding/payment` avec `draftId`. Le backend (FedaPayService) crée la transaction FedaPay et renvoie soit :
   - un **checkout intégré** (`public_key`, `transaction`, `customer`, `transactionId`, `paymentId`) → affichage de `FedaPayCheckout` dans le wizard ;
   - soit une **paymentUrl** → redirection vers la page FedaPay.
2. **Après paiement (checkout intégré)** : callback front `handlePaymentComplete` → **ne pas faire confiance au callback** → appel systématique à `POST /api/onboarding/payment/:paymentId/verify`.
3. **Vérification** :  
   - Backend : `OnboardingService.verifyPaymentStatus(paymentId)` récupère le `transactionId` dans les metadata du paiement, appelle `FedaPayService.verifyTransactionStatus(transactionId)`.  
   - Dans `verifyTransactionStatus`, si le statut FedaPay est `approved`/`completed`, le code appelle `handlePaymentSuccess(transaction)` qui pour un paiement de type onboarding appelle `handleOnboardingPaymentSuccess(transaction, paymentId)`.  
   - **Actuellement** : `handleOnboardingPaymentSuccess` met à jour le paiement en `COMPLETED` et le draft en `PAYMENT_COMPLETED`. Il **ne déclenche pas** `OnboardingService.activateTenantAfterPayment(paymentId)`.
4. **Activation du tenant** : la méthode `activateTenantAfterPayment(paymentId)` dans `OnboardingService` :
   - exige `payment.status === 'SUCCESS'` ;
   - crée en transaction : pays si besoin, tenant(s), policies, subscriptions (TRIAL_ACTIVE 30j), school levels, academic tracks, promoteur (user), billing events, puis met le draft en `COMPLETED` et le paiement en `SUCCESS`.  
   **Problème** : aucun appel à `activateTenantAfterPayment` n’existe dans le code. Le webhook / la vérification ne font que passer le paiement en `COMPLETED`, pas en `SUCCESS`, et ne créent jamais le tenant ni l’utilisateur. Donc **après un paiement réussi, le tenant et le compte promoteur ne sont pas créés**.

### 3.5 Redirection après succès

- Le front, après `verifyPaymentStatus`, si `result.status === 'SUCCESS'` ou `result.tenantActivated`, redirige vers `/onboarding/callback?draftId=...&paymentId=...&status=success`.
- Il **n’existe pas** de page `(public)/onboarding/callback` dans le projet : la route est référencée mais la page n’est pas implémentée (risque de 404 après redirection).

---

## 4. Points forts

- **Séparation nette** : 4 phases, API dédiée (draft, promoter, plan, payment, OTP, verify).
- **Sécurité** : vérification du paiement côté backend via FedaPay ; pas de confiance au seul callback front.
- **UX** : brouillon par email, restauration draft, debounce, indicateur de force du mot de passe, OTP avec choix de canal et cooldown.
- **Pricing** : calcul dynamique mensuel/annuel, prix initial paramétrable, intégration PricingService.
- **Multi-écoles** : `schoolsCount` 1–4, génération de sous-domaines annexes, plusieurs tenants/subscriptions.
- **Backend** : transaction atomique dans `activateTenantAfterPayment`, policies par pays, niveaux et tracks selon type d’établissement et option bilingue.

---

## 5. Problèmes et recommandations

### 5.1 Critique : tenant jamais créé après paiement

- **Constat** : `FedaPayService.handleOnboardingPaymentSuccess` met le paiement en `COMPLETED` et le draft en `PAYMENT_COMPLETED`, mais n’appelle jamais `OnboardingService.activateTenantAfterPayment(paymentId)`.
- **Conséquence** : aucun tenant, aucune subscription, aucun utilisateur promoteur n’est créé après un paiement réussi.
- **Recommandation** :  
  - Soit dans `handleOnboardingPaymentSuccess`, après la mise à jour du paiement/draft, appeler `this.onboardingService.activateTenantAfterPayment(paymentId)` (en gérant l’idempotence si la méthode est rappelée).  
  - Soit dans `OnboardingService.verifyPaymentStatus`, après une vérification FedaPay réussie et si le paiement n’est pas encore en `SUCCESS`, appeler `activateTenantAfterPayment(paymentId)` puis recharger le paiement pour le retour.  
  - Dans les deux cas, harmoniser les statuts : soit utiliser `SUCCESS` partout pour le paiement une fois le tenant créé, soit faire accepter à `activateTenantAfterPayment` le statut `COMPLETED` en entrée.

### 5.2 Page de callback manquante

- **Constat** : redirection vers `/onboarding/callback?draftId=...&paymentId=...&status=success` mais pas de page correspondante.
- **Recommandation** : créer `app/(public)/onboarding/callback/page.tsx` qui affiche un message de succès, le sous-domaine de l’école si disponible, et un lien vers la connexion (ex. `https://{subdomain}.academia-hub.pro/login` ou équivalent).

### 5.3 Route POST /api/onboarding (Next.js)

- **Constat** : une route legacy `apps/web-app/src/app/api/onboarding/route.ts` crée un tenant et un user via des appels directs à l’API (tenants, auth/register) avec un body différent (schoolName, responsibleName, etc.) et sans passer par le draft ni FedaPay.
- **Recommandation** : vérifier si cette route est encore utilisée. Si le flux officiel est uniquement le wizard (draft → payment → activateTenantAfterPayment), supprimer ou déprécier cette route pour éviter deux chemins d’inscription divergents.

### 5.4 Incohérence statut paiement

- Backend FedaPay : `handleOnboardingPaymentSuccess` met `status: 'COMPLETED'`.  
- `verifyPaymentStatus` renvoie `tenantActivated: updatedPayment?.status === 'SUCCESS'`.  
- Donc même après traitement du webhook/vérification, `tenantActivated` restera `false` tant que `activateTenantAfterPayment` n’aura pas mis le paiement en `SUCCESS`.  
- Après correction du point 5.1, soit le webhook/vérification appellent `activateTenantAfterPayment` qui met `SUCCESS`, soit il faut un statut unique (ex. tout en `SUCCESS` une fois le tenant créé).

### 5.5 Autres points

- **Taille du composant** : `OnboardingWizard.tsx` est très volumineux (~2900 lignes). À terme, extraire par phase (composants + hooks) et partager la logique (validation, appels API) pour la lisibilité et les tests.
- **Plan / DTO** : le backend attend `SelectPlanDto` avec `planId` et `periodType`. La route Next.js fait la conversion `planCode` → `planId` via l’API publique ; si l’API publique change de format, cette logique peut devenir fragile. Documenter ou déplacer cette conversion côté backend (acceptation de `planCode` + `periodType`).
- **OTP en dev** : le backend peut accepter la phase 2 sans OTP en `NODE_ENV === 'development'`. À garder en tête pour les environnements de test.

---

## 6. Fichiers principaux

| Rôle | Fichier |
|------|---------|
| Wizard frontend | `apps/web-app/src/components/onboarding/OnboardingWizard.tsx` |
| Page signup | `apps/web-app/src/app/(public)/signup/page.tsx` |
| Checkout FedaPay | `apps/web-app/src/components/onboarding/FedaPayCheckout.tsx` |
| Routes API Next (proxy) | `apps/web-app/src/app/api/onboarding/*` |
| Controller onboarding | `apps/api-server/src/onboarding/onboarding.controller.ts` |
| Service onboarding | `apps/api-server/src/onboarding/services/onboarding.service.ts` |
| Service OTP | `apps/api-server/src/onboarding/services/otp.service.ts` |
| FedaPay (paiement + webhook) | `apps/api-server/src/billing/services/fedapay.service.ts` |

---

## 7. Corrections appliquées (2026-02-14)

- **Tenant créé après paiement** : `FedaPayService.handleOnboardingPaymentSuccess` appelle désormais `OnboardingService.activateTenantAfterPayment(paymentId)` après mise à jour du paiement/draft. `activateTenantAfterPayment` accepte le statut `COMPLETED` (en plus de `SUCCESS`) et est idempotente.
- **Page callback** : création de `app/(public)/onboarding/callback/page.tsx` avec message de succès et lien de connexion (sous-domaine passé en query). Route `/onboarding` ajoutée aux routes publiques du middleware.
- **Sous-domaine pour le front** : le backend enregistre `firstTenantSubdomain` dans les metadata du paiement lors de l’activation et le renvoie dans `verifyPaymentStatus` ; le wizard redirige vers la callback avec `subdomain` pour afficher le lien de connexion.
- **POST /api/onboarding** : déprécié (410 Gone) avec message invitant à utiliser `/signup`.

---

**Dernière mise à jour** : 2026-02-14
