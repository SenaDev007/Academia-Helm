# Guide d'Implémentation - Payment Flows

## 🚀 Démarrage Rapide

### 1. Exécuter la Migration

```bash
# Exécuter la migration SQL
psql -U postgres -d academiahub -f migrations/003_add_payment_flows.sql
```

### 2. Configurer Fedapay

```env
# .env
FEDAPAY_API_KEY=sk_live_...
FEDAPAY_API_SECRET=...
FEDAPAY_WEBHOOK_SECRET=...
FEDAPAY_BASE_URL=https://api.fedapay.com
```

### 3. Configurer les Webhooks dans Fedapay

URL webhook : `https://api.academiahub.com/api/payment-flows/webhooks/fedapay`

## 📝 Utilisation dans le Code

### Créer un Paiement SAAS

```typescript
// Souscription initiale
const flow = await paymentFlowsService.createPaymentFlow(
  {
    flowType: PaymentFlowType.SAAS,
    amount: 100000,
    currency: 'XOF',
    psp: PaymentServiceProvider.FEDAPAY,
    reason: 'Souscription initiale Academia Hub',
    metadata: {
      subscriptionType: 'ANNUAL',
      features: ['BILINGUAL_TRACK'],
    },
  },
  tenantId,
  userId,
);

// Rediriger vers paymentUrl
return { paymentUrl: flow.paymentUrl };
```

### Créer un Paiement TUITION

```typescript
// Frais scolaires
const flow = await paymentFlowsService.createPaymentFlow(
  {
    flowType: PaymentFlowType.TUITION,
    studentId: studentId,
    amount: 50000,
    currency: 'XOF',
    psp: PaymentServiceProvider.FEDAPAY,
    reason: 'Frais de scolarité - Trimestre 1',
    paymentId: existingPaymentId, // Lier au paiement scolaire existant
    metadata: {
      period: 'Q1',
      academicYear: '2024-2025',
    },
  },
  tenantId,
  userId,
);

// Rediriger vers paymentUrl
return { paymentUrl: flow.paymentUrl };
```

### Configurer un Compte École

```typescript
// Créer un compte
const account = await paymentFlowsService.createSchoolPaymentAccount(
  {
    psp: PaymentServiceProvider.FEDAPAY,
    accountIdentifier: '+229 XX XX XX XX',
    accountName: 'Compte Principal École',
    accountType: 'MOBILE_MONEY',
  },
  tenantId,
  userId,
);

// Vérifier le compte (admin uniquement)
const verified = await paymentFlowsService.verifySchoolPaymentAccount(
  account.id,
  tenantId,
  adminUserId,
);
```

### Traiter un Webhook

```typescript
// Endpoint webhook (automatique)
@Post('webhooks/fedapay')
async handleWebhook(@Body() webhookData: any) {
  return this.paymentFlowsService.handleWebhook(
    PaymentServiceProvider.FEDAPAY,
    webhookData,
  );
}
```

## 🎨 Frontend - Composants React

### Composant Paiement SAAS

```typescript
// SaasPaymentButton.tsx
'use client';

import { useState } from 'react';
import { PaymentFlowType, PaymentServiceProvider } from '@/types';

export function SaasPaymentButton({ amount, reason, metadata }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payment-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowType: PaymentFlowType.SAAS,
          amount,
          currency: 'XOF',
          psp: PaymentServiceProvider.FEDAPAY,
          reason,
          metadata,
        }),
      });

      const flow = await response.json();
      
      // Rediriger vers Fedapay
      window.location.href = flow.paymentUrl;
    } catch (error) {
      console.error('Error initiating payment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePayment} disabled={loading}>
      {loading ? 'Traitement...' : `Payer ${amount.toLocaleString()} FCFA`}
    </button>
  );
}
```

### Composant Paiement TUITION

```typescript
// TuitionPaymentButton.tsx
'use client';

import { useState } from 'react';
import { PaymentFlowType, PaymentServiceProvider } from '@/types';

export function TuitionPaymentButton({ studentId, amount, period, paymentId }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payment-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowType: PaymentFlowType.TUITION,
          studentId,
          amount,
          currency: 'XOF',
          psp: PaymentServiceProvider.FEDAPAY,
          reason: `Frais de scolarité - ${period}`,
          paymentId,
          metadata: {
            period,
          },
        }),
      });

      const flow = await response.json();
      
      // Rediriger vers Fedapay
      window.location.href = flow.paymentUrl;
    } catch (error) {
      console.error('Error initiating payment:', error);
      alert('Erreur lors de l\'initiation du paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePayment} disabled={loading}>
      {loading ? 'Traitement...' : `Payer ${amount.toLocaleString()} FCFA`}
    </button>
  );
}
```

