# Architecture Payment Flows - Séparation Stricte des Flux Financiers

## 📋 Vue d'Ensemble

Ce document décrit l'architecture du système de paiement d'Academia Hub avec **séparation stricte** entre :
- **Paiements SAAS** : Vers Academia Hub (souscriptions, abonnements, options)
- **Paiements TUITION** : Vers les écoles (frais scolaires payés par les parents)

## 🎯 Principe Fondamental

**ACADEMIA HUB N'EST PAS UNE BANQUE**

- Academia Hub ne détient **jamais** les fonds des écoles
- Les paiements scolarité vont **directement** vers les comptes des écoles
- Séparation **stricte et traçable** de chaque flux
- Conformité juridique implicite

## 🏗️ Structure de la Base de Données

### Table `payment_flows`

Flux de paiement avec séparation explicite :

```sql
CREATE TABLE payment_flows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    flow_type VARCHAR(20) NOT NULL, -- 'SAAS' ou 'TUITION'
    destination VARCHAR(20) NOT NULL, -- 'ACADEMIA' ou 'SCHOOL'
    student_id UUID, -- Pour TUITION uniquement
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XOF',
    status VARCHAR(20) NOT NULL, -- INITIATED, PENDING, PAID, FAILED, etc.
    psp VARCHAR(50) NOT NULL, -- FEDAPAY, MOOV_MONEY, etc.
    psp_reference VARCHAR(255),
    payment_url TEXT,
    payment_id UUID, -- Lien avec le paiement scolaire existant
    metadata JSONB,
    reason TEXT,
    initiated_by UUID,
    paid_at TIMESTAMPTZ,
    webhook_data JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    -- Contrainte : SAAS → ACADEMIA, TUITION → SCHOOL
    CONSTRAINT chk_payment_flow_destination CHECK (
        (flow_type = 'SAAS' AND destination = 'ACADEMIA') OR
        (flow_type = 'TUITION' AND destination = 'SCHOOL')
    )
);
```

### Table `school_payment_accounts`

Comptes de paiement des écoles pour recevoir les frais scolaires :

```sql
CREATE TABLE school_payment_accounts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    psp VARCHAR(50) NOT NULL, -- FEDAPAY, MOOV_MONEY, etc.
    account_identifier VARCHAR(255) NOT NULL, -- Numéro de compte
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(tenant_id, psp, account_identifier)
);
```

## 🔄 Workflow des Paiements

### 1. Paiement SAAS (Vers Academia Hub)

```
1. Promoteur initie un paiement SAAS
   → flowType = 'SAAS'
   → destination = 'ACADEMIA' (automatique)

2. Service crée un PaymentFlow
   → status = 'INITIATED'

3. Intégration Fedapay
   → Génère paymentUrl
   → Stocke pspReference

4. Promoteur paie via paymentUrl
   → Fedapay traite le paiement

5. Webhook Fedapay
   → Met à jour status = 'PAID'
   → Stocke webhookData

6. Academia Hub reçoit les fonds
   → Aucun intermédiaire
```

### 2. Paiement TUITION (Vers l'École)

```
1. Parent initie un paiement TUITION
   → flowType = 'TUITION'
   → destination = 'SCHOOL' (automatique)
   → studentId obligatoire

2. Vérification compte école
   → Un compte vérifié requis pour le PSP
   → Si absent → erreur

3. Service crée un PaymentFlow
   → status = 'INITIATED'
   → Lien avec paymentId (paiement scolaire existant)

4. Intégration Fedapay avec split
   → destinationAccount = compte école
   → Split payment : commission Academia Hub + montant école

5. Parent paie via paymentUrl
   → Fedapay traite le paiement
   → Fonds vont directement vers le compte école

6. Webhook Fedapay
   → Met à jour status = 'PAID'
   → Met à jour le paiement scolaire lié

7. École reçoit les fonds directement
   → Academia Hub ne détient jamais ces fonds
```

## 🔒 Règles Métier Strictes

### RÈGLE 1 : Séparation des Flux

```typescript
if (flowType === 'SAAS') {
  destination = 'ACADEMIA'; // OBLIGATOIRE
} else if (flowType === 'TUITION') {
  destination = 'SCHOOL'; // OBLIGATOIRE
}
```

**Contrainte CHECK en base garantit cette règle.**

### RÈGLE 2 : Compte École Vérifié

```typescript
// Pour TUITION, un compte école vérifié est OBLIGATOIRE
if (flowType === 'TUITION') {
  const account = await findActiveVerifiedAccount(tenantId, psp);
  if (!account) {
    throw new BadRequestException('Compte école requis');
  }
}
```

### RÈGLE 3 : Aucun Mélange

- Un paiement SAAS ne peut **jamais** aller vers SCHOOL
- Un paiement TUITION ne peut **jamais** aller vers ACADEMIA
- Contrainte CHECK en base empêche toute violation

