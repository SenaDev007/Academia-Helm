# 💳 Système de Facturation & Reçus — Frontend Next.js

Ce document décrit la partie **frontend** du système de facturation d’Academia Hub.  
La logique métier (numérotation, archivage légal, génération PDF, Fedapay) reste **côté backend**.

---

## 🧱 Modèle de Données (Types frontend)

Définis dans `src/types/index.ts` :

### `Invoice`

- `id: string`
- `tenantId: string`
- `number: string` — Numérotation **unique**, générée côté backend
- `amount: number`
- `currency: string` — ex : `XOF`
- `description: string`
- `status: 'ISSUED' | 'PAID' | 'CANCELLED'`
- `issuedAt: string`
- `dueAt?: string`
- `paidAt?: string`
- `createdAt: string`

### `Payment`

- `id: string`
- `tenantId: string`
- `invoiceId: string`
- `amount: number`
- `currency: string`
- `method: 'FEDAPAY' | 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY'`
- `provider: 'FEDAPAY'`
- `providerReference: string` — Référence Fedapay
- `status: 'PENDING' | 'COMPLETED' | 'FAILED'`
- `paidAt?: string`
- `createdAt: string`

### `Receipt`

- `id: string`
- `tenantId: string`
- `invoiceId: string`
- `paymentId: string`
- `number: string` — Numérotation **unique et immuable**
- `issuedAt: string`
- `pdfUrl: string` — URL sécurisée (signée) du reçu PDF
- `schoolName?: string`
- `schoolAddress?: string`

> 👉 La **non‑modifiabilité** est garantie côté backend : le frontend ne fait qu’afficher.

---

## 🔌 Services de Facturation

Implémentés dans `src/services/billing.service.ts` :

- `getBillingHistory(): Promise<{ invoices: Invoice[]; payments: Payment[]; receipts: Receipt[] }>`  
  Récupère l’historique complet pour le tenant courant (`/billing/history` côté API).

- `getInvoices(): Promise<Invoice[]>`  
  Liste des factures (`/billing/invoices` côté API).

- `getReceipts(): Promise<Receipt[]>`  
  Liste des reçus (`/billing/receipts` côté API).

Toutes les requêtes passent par `apiClient`, qui ajoute automatiquement :
- le token JWT (`Authorization: Bearer ...`)
- le `X-Tenant-ID` (multi-tenant)

---

## 📄 Webhook Fedapay (rappel)

Route Next.js : `POST /api/webhooks/fedapay` (`src/app/api/webhooks/fedapay/route.ts`)

- Reçoit les événements Fedapay
- Relaye **tel quel** le corps et la signature au backend :  
  `POST ${API_URL}/billing/fedapay/webhook`
- Le backend :
  - valide la signature
  - met à jour les entités `Invoice`, `Payment`, `Receipt`
  - met à jour `subscriptionStatus` du tenant si nécessaire

Le frontend n’implémente **aucune logique financière**.

---

## 📊 Page Historique de Facturation

Route : `/app/settings/billing`  
Fichiers :
- `src/components/dashboard/BillingHistoryPage.tsx`
- `src/app/app/settings/billing/page.tsx`
- Lien ajouté dans la sidebar : `Facturation` (`DashboardSidebar`)

### Contenu

- Titre et message institutionnel de facturation
- Tableau des factures :
  - N° de facture
  - Date d’émission
  - Montant + devise
  - Statut : `Payée` / `Émise`
  - Colonne **Reçu** :
    - Si `Receipt` avec `pdfUrl` : bouton **Télécharger le reçu** (PDF)
    - Si facture payée mais pas encore de reçu :  
      “Reçu en cours de génération…”
    - Si facture non payée :  
      “Reçu disponible après paiement”

### Téléchargement Sécurisé

- Le lien utilise directement `receipt.pdfUrl`
- Le backend doit fournir une URL :
  - signée / expirante
  - filtrée par tenant
  - protégée contre l’accès inter-tenant

Le frontend se contente d’ouvrir le PDF dans un nouvel onglet (`target="_blank"`, `rel="noopener noreferrer"`).

---

## ⚖️ Contraintes Financières & Légales (côté frontend)

- **Numérotation unique** : affichée mais jamais générée ni modifiée côté frontend.
- **Aucune modification a posteriori** :  
  - pas d’édition de facture ou de reçu via l’UI
  - uniquement consultation et téléchargement
- **Archivage légal** :  
  - le frontend part du principe que l’API lui renvoie l’historique complet
  - aucune suppression de facture ou de reçu dans l’interface

---

## 🔐 Sécurité

- Toutes les routes de facturation sont sous `/app/*` → protégées par :
  - middleware multi-tenant
  - session utilisateur
- Les données facturation sont toujours filtrées par `tenantId` côté backend.
- Les reçus PDF sont servis par le backend via des URLs sécurisées.

---

## 🧭 Résumé

- Le frontend :
  - **affiche** l’historique facturation
  - **offre le téléchargement** de reçus PDF
  - **respecte la numérotation et l’immutabilité** décidées par l’API
- Le backend :
  - gère Fedapay, les écritures comptables, la numérotation, les PDF, l’archivage.

Ce découplage garantit un système de facturation **institutionnel, traçable et conforme**, sans exposer de logique financière sensible dans le frontend.


