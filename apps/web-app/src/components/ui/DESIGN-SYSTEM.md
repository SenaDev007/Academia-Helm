# 🎨 DESIGN SYSTEM - ACADEMIA HUB

## 📋 Vue d'ensemble

Design System opérationnel pour Academia Hub, capable de supporter :
- ✅ 10+ modules
- ✅ 12+ rôles utilisateurs
- ✅ Croissance produit long terme
- ✅ Sans refonte visuelle future

---

## 🧩 Structure des Composants

```
components/ui/
├── cards/
│   ├── StatCard.tsx           // KPI
│   ├── InfoCard.tsx
│   ├── AlertCard.tsx          // ORION
│   ├── ActionCard.tsx
│
├── tables/
│   ├── DataTable.tsx
│   ├── TableToolbar.tsx
│   ├── TableActions.tsx
│
├── forms/
│   ├── FormSection.tsx
│   ├── FormField.tsx
│   ├── FormActions.tsx
│
├── navigation/
│   ├── ModuleTabs.tsx
│   ├── Breadcrumbs.tsx
│
├── feedback/
│   ├── EmptyState.tsx
│   ├── LoadingState.tsx
│   ├── ErrorState.tsx
│
├── orion/
│   ├── OrionPanel.tsx
│   ├── OrionAlertItem.tsx
│   ├── OrionSummary.tsx
│
└── modals/
    └── ModalBlueprint.tsx
```

---

## 🎯 Principes

### 1. Composants Génériques
- ✅ Aucun composant spécifique à un seul module
- ✅ Réutilisables dans tous les contextes
- ✅ Personnalisables via props

### 2. Dashboards par Assemblage
- ✅ Un dashboard = assemblage de composants standards
- ✅ Aucun style inline
- ✅ Aucun layout local
- ✅ Les rôles déterminent la visibilité, pas la structure

### 3. ORION Intégré
- ✅ Utiliser `OrionPanel`, `OrionAlertItem`, `OrionSummary`
- ✅ Partout où ORION doit être visible
- ✅ Style cohérent

### 4. Modals Standardisés
- ✅ Utiliser exclusivement `ModalBlueprint`
- ✅ Types : confirmation, création, édition, validation, rejet
- ✅ Aucun modal custom

---

## 📖 Guide d'Utilisation

### Cards

#### StatCard (KPI)
```tsx
import { StatCard } from '@/components/ui';

<StatCard
  title="Total Élèves"
  value={1250}
  icon={Users}
  trend={{ value: 5, label: 'vs mois dernier', isPositive: true }}
  variant="primary"
/>
```

#### AlertCard (ORION)
```tsx
import { AlertCard } from '@/components/ui';

<AlertCard
  title="Alerte importante"
  message="Description de l'alerte"
  severity="warning"
  action={{ label: 'Voir détails', onClick: () => {} }}
/>
```

### Tables

```tsx
import { DataTable, TableToolbar } from '@/components/ui';

<TableToolbar
  searchValue={search}
  onSearchChange={setSearch}
  showAddButton
  onAddClick={() => {}}
/>

<DataTable
  data={items}
  columns={columns}
  keyExtractor={(item) => item.id}
/>
```

### Forms

```tsx
import { FormSection, FormField, FormActions } from '@/components/ui';

<FormSection title="Informations" description="Détails de base">
  <FormField label="Nom" required error={errors.name}>
    <Input {...register('name')} />
  </FormField>
</FormSection>

<FormActions
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  loading={isLoading}
/>
```

### Navigation

```tsx
import { ModuleTabs, Breadcrumbs } from '@/components/ui';

<Breadcrumbs
  items={[
    { label: 'Module', href: '/app/module' },
    { label: 'Page actuelle' },
  ]}
/>

<ModuleTabs
  tabs={[
    { id: 'tab1', label: 'Onglet 1', content: <div>...</div> },
    { id: 'tab2', label: 'Onglet 2', content: <div>...</div> },
  ]}
/>
```

### Feedback

```tsx
import { EmptyState, LoadingState, ErrorState } from '@/components/ui';

{loading && <LoadingState />}
{error && <ErrorState message={error} onRetry={refetch} />}
{data.length === 0 && (
  <EmptyState
    title="Aucune donnée"
    description="Commencez par ajouter..."
    action={{ label: 'Ajouter', onClick: () => {} }}
  />
)}
```

### ORION

```tsx
import { OrionPanel, OrionSummary } from '@/components/ui';

<OrionPanel
  alerts={alerts}
  summary={
    <OrionSummary
      metrics={[
        { label: 'Performance', value: '85%', trend: { value: 5, isPositive: true } },
      ]}
    />
  }
/>
```

### Modals

```tsx
import { ModalBlueprint } from '@/components/ui';

<ModalBlueprint
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirmer l'action"
  type="confirmation"
  description="Êtes-vous sûr de vouloir continuer ?"
  primaryAction={{
    label: 'Confirmer',
    onClick: handleConfirm,
  }}
  secondaryAction={{
    label: 'Annuler',
    onClick: () => setIsOpen(false),
  }}
/>
```

---

## 🎨 Responsive & Mobile

### Desktop
- Layout complet
- Sidebar visible
- Grid multi-colonnes

### Mobile
- Empilement vertical
- Sidebar collapsible
- Cartes pleine largeur
- Mobile-first pour Enseignant/Parent

---

## ✅ Checklist

- [x] Composants cards créés
- [x] Composants tables créés
- [x] Composants forms créés
- [x] Composants navigation créés
- [x] Composants feedback créés
- [x] Composants ORION créés
- [x] Modal Blueprint créé
- [x] Exports centralisés
- [x] Documentation complète

---

**Status**: ✅ **DESIGN SYSTEM OPÉRATIONNEL**

**Version**: 1.0.0
**Date**: 2024
