# 🧱 ACADEMIA HUB — MODULE BLUEPRINT v1

## 📋 Table des matières

1. [Pourquoi ce modèle est non négociable](#pourquoi-ce-modèle-est-non-négociable)
2. [Structure visuelle invariable](#structure-visuelle-invariable)
3. [Composants du blueprint](#composants-du-blueprint)
4. [Règles d'implémentation](#règles-dimplémentation)
5. [Checklist d'implémentation](#checklist-dimplémentation)
6. [Exemples](#exemples)
7. [Interdictions strictes](#interdictions-strictes)

---

## 🎯 Pourquoi ce modèle est non négociable

### 1️⃣ Uniformité

Tous les modules doivent "se ressembler" mentalement, même s'ils font des choses différentes.

### 2️⃣ Vitesse de développement

Un nouveau module = remplir un moule, pas inventer une UI.

### 3️⃣ Formation utilisateur

Un directeur comprend un module = il comprend tous les autres.

### 4️⃣ Scalabilité produit

Quand tu ajoutes un module (Patronat, IA, QHSE…), tu ne casses rien.

---

## 🏗️ Structure visuelle invariable

```
┌──────────────────────────────────────────────┐
│ HEADER GLOBAL
│ (École | Année | Niveau | Langue | Profil)
├──────────────────────────────────────────────┤
│ SIDEBAR MODULES
├──────────────────────────────────────────────┤
│ MODULE CONTAINER
│ ├─ Module Header
│ │   ├─ Titre
│ │   ├─ Description métier
│ │   ├─ KPI rapides (si applicables)
│ │   └─ Actions principales
│ │
│ ├─ Sub-Module Navigation
│ │   (Tabs ou menu interne)
│ │
│ ├─ Content Area
│ │   (Table / Cards / Charts)
│ │
│ └─ Modals (CRUD / Wizard / Validation)
└──────────────────────────────────────────────┘
```

👉 **Aucun module ne déroge à cette structure.**

---

## 🧩 Composants du blueprint

### 1. ModuleContainer

Wrapper principal qui structure tous les modules.

```tsx
import { ModuleContainer } from '@/components/modules/blueprint';

<ModuleContainer
  header={{
    title: 'Finances & Économat',
    description: 'Suivi des frais, paiements et trésorerie',
    icon: 'dollarSign',
    kpis: [
      { label: 'Recettes', value: '2.5M', icon: 'trendingUp', trend: 'up' },
      { label: 'Impayés', value: '150K', icon: 'alertCircle', trend: 'down' },
    ],
    actions: (
      <button onClick={handleCreate}>Nouveau paiement</button>
    ),
  }}
  subModules={{
    modules: [
      { id: 'config', label: 'Configuration', href: '/app/finance/config' },
      { id: 'payments', label: 'Encaissements', href: '/app/finance/payments' },
      { id: 'expenses', label: 'Dépenses', href: '/app/finance/expenses' },
      { id: 'treasury', label: 'Trésorerie', href: '/app/finance/treasury' },
      { id: 'reports', label: 'Rapports', href: '/app/finance/reports' },
    ],
  }}
  content={{
    layout: 'table',
    filters: <FiltersComponent />,
    toolbar: <ToolbarComponent />,
    children: <TableComponent />,
    pagination: <PaginationComponent />,
  }}
/>
```

### 2. ModuleHeader

Header obligatoire pour tous les modules.

**Contient toujours :**
- Nom du module
- Phrase métier courte
- Actions principales
- KPI clés (si décisionnel)

**Props :**
- `title` (string, requis) : Nom du module
- `description` (string, optionnel) : Description métier
- `icon` (string, optionnel) : Icône du module
- `badge` (ReactNode, optionnel) : Badge (statut, version)
- `kpis` (ModuleKPI[], optionnel) : KPI clés (max 4)
- `actions` (ReactNode, optionnel) : Actions principales
- `customContent` (ReactNode, optionnel) : Contenu personnalisé

### 3. SubModuleNavigation

Navigation interne par sous-modules (3 à 7 max).

**Règles :**
- 3 à 7 sous-modules maximum
- Ordre logique du travail réel
- Noms métier, jamais techniques

**Props :**
- `modules` (SubModule[], requis) : Liste des sous-modules
- `activeModuleId` (string, optionnel) : Sous-module actif
- `onModuleChange` (function, optionnel) : Callback de changement

### 4. ModuleContentArea

Zone de contenu standardisée.

**Layouts supportés :**
- `table` : Table structurée (par défaut)
- `cards` : Cartes visuelles
- `grid` : Grille
- `chart` : Graphiques
- `form` : Formulaires
- `custom` : Personnalisé

**Props :**
- `children` (ReactNode, requis) : Contenu principal
- `layout` (ContentLayout, optionnel) : Layout du contenu
- `filters` (ReactNode, optionnel) : Filtres persistants
- `toolbar` (ReactNode, optionnel) : Actions (recherche, export)
- `pagination` (ReactNode, optionnel) : Pagination
- `isLoading` (boolean, optionnel) : Chargement
- `error` (string, optionnel) : Message d'erreur
- `emptyMessage` (string, optionnel) : Message vide

### 5. Modals réutilisables

#### FormModal

Modal de formulaire standardisé.

```tsx
import { FormModal } from '@/components/modules/blueprint';

<FormModal
  title="Créer un paiement"
  isOpen={isOpen}
  onClose={handleClose}
  size="lg"
  actions={
    <>
      <button onClick={handleClose}>Annuler</button>
      <button onClick={handleSubmit}>Enregistrer</button>
    </>
  }
>
  <PaymentForm />
</FormModal>
```

#### ConfirmModal

Modal de confirmation standardisé.

```tsx
import { ConfirmModal } from '@/components/modules/blueprint';

<ConfirmModal
  title="Supprimer le paiement"
  message="Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible."
  type="danger"
  isOpen={isOpen}
  onConfirm={handleDelete}
  onCancel={handleClose}
  confirmLabel="Supprimer"
  cancelLabel="Annuler"
/>
```

#### WizardModal

Modal de formulaire multi-étapes.

```tsx
import { WizardModal } from '@/components/modules/blueprint';

<WizardModal
  title="Créer un élève"
  steps={[
    { id: 'info', label: 'Informations', content: <InfoStep /> },
    { id: 'guardian', label: 'Tuteur', content: <GuardianStep /> },
    { id: 'enrollment', label: 'Inscription', content: <EnrollmentStep /> },
  ]}
  isOpen={isOpen}
  onClose={handleClose}
  onSubmit={handleSubmit}
/>
```

#### ReadOnlyModal

Modal de lecture seule.

```tsx
import { ReadOnlyModal } from '@/components/modules/blueprint';

<ReadOnlyModal
  title="Détails du paiement"
  isOpen={isOpen}
  onClose={handleClose}
  actions={
    <button onClick={handleClose}>Fermer</button>
  }
>
  <PaymentDetails />
</ReadOnlyModal>
```

---

## 📐 Règles d'implémentation

### Règle 1 : Module Header obligatoire

Tous les modules DOIVENT avoir un `ModuleHeader`.

❌ **Interdit :**
```tsx
<div>
  <h1>Mon Module</h1>
  {/* ... */}
</div>
```

✅ **Correct :**
```tsx
<ModuleHeader
  title="Mon Module"
  description="Description métier"
  actions={<button>Action</button>}
/>
```

### Règle 2 : Navigation interne standardisée

Si un module a des sous-modules, utiliser `SubModuleNavigation`.

❌ **Interdit :**
```tsx
<div className="flex space-x-2">
  <button>Config</button>
  <button>Payments</button>
</div>
```

✅ **Correct :**
```tsx
<SubModuleNavigation
  modules={[
    { id: 'config', label: 'Configuration', href: '/app/finance/config' },
    { id: 'payments', label: 'Encaissements', href: '/app/finance/payments' },
  ]}
/>
```

### Règle 3 : Zone de contenu standardisée

Utiliser `ModuleContentArea` pour le contenu principal.

❌ **Interdit :**
```tsx
<div className="bg-white p-4">
  {/* Contenu libre */}
</div>
```

✅ **Correct :**
```tsx
<ModuleContentArea
  layout="table"
  filters={<Filters />}
  toolbar={<Toolbar />}
>
  <Table />
</ModuleContentArea>
```

### Règle 4 : Modals uniquement

Toutes les interactions CRUD passent par des modals.

❌ **Interdit :**
- Navigation vers une page de création
- Navigation vers une page d'édition
- Navigation vers une page de détails

✅ **Correct :**
- Modal de création
- Modal d'édition
- Modal de détails (lecture seule)

### Règle 5 : Contexte toujours visible

Afficher toujours :
- Année scolaire active
- Niveau scolaire actif (si concerné)
- Langue active (si bilingue)

Utiliser `useModuleContext()` pour accéder au contexte.

```tsx
import { useModuleContext } from '@/hooks/useModuleContext';

function MyModule() {
  const { academicYear, schoolLevel, isBilingualEnabled } = useModuleContext();
  
  return (
    <ModuleHeader
      title="Mon Module"
      description={`Année: ${academicYear?.label} | Niveau: ${schoolLevel?.label}`}
    />
  );
}
```

---

## ✅ Checklist d'implémentation

Avant de considérer un module comme "terminé", vérifier :

- [ ] Module utilise `ModuleContainer`
- [ ] Module a un `ModuleHeader` avec titre et description
- [ ] Module affiche les KPI clés (si décisionnel)
- [ ] Module a une navigation interne si nécessaire (3-7 sous-modules)
- [ ] Module utilise `ModuleContentArea` pour le contenu
- [ ] Module utilise les modals réutilisables (FormModal, ConfirmModal, etc.)
- [ ] Module affiche le contexte (année, niveau, langue)
- [ ] Module est responsive (desktop/mobile)
- [ ] Module respecte le design system (couleurs, typographie, spacing)
- [ ] Module est accessible (ARIA, focus, etc.)

---

## 📚 Exemples

### Exemple 1 : Module simple (sans sous-modules)

```tsx
'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function SimpleModulePage() {
  const { academicYear, schoolLevel } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Mon Module Simple',
        description: 'Description métier du module',
        icon: 'module',
        actions: (
          <button className="btn-primary">Nouveau</button>
        ),
      }}
      content={{
        layout: 'table',
        children: <MyTable />,
      }}
    />
  );
}
```

### Exemple 2 : Module avec sous-modules

```tsx
'use client';

import { ModuleContainer } from '@/components/modules/blueprint';

export default function ComplexModulePage() {
  return (
    <ModuleContainer
      header={{
        title: 'Finances & Économat',
        description: 'Suivi des frais, paiements et trésorerie',
        icon: 'dollarSign',
        kpis: [
          { label: 'Recettes', value: '2.5M', trend: 'up' },
          { label: 'Impayés', value: '150K', trend: 'down' },
        ],
      }}
      subModules={{
        modules: [
          { id: 'config', label: 'Configuration', href: '/app/finance/config' },
          { id: 'payments', label: 'Encaissements', href: '/app/finance/payments' },
          { id: 'expenses', label: 'Dépenses', href: '/app/finance/expenses' },
        ],
      }}
      content={{
        layout: 'table',
        filters: <PaymentFilters />,
        toolbar: <PaymentToolbar />,
        children: <PaymentsTable />,
        pagination: <Pagination />,
      }}
    />
  );
}
```

### Exemple 3 : Module avec modals

```tsx
'use client';

import { useState } from 'react';
import { ModuleContainer, FormModal, ConfirmModal } from '@/components/modules/blueprint';

export default function ModuleWithModalsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Mon Module',
          actions: (
            <button onClick={() => setIsCreateModalOpen(true)}>
              Créer
            </button>
          ),
        }}
        content={{
          layout: 'table',
          children: <MyTable onDelete={() => setIsDeleteModalOpen(true)} />,
        }}
      />

      <FormModal
        title="Créer un élément"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        actions={
          <>
            <button onClick={() => setIsCreateModalOpen(false)}>Annuler</button>
            <button onClick={handleSubmit}>Enregistrer</button>
          </>
        }
      >
        <MyForm />
      </FormModal>

      <ConfirmModal
        title="Supprimer l'élément"
        message="Êtes-vous sûr ?"
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </>
  );
}
```

---

## 🚫 Interdictions strictes

### ❌ Ne JAMAIS :

1. **Créer un header custom** → Utiliser `ModuleHeader`
2. **Créer une navigation custom** → Utiliser `SubModuleNavigation`
3. **Créer un modal custom** → Utiliser les modals réutilisables
4. **Naviguer vers une page de création/édition** → Utiliser des modals
5. **Ignorer le contexte** → Toujours afficher année/niveau/langue
6. **Dépasser 7 sous-modules** → Regrouper si nécessaire
7. **Utiliser des noms techniques** → Utiliser des noms métier
8. **Créer des composants hors blueprint** → Utiliser les composants standardisés

---

## 📖 Références

- **Composants :** `/components/modules/blueprint/`
- **Hooks :** `/hooks/useModuleContext.ts`
- **Design System :** `/docs/design-system.md` (à créer)

---

## 🎯 Objectif final

Garantir une interface cohérente, scalable et professionnelle sur l'ensemble d'Academia Hub.

**Avec ce blueprint :**
- ✅ Chaque module devient une formalité
- ✅ L'expérience utilisateur devient évidente
- ✅ La plateforme devient institutionnelle

