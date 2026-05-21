# CDC TECHNIQUE — MODULE PAIEMENT ACADEMIA HELM
## Intégration Stripe + FeexPay (Migration depuis FedaPay)
**Version** : 1.0  
**Date** : 19 mai 2026  
**Projet** : Academia Helm — YEHI OR Tech  
**Destinataire** : Google Antigravity (agent IA de développement)  
**Stack** : Next.js (App Router) — TypeScript — PostgreSQL

---

## 1. CONTEXTE ET PÉRIMÈTRE

### 1.1 Situation actuelle
FedaPay est déjà intégré et fonctionnel dans le projet. Tous les fichiers FedaPay existants doivent être **commentés**, jamais supprimés. La logique métier (noms des plans, structure des tables, cycles d'abonnement) reste inchangée.

### 1.2 Objectif
Ajouter deux nouveaux providers de paiement en parallèle de FedaPay :
- **Stripe** : option par défaut pour les abonnements SaaS (cartes bancaires + cartes virtuelles Mobile Money)
- **FeexPay** : option alternative pour les abonnements, et provider unique pour les frais de scolarité et le payroll

### 1.3 Ce que l'agent NE doit PAS faire
- Supprimer ou modifier le code FedaPay existant
- Modifier les noms des plans d'abonnement existants
- Modifier le schéma des tables existantes (ajout uniquement si nécessaire)
- Modifier la logique métier de contrôle d'accès existante

---

## 2. ARCHITECTURE PAIEMENT FINALE

```
┌─────────────────────────────────────────────────────────────┐
│                     ACADEMIA HELM                           │
│                                                             │
│  FLUX 1 : Abonnements SaaS (Directeur → YEHI OR Tech)      │
│  ┌─────────────────────────────────────────────┐            │
│  │  Option A [DÉFAUT] : Stripe Billing          │            │
│  │  Option B [ALTERNATIF] : FeexPay Mobile Money│            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  FLUX 2 : Frais de scolarité (Parents → École)             │
│  ┌─────────────────────────────────────────────┐            │
│  │  FeexPay uniquement (settlement direct école)│            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  FLUX 3 : Payroll (École → Enseignants/Staff)              │
│  ┌─────────────────────────────────────────────┐            │
│  │  FeexPay Payout API uniquement               │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  [COMMENTÉ] FLUX FEDAPAY — conservé, non actif             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. VARIABLES D'ENVIRONNEMENT REQUISES

Ajouter dans `.env.local` (ne jamais committer) :

```env
# ─── STRIPE ───────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# ─── FEEXPAY ──────────────────────────────────────────────
FEEXPAY_SHOP_ID=your_shop_id
FEEXPAY_API_TOKEN=your_api_token
FEEXPAY_MODE=LIVE                          # SANDBOX | LIVE
NEXT_PUBLIC_FEEXPAY_MODE=LIVE

# ─── FEDAPAY (conservé, commenté en production) ───────────
# FEDAPAY_SECRET_KEY=sk_live_xxxxxxxxxxxxx
# FEDAPAY_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
```

---

## 4. DÉPENDANCES À INSTALLER

```bash
npm install stripe @stripe/react-stripe-js @stripe/stripe-js
npm install @feexpay/react-sdk
```

---

## 5. FLUX 1 — ABONNEMENTS SaaS

### 5.1 Logique de sélection du provider

**Règle :** L'utilisateur choisit son provider au moment du checkout. Stripe est présélectionné par défaut. La sélection est persistée en base pour les renouvellements automatiques.

```typescript
// types/payment.ts
export type PaymentProvider = 'stripe' | 'feexpay'
// 'fedapay' conservé dans le type mais commenté dans la logique active

export interface SubscriptionPaymentIntent {
  provider: PaymentProvider
  planId: string          // ID existant dans la BDD — ne pas modifier
  billingCycle: 'monthly' | 'annual'
  amount: number          // en XOF
  schoolId: string
}
```

### 5.2 API Route — Création session Stripe

**Fichier :** `app/api/payments/stripe/create-subscription/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})