### Composant Configuration Compte École

```typescript
// SchoolPaymentAccountForm.tsx
'use client';

import { useState } from 'react';
import { PaymentServiceProvider } from '@/types';

export function SchoolPaymentAccountForm() {
  const [formData, setFormData] = useState({
    psp: PaymentServiceProvider.FEDAPAY,
    accountIdentifier: '',
    accountName: '',
    accountType: 'MOBILE_MONEY',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/payment-flows/school-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const account = await response.json();
      alert('Compte créé avec succès. En attente de vérification.');
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select
        value={formData.psp}
        onChange={(e) => setFormData({ ...formData, psp: e.target.value })}
      >
        <option value={PaymentServiceProvider.FEDAPAY}>Fedapay</option>
        <option value={PaymentServiceProvider.MOOV_MONEY}>Moov Money</option>
        <option value={PaymentServiceProvider.MTN_MONEY}>MTN Money</option>
      </select>

      <input
        type="text"
        placeholder="Numéro de compte"
        value={formData.accountIdentifier}
        onChange={(e) => setFormData({ ...formData, accountIdentifier: e.target.value })}
        required
      />

      <input
        type="text"
        placeholder="Nom du compte"
        value={formData.accountName}
        onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
        required
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Création...' : 'Créer le compte'}
      </button>
    </form>
  );
}
```

## 🔍 Vérifications

### Vérifier le Statut d'un Paiement

```typescript
const flow = await paymentFlowsService.findOne(flowId, tenantId);

if (flow.status === PaymentFlowStatus.PAID) {
  // Paiement réussi
} else if (flow.status === PaymentFlowStatus.FAILED) {
  // Paiement échoué
} else if (flow.status === PaymentFlowStatus.PENDING) {
  // En attente
}
```

### Lister les Paiements

```typescript
// Tous les paiements SAAS
const saasPayments = await paymentFlowsService.findAll(
  tenantId,
  PaymentFlowType.SAAS,
);

// Tous les paiements TUITION
const tuitionPayments = await paymentFlowsService.findAll(
  tenantId,
  PaymentFlowType.TUITION,
);

// Paiements d'un élève
const studentPayments = await paymentFlowsService.findAll(
  tenantId,
  PaymentFlowType.TUITION,
  undefined,
  undefined,
  studentId,
);
```

## ⚠️ Points d'Attention

### 1. Séparation Stricte

```typescript
// ❌ MAUVAIS
const flow = await createPaymentFlow({
  flowType: 'SAAS',
  destination: 'SCHOOL', // ERREUR !
});

// ✅ BON
const flow = await createPaymentFlow({
  flowType: 'SAAS', // destination = 'ACADEMIA' automatique
});
```

### 2. Compte École Vérifié

```typescript
// ❌ MAUVAIS
// Créer un paiement TUITION sans compte vérifié

// ✅ BON
// Vérifier qu'un compte existe et est vérifié
const account = await findActiveVerifiedAccount(tenantId, psp);
if (!account) {
  throw new BadRequestException('Compte école requis');
}
```

### 3. Webhooks Sécurisés

```typescript
// ✅ TOUJOURS vérifier la signature
const isValid = await verifyWebhookSignature(webhookData);
if (!isValid) {
  throw new BadRequestException('Signature invalide');
}
```

## 🧪 Tests

### Test : Création Paiement SAAS

```typescript
it('should create SAAS payment flow with ACADEMIA destination', async () => {
  const flow = await paymentFlowsService.createPaymentFlow(
    {
      flowType: PaymentFlowType.SAAS,
      amount: 100000,
      psp: PaymentServiceProvider.FEDAPAY,
    },
    tenantId,
    userId,
  );

  expect(flow.flowType).toBe(PaymentFlowType.SAAS);
  expect(flow.destination).toBe(PaymentDestination.ACADEMIA);
});
```

### Test : Création Paiement TUITION

```typescript
it('should create TUITION payment flow with SCHOOL destination', async () => {
  // Créer un compte école vérifié
  await createVerifiedSchoolAccount(tenantId);

  const flow = await paymentFlowsService.createPaymentFlow(
    {
      flowType: PaymentFlowType.TUITION,
      studentId: studentId,
      amount: 50000,
      psp: PaymentServiceProvider.FEDAPAY,
    },
    tenantId,
    userId,
  );

  expect(flow.flowType).toBe(PaymentFlowType.TUITION);
  expect(flow.destination).toBe(PaymentDestination.SCHOOL);
});
```

## 📚 Ressources

- [Architecture Payment Flows](./PAYMENT-FLOWS-ARCHITECTURE.md)
- [Migration SQL](../migrations/003_add_payment_flows.sql)
- [Documentation Fedapay](https://docs.fedapay.com)