### RÈGLE 4 : Traçabilité Complète

- Tous les paiements sont journalisés dans `audit_logs`
- Webhooks stockés pour audit
- Métadonnées extensibles

## 💰 Intégration Fedapay

### Configuration

```env
FEDAPAY_API_KEY=sk_live_...
FEDAPAY_API_SECRET=...
FEDAPAY_WEBHOOK_SECRET=...
FEDAPAY_BASE_URL=https://api.fedapay.com
```

### Paiement SAAS

```typescript
const result = await fedapayService.initiatePayment({
  amount: 100000,
  currency: 'XOF',
  description: 'Souscription Academia Hub',
  metadata: {
    flowId: flow.id,
    flowType: 'SAAS',
    destination: 'ACADEMIA',
    tenantId,
  },
});
// → Fonds vers Academia Hub
```

### Paiement TUITION (Split Payment)

```typescript
const result = await fedapayService.initiatePayment({
  amount: 50000,
  currency: 'XOF',
  description: 'Frais de scolarité - Trimestre 1',
  metadata: {
    flowId: flow.id,
    flowType: 'TUITION',
    destination: 'SCHOOL',
    tenantId,
    studentId,
  },
  destinationAccount: schoolAccount.accountIdentifier, // Compte école
});
// → Split : commission Academia Hub + montant école
// → Fonds vers compte école directement
```

## 🔔 Webhooks Sécurisés

### Endpoint Webhook

```typescript
POST /api/payment-flows/webhooks/fedapay
```

### Vérification de Signature

```typescript
const isValid = await fedapayService.verifyWebhookSignature(webhookData);
if (!isValid) {
  throw new BadRequestException('Signature invalide');
}
```

### Traitement

```typescript
1. Vérifier la signature
2. Identifier le PaymentFlow via pspReference
3. Mapper le statut webhook → PaymentFlowStatus
4. Mettre à jour le flux
5. Journaliser l'événement
```

## 🎨 Interface Utilisateur

### Pour les Promoteurs (Paiements SAAS)

```
┌─────────────────────────────────────────┐
│ Paiement Souscription                    │
├─────────────────────────────────────────┤
│ Montant : 100 000 FCFA                  │
│ Type : Souscription initiale            │
│                                         │
│ [ Payer maintenant ]                    │
│ → Redirige vers Fedapay                 │
└─────────────────────────────────────────┘
```

### Pour les Parents (Paiements TUITION)

```
┌─────────────────────────────────────────┐
│ Paiement Frais Scolaires                │
├─────────────────────────────────────────┤
│ Élève : Jean Dupont                     │
│ Période : Trimestre 1                   │
│ Montant : 50 000 FCFA                   │
│                                         │
│ [ Payer maintenant ]                    │
│ → Redirige vers Fedapay                 │
│ → Fonds vers compte école               │
└─────────────────────────────────────────┘
```

### Pour les Écoles (Configuration Comptes)

```
┌─────────────────────────────────────────┐
│ Comptes de Paiement                      │
├─────────────────────────────────────────┤
│ [Fedapay]                               │
│ Numéro : +229 XX XX XX XX               │
│ Statut : ✓ Vérifié                      │
│                                         │
│ [Ajouter un compte]                     │
└─────────────────────────────────────────┘
```

## 📊 Intégration ORION

ORION peut analyser les flux financiers :

```typescript
// Détecter les retards de paiement
const overduePayments = await findOverduePayments(tenantId);

// Analyser les revenus SAAS vs TUITION
const saasRevenue = await calculateSaasRevenue(tenantId);
const tuitionRevenue = await calculateTuitionRevenue(tenantId);

// Générer des alertes
if (overduePayments.length > 10) {
  await generateAlert('HIGH_OVERDUE_PAYMENTS', tenantId);
}
```

## 🔒 Sécurité

### Protection des Données

- ✅ Aucun numéro de carte stocké
- ✅ Respect PCI-DSS via PSP
- ✅ Webhooks vérifiés par signature
- ✅ Logs accessibles à l'admin central

### Audit

- ✅ Toutes les actions journalisées
- ✅ Webhooks stockés pour traçabilité
- ✅ Métadonnées extensibles

## 📝 Checklist d'Implémentation

- [x] Table `payment_flows`
- [x] Table `school_payment_accounts`
- [x] Service `PaymentFlowsService`
- [x] Intégration Fedapay
- [x] Webhooks sécurisés
- [x] Contraintes CHECK en base
- [ ] UI paiements SAAS
- [ ] UI paiements TUITION
- [ ] UI configuration comptes école
- [ ] Tests unitaires
- [ ] Tests d'intégration

## 🎯 Objectifs Atteints

- ✅ Séparation stricte des flux
- ✅ Zéro risque juridique
- ✅ Confiance écoles & parents
- ✅ Revenus Academia Hub sécurisés
- ✅ Architecture extensible