export async function POST(req: NextRequest) {
  const { planId, billingCycle, schoolId, customerEmail } = await req.json()

  try {
    // Récupérer ou créer le customer Stripe
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 })
    let customer = customers.data[0]
    
    if (!customer) {
      customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { schoolId, platform: 'academia_helm' },
      })
    }

    // Récupérer le price_id correspondant au plan existant
    // IMPORTANT : mapper les noms de plans existants vers les price_id Stripe Dashboard
    const priceId = getPriceIdFromPlan(planId, billingCycle) // voir section 5.4

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription/plans`,
      metadata: { schoolId, planId, billingCycle, provider: 'stripe' },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('[STRIPE] Erreur création session:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Mapper les plans existants vers les Price IDs Stripe
// IMPORTANT : lire les noms de plans actuels dans la BDD avant de remplir cette fonction
function getPriceIdFromPlan(planId: string, billingCycle: 'monthly' | 'annual'): string {
  const priceMap: Record<string, Record<string, string>> = {
    // À compléter avec les price_id du Stripe Dashboard
    // Exemple de structure — adapter aux plans existants :
    // 'PLAN_STARTER': {
    //   monthly: 'price_xxxxxxxxxxxxx',
    //   annual: 'price_xxxxxxxxxxxxx',
    // },
  }
  const price = priceMap[planId]?.[billingCycle]
  if (!price) throw new Error(`Price ID introuvable pour plan ${planId} / ${billingCycle}`)
  return price
}
```

### 5.3 API Route — Webhook Stripe

**Fichier :** `app/api/webhooks/stripe/route.ts`

**CRITIQUE :** Ce fichier doit désactiver le body parser Next.js pour lire le raw body requis par la vérification de signature Stripe.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { updateSubscriptionStatus } from '@/lib/subscriptions' // adapter au service existant

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})

// Désactiver le body parser — obligatoire pour stripe.webhooks.constructEvent()
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature invalide:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  // Traitement des événements
  switch (event.type) {
    
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const { schoolId, planId } = session.metadata!
      // Activer l'abonnement en base
      await updateSubscriptionStatus({
        schoolId,
        planId,
        status: 'active',
        provider: 'stripe',
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        currentPeriodEnd: null, // sera mis à jour par invoice.paid
      })
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const { schoolId } = subscription.metadata
      await updateSubscriptionStatus({
        schoolId,
        status: 'active',
        provider: 'stripe',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const { schoolId } = subscription.metadata
      await updateSubscriptionStatus({ schoolId, status: 'past_due', provider: 'stripe' })
      // TODO : envoyer notification email au directeur
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { schoolId } = subscription.metadata
      await updateSubscriptionStatus({ schoolId, status: 'canceled', provider: 'stripe' })
      break
    }

    default:
      console.log(`[STRIPE WEBHOOK] Événement non géré : ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
```

### 5.4 Mapping Plans → Stripe Dashboard

**Action requise avant déploiement :**

1. Aller sur dashboard.stripe.com > Products
2. Créer un produit par plan existant dans la BDD
3. Pour chaque produit, créer deux tarifs : mensuel (XOF) et annuel (XOF)
4. Copier les `price_id` générés dans la fonction `getPriceIdFromPlan()`

**Rappel :** Stripe travaille en plus petite unité monétaire. Pour XOF (devise sans décimale), `amount: 5000` = 5 000 FCFA.

### 5.5 Intégration FeexPay — Option alternative abonnements

**Fichier :** `app/api/payments/feexpay/create-subscription/route.ts`

FeexPay ne gère pas nativement les abonnements récurrents. La récurrence est gérée côté back-end Academia Helm via un cron job.

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { amount, phone, network, schoolId, planId, billingCycle, fullname, email } = await req.json()
  // network : 'MTN' | 'MOOV'

  const payload = {
    id: process.env.FEEXPAY_SHOP_ID,
    token: process.env.FEEXPAY_API_TOKEN,
    amount,
    currency: 'XOF',
    phone_number: phone,
    network,        // 'MTN' ou 'MOOV'
    fullname,
    email,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/feexpay/subscription`,
    custom_id: `SUB_${schoolId}_${planId}_${Date.now()}`,
    mode: process.env.FEEXPAY_MODE,
  }

  try {
    const response = await fetch('https://feexpay.me/api/orders/3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erreur FeexPay')
    }

    // Créer une entrée pending en base en attendant le webhook
    await createPendingSubscription({ schoolId, planId, billingCycle, provider: 'feexpay', reference: payload.custom_id })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[FEEXPAY] Erreur collecte:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

### 5.6 Webhook FeexPay — Abonnements

**Fichier :** `app/api/webhooks/feexpay/subscription/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { updateSubscriptionStatus } from '@/lib/subscriptions'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // FeexPay envoie le statut dans body.status
  // Statuts : 'SUCCESSFUL' | 'FAILED' | 'PENDING'
  const { status, custom_id, amount } = body

  // Extraire schoolId et planId depuis custom_id
  // Format : SUB_{schoolId}_{planId}_{timestamp}
  const [, schoolId, planId] = custom_id.split('_')

  if (status === 'SUCCESSFUL') {
    await updateSubscriptionStatus({
      schoolId,
      planId,
      status: 'active',
      provider: 'feexpay',
      reference: custom_id,
      amount,
    })
  } else if (status === 'FAILED') {
    await updateSubscriptionStatus({ schoolId, planId, status: 'payment_failed', provider: 'feexpay' })
  }

  return NextResponse.json({ received: true })
}
```

---

## 6. FLUX 2 — FRAIS DE SCOLARITÉ (FeexPay uniquement)

### 6.1 Principe

Chaque école collecte les frais de scolarité des parents. Le settlement se fait directement vers le compte FeexPay de l'école (confirmé par l'équipe technique FeexPay le 19 mai 2026).

Chaque école a son propre `shop_id` et `token` FeexPay, stockés chiffrés en base.

### 6.2 API Route — Collecte frais de scolarité

**Fichier :** `app/api/payments/feexpay/collect-fees/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSchoolFeexPayCredentials } from '@/lib/schools' // adapter au service existant

export async function POST(req: NextRequest) {
  const { schoolId, studentId, amount, phone, network, fullname, email, feeType } = await req.json()

  // Récupérer les credentials FeexPay de l'école concernée
  const credentials = await getSchoolFeexPayCredentials(schoolId)
  if (!credentials) {
    return NextResponse.json({ error: 'Credentials école introuvables' }, { status: 404 })
  }

  const payload = {
    id: credentials.shopId,
    token: credentials.apiToken,
    amount,
    currency: 'XOF',
    phone_number: phone,
    network,
    fullname,
    email,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/feexpay/fees`,
    custom_id: `FEE_${schoolId}_${studentId}_${feeType}_${Date.now()}`,
    mode: process.env.FEEXPAY_MODE,
  }

  try {
    const response = await fetch('https://feexpay.me/api/orders/3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) throw new Error(data.message || 'Erreur FeexPay')

    await createPendingFeePayment({ schoolId, studentId, feeType, amount, provider: 'feexpay', reference: payload.custom_id })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[FEEXPAY FEES] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

### 6.3 Webhook FeexPay — Frais de scolarité

**Fichier :** `app/api/webhooks/feexpay/fees/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { updateFeePaymentStatus } from '@/lib/fees'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { status, custom_id, amount } = body

  // Format custom_id : FEE_{schoolId}_{studentId}_{feeType}_{timestamp}
  const [, schoolId, studentId, feeType] = custom_id.split('_')

  if (status === 'SUCCESSFUL') {
    await updateFeePaymentStatus({
      schoolId,
      studentId,
      feeType,
      status: 'paid',
      amount,
      reference: custom_id,
      paidAt: new Date(),
    })
  } else if (status === 'FAILED') {
    await updateFeePaymentStatus({ schoolId, studentId, feeType, status: 'failed' })
  }

  return NextResponse.json({ received: true })
}
```

---

## 7. FLUX 3 — PAYROLL (FeexPay Payout API)

### 7.1 Principe

L'école déclenche un paiement en masse vers ses enseignants et son staff depuis l'interface Academia Helm. Chaque bénéficiaire reçoit son salaire directement sur son numéro MTN ou Moov Bénin.

### 7.2 API Route — Déclenchement payroll

**Fichier :** `app/api/payments/feexpay/payroll/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSchoolFeexPayCredentials } from '@/lib/schools'

interface PayrollBeneficiary {
  staffId: string
  fullname: string
  phone: string
  network: 'MTN' | 'MOOV'
  amount: number
  role: string
}

export async function POST(req: NextRequest) {
  const { schoolId, payrollPeriod, beneficiaries }: {
    schoolId: string
    payrollPeriod: string    // ex: '2026-05'
    beneficiaries: PayrollBeneficiary[]
  } = await req.json()

  const credentials = await getSchoolFeexPayCredentials(schoolId)
  if (!credentials) {
    return NextResponse.json({ error: 'Credentials école introuvables' }, { status: 404 })
  }

  const results = []

  // Traitement séquentiel pour éviter le rate limiting
  for (const beneficiary of beneficiaries) {
    try {
      const payload = {
        id: credentials.shopId,
        token: credentials.apiToken,
        amount: beneficiary.amount,
        currency: 'XOF',
        phone_number: beneficiary.phone,
        network: beneficiary.network,
        fullname: beneficiary.fullname,
        email: '',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/feexpay/payroll`,
        custom_id: `PAY_${schoolId}_${beneficiary.staffId}_${payrollPeriod}_${Date.now()}`,
        mode: process.env.FEEXPAY_MODE,
        // Payout : utiliser l'endpoint de déboursement FeexPay
        type: 'PAYOUT',
      }

      const response = await fetch('https://feexpay.me/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      results.push({
        staffId: beneficiary.staffId,
        success: response.ok,
        reference: payload.custom_id,
        data,
      })

      // Pause 200ms entre chaque payout pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (error) {
      results.push({ staffId: beneficiary.staffId, success: false, error })
    }
  }

  // Log de la session payroll
  await createPayrollSession({ schoolId, payrollPeriod, results })

  const successCount = results.filter(r => r.success).length
  const failCount = results.length - successCount

  return NextResponse.json({
    success: true,
    summary: { total: results.length, success: successCount, failed: failCount },
    results,
  })
}
```

**NOTE IMPORTANTE :** Confirmer avec l'équipe technique FeexPay l'endpoint exact du Payout API avant de déployer. Remplacer `https://feexpay.me/api/payouts` par l'URL fournie dans la documentation sandbox.

### 7.3 Webhook FeexPay — Payroll

**Fichier :** `app/api/webhooks/feexpay/payroll/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { updatePayrollStatus } from '@/lib/payroll'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { status, custom_id, amount } = body

  // Format custom_id : PAY_{schoolId}_{staffId}_{payrollPeriod}_{timestamp}
  const [, schoolId, staffId, payrollPeriod] = custom_id.split('_')

  await updatePayrollStatus({
    schoolId,
    staffId,
    payrollPeriod,
    status: status === 'SUCCESSFUL' ? 'paid' : 'failed',
    amount,
    reference: custom_id,
    processedAt: new Date(),
  })

  return NextResponse.json({ received: true })
}
```

---

## 8. COMPOSANT FRONT — SÉLECTEUR DE PROVIDER

**Fichier :** `components/payments/ProviderSelector.tsx`

Ce composant gère l'affichage du choix Stripe / FeexPay au moment du checkout abonnement.

```typescript
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { FeexPayButton, FeexPayProvider } from '@feexpay/react-sdk'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ProviderSelectorProps {
  planId: string
  billingCycle: 'monthly' | 'annual'
  amount: number
  schoolId: string
  customerEmail: string
}

export function ProviderSelector({
  planId, billingCycle, amount, schoolId, customerEmail
}: ProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'feexpay'>('stripe')
  const [loading, setLoading] = useState(false)

  const handleStripeCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle, schoolId, customerEmail }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (error) {
      console.error('[STRIPE] Erreur checkout:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="provider-selector">
      {/* Sélection du provider */}
      <div className="provider-tabs">
        <button
          onClick={() => setSelectedProvider('stripe')}
          className={selectedProvider === 'stripe' ? 'active' : ''}
        >
          Carte bancaire (Stripe)
        </button>
        <button
          onClick={() => setSelectedProvider('feexpay')}
          className={selectedProvider === 'feexpay' ? 'active' : ''}
        >
          Mobile Money (MTN / Moov)
        </button>
      </div>

      {/* Paiement Stripe */}
      {selectedProvider === 'stripe' && (
        <button onClick={handleStripeCheckout} disabled={loading}>
          {loading ? 'Redirection...' : `Payer ${amount.toLocaleString()} FCFA par carte`}
        </button>
      )}

      {/* Paiement FeexPay */}
      {selectedProvider === 'feexpay' && (
        <FeexPayProvider>
          <FeexPayButton
            amount={amount}
            description={`Abonnement Academia Helm — Plan ${planId}`}
            id={process.env.NEXT_PUBLIC_FEEXPAY_SHOP_ID!}
            token={process.env.NEXT_PUBLIC_FEEXPAY_API_TOKEN!}
            customId={`SUB_${schoolId}_${planId}_${Date.now()}`}
            callback_url={`${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/feexpay/subscription`}
            callback_info={{
              description: `Abonnement ${planId}`,
              fullname: '',
              email: customerEmail,
              phone: '',
            }}
            mode={process.env.NEXT_PUBLIC_FEEXPAY_MODE as 'LIVE' | 'SANDBOX'}
            currency="XOF"
            callback={(response) => {
              console.log('[FEEXPAY] Réponse callback:', response)
            }}
          />
        </FeexPayProvider>
      )}
    </div>
  )
}
```

**IMPORTANT :** Ne jamais exposer `FEEXPAY_API_TOKEN` côté client. Ce composant utilise une version publique du token (à confirmer avec FeexPay). Si le token est confidentiel, implémenter un endpoint proxy côté serveur.

---

## 9. MODIFICATIONS DE SCHÉMA BDD (ajouts uniquement)

Les tables existantes ne sont pas modifiées. Ajouter uniquement les colonnes manquantes :

```sql
-- Ajouter le champ provider sur la table subscriptions existante
-- (lire d'abord la structure actuelle avant d'exécuter)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20) DEFAULT 'fedapay',
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS feexpay_reference VARCHAR(255);

-- Table pour les credentials FeexPay par école
CREATE TABLE IF NOT EXISTS school_payment_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  provider VARCHAR(20) NOT NULL DEFAULT 'feexpay',
  shop_id VARCHAR(255) NOT NULL,
  api_token_encrypted TEXT NOT NULL,   -- chiffré en AES-256
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les sessions payroll
CREATE TABLE IF NOT EXISTS payroll_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_period VARCHAR(7) NOT NULL,   -- format YYYY-MM
  total_beneficiaries INT NOT NULL,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour le détail des paiements de payroll
CREATE TABLE IF NOT EXISTS payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES payroll_sessions(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_id UUID NOT NULL,
  amount INT NOT NULL,                  -- en XOF
  phone VARCHAR(20) NOT NULL,
  network VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  feexpay_reference VARCHAR(255),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. GESTION DU CODE FEDAPAY EXISTANT

### Règle absolue
**Commenter, jamais supprimer.**

### Convention de commentaire
Encadrer tous les blocs FedaPay avec :

```typescript
// ─── FEDAPAY [COMMENTÉ — CONSERVER] ──────────────────────────
// Ce bloc était actif avant la migration vers Stripe + FeexPay
// Ne pas supprimer — peut être réactivé si nécessaire
/*
  ... code FedaPay original ...
*/
// ─── FIN FEDAPAY ─────────────────────────────────────────────
```

---

## 11. CHECKLIST DE DÉPLOIEMENT

### Avant le premier test sandbox

- [ ] Variables d'environnement FeexPay sandbox configurées
- [ ] Variables d'environnement Stripe test configurées
- [ ] Webhook Stripe enregistré sur dashboard.stripe.com (endpoint `/api/webhooks/stripe`)
- [ ] Webhook FeexPay enregistré sur le dashboard FeexPay (3 endpoints : `/subscription`, `/fees`, `/payroll`)
- [ ] Stripe CLI installé pour les tests locaux (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
- [ ] Plans d'abonnement créés sur le Stripe Dashboard (mêmes noms que BDD existante)
- [ ] Price IDs Stripe copiés dans `getPriceIdFromPlan()`
- [ ] Endpoint Payout FeexPay confirmé avec l'équipe technique

### Avant le déploiement production

- [ ] Basculer vers les clés Stripe live
- [ ] Basculer `FEEXPAY_MODE=LIVE`
- [ ] Webhook Stripe re-enregistré en mode live
- [ ] Test end-to-end sur chaque flux (abonnement Stripe, abonnement FeexPay, frais scolarité, payroll 1 bénéficiaire)
- [ ] Vérifier que les webhooks FedaPay commentés ne reçoivent plus d'appels

---

## 12. POINTS À CONFIRMER AVEC FEEXPAY

Ces points ont été validés verbalement le 19 mai 2026. En attente de confirmation écrite :

1. **Endpoint exact du Payout API** — URL et format du payload pour les déboursements en masse
2. **Format du payload collecte** — Confirmer que `https://feexpay.me/api/orders/3` est l'endpoint de collecte actuel
3. **Payload webhook** — Confirmer la structure exacte du body envoyé par FeexPay sur les callbacks (champs `status`, `custom_id`, `amount`)
4. **Credentials par école** — Confirmer le mécanisme de sous-marchand : est-ce un `shop_id` séparé par école ou un paramètre de routing dans le payload ?
5. **Rate limiting Payout API** — Nombre maximum de payouts par seconde / minute

---

## 13. SÉCURITÉ

- Les clés API FeexPay et Stripe ne transitent jamais côté client
- Le token FeexPay des écoles est chiffré en AES-256 en base
- La vérification de signature Stripe (`constructEvent`) est obligatoire sur chaque webhook
- Les webhooks FeexPay doivent vérifier l'authenticité de la requête (confirmer le mécanisme de signature avec l'équipe FeexPay)
- Toutes les API routes paiement sont protégées par l'authentification existante d'Academia Helm

---

*Document produit par YEHI OR Tech — Academia Helm v1.x*  
*À destination exclusive de l'agent Google Antigravity*
