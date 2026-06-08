# 🧱 ACADEMIA HUB — MODAL BLUEPRINT OFFICIEL (v1)

## 📋 Table des matières

1. [Philosophie des modals](#philosophie-des-modals)
2. [Structure visuelle standard](#structure-visuelle-standard)
3. [Types officiels de modals](#types-officiels-de-modals)
4. [Règles UX strictes](#règles-ux-strictes)
5. [Intégration ORION](#intégration-orion)
6. [Architecture technique](#architecture-technique)
7. [Exemples d'utilisation](#exemples-dutilisation)
8. [Checklist de validation](#checklist-de-validation)
9. [Anti-patterns](#anti-patterns)

---

## 🎯 Philosophie des modals

Un modal dans Academia Hub est :

- ✅ **une unité d'action**
- ✅ **contextuelle**
- ✅ **courte**
- ✅ **responsable**

❌ Pas une page déguisée  
❌ Pas un fourre-tout  
❌ Pas de logique métier cachée

---

## 🏗️ Structure visuelle standard

```
┌──────────────────────────────────────────────┐
│ MODAL HEADER
│ ├─ Titre clair
│ ├─ Sous-titre métier (optionnel)
│ ├─ Contexte (année / niveau / langue)
│ └─ Bouton fermer (X)
├──────────────────────────────────────────────┤
│ MODAL BODY
│ ├─ Contenu principal
│ │   ├─ Formulaire
│ │   ├─ Table
│ │   ├─ Résumé
│ │   └─ Message
│ └─ Messages d'erreur / info
├──────────────────────────────────────────────┤
│ MODAL FOOTER
│ ├─ Bouton Annuler
│ ├─ Bouton Action principale
│ └─ (optionnel) Action secondaire
└──────────────────────────────────────────────┘
```

👉 **Aucun modal ne déroge à cette structure.**

---

## 🧩 Types officiels de modals

Ces types sont **les seuls autorisés**.

### 1. FormModal — CRUD Standard

**Usage :**
- Créer
- Modifier
- Paramétrer

**Caractéristiques :**
- Formulaire typé
- Validation en temps réel
- Champs requis visibles

**Boutons :**
- Annuler
- Enregistrer

**Exemples :**
- Ajouter élève
- Créer matière
- Modifier frais scolaire

```tsx
import { FormModal } from '@/components/modules/blueprint';

<FormModal
  title="Créer un élève"
  subtitle="Remplissez les informations de l'élève"
  isOpen={isOpen}
  onClose={handleClose}
  actions={
    <>
      <button onClick={handleClose}>Annuler</button>
      <button onClick={handleSubmit}>Enregistrer</button>
    </>
  }
>
  <StudentForm />
</FormModal>
```

### 2. ConfirmModal — Action Irréversible

**Usage :**
- Suppression logique
- Annulation
- Recalcul

**Caractéristiques :**
- Message explicite
- Conséquences affichées

**Boutons :**
- Annuler
- Confirmer

**Exemples :**
- Annuler paiement
- Recalculer moyennes
- Archiver élève

```tsx
import { ConfirmModal } from '@/components/modules/blueprint';

<ConfirmModal
  title="Supprimer l'élève"
  message="Êtes-vous sûr de vouloir supprimer cet élève ? Cette action est irréversible."
  type="danger"
  isOpen={isOpen}
  onConfirm={handleDelete}
  onCancel={handleClose}
  confirmLabel="Supprimer"
/>
```

### 3. CriticalModal — Action Sensible

> 🔒 Modal BLOQUANT

**Usage :**
- Finances
- Examens
- RH
- Validation officielle

**Caractéristiques :**
- ESC désactivé
- Overlay clic désactivé
- Style danger
- Mention "irréversible"

**Boutons :**
- Annuler
- Valider (style danger)

**Exemples :**
- Valider notes
- Clôturer caisse
- Valider paie

```tsx
import { CriticalModal } from '@/components/modules/blueprint';

<CriticalModal
  title="Valider les notes"
  message="Vous êtes sur le point de valider définitivement les notes de cette période."
  warning="Cette action est irréversible et déclenchera la génération des bulletins."
  details={
    <div>
      <p>Période: {period.name}</p>
      <p>Nombre de notes: {notesCount}</p>
    </div>
  }
  isOpen={isOpen}
  onConfirm={handleValidate}
  onCancel={handleClose}
  confirmLabel="Valider définitivement"
/>
```

### 4. WizardModal — Processus Complexe

**Usage :**
- Inscription élève
- Paie
- Examens nationaux

**Structure :**
```
Étape 1 → Étape 2 → Étape 3 → Confirmation
```

**Règles :**
- Validation par étape
- Navigation contrôlée
- Résumé final obligatoire

**Exemples :**
- Inscription candidat
- Création emploi du temps
- Préparation paie

```tsx
import { WizardModal } from '@/components/modules/blueprint';

<WizardModal
  title="Inscrire un élève"
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

### 5. ReadOnlyModal — Consultation

**Usage :**
- Détails
- Historique
- Lecture institutionnelle

**Caractéristiques :**
- Données non éditables
- Sections claires

**Boutons :**
- Fermer

**Exemples :**
- Historique élève
- Bulletin généré
- Compte rendu réunion

```tsx
import { ReadOnlyModal } from '@/components/modules/blueprint';

<ReadOnlyModal
  title="Détails de l'élève"
  isOpen={isOpen}
  onClose={handleClose}
  actions={
    <button onClick={handleClose}>Fermer</button>
  }
>
  <StudentDetails student={student} />
</ReadOnlyModal>
```

### 6. AlertModal — Blocage Métier

**Usage :**
- Incohérences détectées
- Conflit
- Règle violée

**Caractéristiques :**
- Affichage du problème
- Action requise claire
- Pas d'action destructive

**Exemples :**
- Conflit horaire
- Année scolaire inactive
- Module désactivé

```tsx
import { AlertModal } from '@/components/modules/blueprint';

<AlertModal
  title="Conflit d'horaire"
  message="Un conflit d'horaire a été détecté pour cette classe."
  type="error"
  details={
    <div>
      <p>Classe: {class.name}</p>
      <p>Conflit avec: {conflict.class.name}</p>
    </div>
  }
  isOpen={isOpen}
  onClose={handleClose}
  action={{
    label: 'Résoudre le conflit',
    onClick: handleResolve,
  }}
/>
```

---

## 📐 Règles UX strictes (non négociables)

### ❌ Interdictions

- ❌ Pas de modal sans titre clair
- ❌ Pas de scroll vertical infini
- ❌ Pas plus d'une action principale
- ❌ Pas de champs cachés
- ❌ Pas de modal custom hors blueprint

### ✅ Obligations

- ✅ Toujours afficher le contexte (année / niveau)
- ✅ Focus trap activé
- ✅ ESC désactivé sur modals critiques
- ✅ Validation en temps réel
- ✅ Messages d'erreur clairs

---

## 🧠 Intégration ORION (obligatoire)

Certains modals déclenchent :

- logs ORION
- alertes
- KPI

**Exemples :**
- Validation notes → Log ORION
- Clôture financière → Alerte ORION
- Décision disciplinaire → KPI ORION

👉 ORION **observe**, ne modifie jamais.

```tsx
// Exemple d'intégration ORION
const handleValidate = async () => {
  // Action métier
  await validateGrades(periodId);
  
  // Log ORION
  await orionService.log({
    type: 'GRADE_VALIDATION',
    resource: 'Period',
    resourceId: periodId,
    metadata: { periodName: period.name },
  });
};
```

---

## 🏗️ Architecture technique

### Composants

```
/components/modules/blueprint/modals/
  ├── BaseModal.tsx          (Composant de base)
  ├── FormModal.tsx          (CRUD standard)
  ├── ConfirmModal.tsx       (Action irréversible)
  ├── CriticalModal.tsx      (Action sensible)
  ├── WizardModal.tsx        (Processus complexe)
  ├── ReadOnlyModal.tsx      (Consultation)
  ├── AlertModal.tsx         (Blocage métier)
  └── ModalProvider.tsx      (Gestion globale)
```

### Gestion globale

```tsx
// Dans le layout principal
import { ModalProvider } from '@/components/modules/blueprint';

export default function Layout({ children }) {
  return (
    <ModalProvider>
      {children}
    </ModalProvider>
  );
}

// Dans un composant
import { useModal } from '@/hooks/useModal';

function MyComponent() {
  const { openFormModal, closeModal } = useModal();
  
  const handleCreate = () => {
    openFormModal('create-student', {
      title: 'Créer un élève',
      // ... props
    });
  };
}
```

---

## 📚 Exemples d'utilisation

### Exemple 1 : FormModal simple

```tsx
'use client';

import { useState } from 'react';
import { FormModal } from '@/components/modules/blueprint';

export default function StudentsPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Créer un élève</button>
      
      <FormModal
        title="Créer un élève"
        subtitle="Remplissez les informations de l'élève"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        actions={
          <>
            <button onClick={() => setIsOpen(false)}>Annuler</button>
            <button onClick={handleSubmit}>Enregistrer</button>
          </>
        }
      >
        <StudentForm />
      </FormModal>
    </>
  );
}
```

### Exemple 2 : CriticalModal avec ORION

```tsx
'use client';

import { useState } from 'react';
import { CriticalModal } from '@/components/modules/blueprint';
import { orionService } from '@/lib/orion';

export default function GradesPage() {
  const [isOpen, setIsOpen] = useState(false);

  const handleValidate = async () => {
    // Action métier
    await validateGrades(periodId);
    
    // Log ORION
    await orionService.log({
      type: 'GRADE_VALIDATION',
      resource: 'Period',
      resourceId: periodId,
    });
    
    setIsOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Valider les notes</button>
      
      <CriticalModal
        title="Valider les notes"
        message="Vous êtes sur le point de valider définitivement les notes."
        warning="Cette action est irréversible."
        isOpen={isOpen}
        onConfirm={handleValidate}
        onCancel={() => setIsOpen(false)}
        confirmLabel="Valider définitivement"
      />
    </>
  );
}
```

### Exemple 3 : AlertModal pour conflit

```tsx
'use client';

import { useState } from 'react';
import { AlertModal } from '@/components/modules/blueprint';

export default function TimetablePage() {
  const [conflict, setConflict] = useState(null);

  return (
    <>
      {conflict && (
        <AlertModal
          title="Conflit d'horaire"
          message="Un conflit d'horaire a été détecté."
          type="error"
          details={
            <div>
              <p>Classe: {conflict.class.name}</p>
              <p>Conflit avec: {conflict.conflictingClass.name}</p>
            </div>
          }
          isOpen={!!conflict}
          onClose={() => setConflict(null)}
          action={{
            label: 'Résoudre le conflit',
            onClick: () => {
              // Naviguer vers la résolution
              router.push(`/app/planning/resolve/${conflict.id}`);
              setConflict(null);
            },
          }}
        />
      )}
    </>
  );
}
```

---

## ✅ Checklist de validation

Avant de considérer un modal comme "terminé", vérifier :

- [ ] Modal utilise un type officiel (Form, Confirm, Critical, Wizard, ReadOnly, Alert)
- [ ] Modal a un titre clair
- [ ] Modal affiche le contexte (année, niveau, langue)
- [ ] Modal a une structure standardisée (Header, Body, Footer)
- [ ] Modal a un focus trap activé
- [ ] Modal a des messages d'erreur clairs
- [ ] Modal est accessible (ARIA, focus)
- [ ] Modal est responsive (desktop/mobile)
- [ ] Modal respecte le design system
- [ ] Modal intègre ORION si nécessaire (actions critiques)

---

## 🚫 Anti-patterns

### ❌ Ne JAMAIS :

1. **Créer un modal custom** → Utiliser les types officiels
2. **Ignorer le contexte** → Toujours afficher année/niveau/langue
3. **Scroll infini** → Limiter la hauteur du contenu
4. **Actions multiples** → Une seule action principale
5. **Champs cachés** → Tous les champs visibles
6. **Logique métier dans le modal** → Séparer la logique
7. **Modals imbriqués** → Un seul modal à la fois
8. **Ignorer ORION** → Logger les actions critiques

---

## 📖 Références

- **Composants :** `/components/modules/blueprint/modals/`
- **Hooks :** `/hooks/useModal.ts`
- **Provider :** `/components/modules/blueprint/modals/ModalProvider.tsx`
- **Module Blueprint :** `/docs/ui/module-blueprint.md`

---

## 🎯 Objectif final

Garantir une expérience modale cohérente, sécurisée et professionnelle sur l'ensemble d'Academia Hub.

**Avec ce Modal Blueprint :**
- ✅ UX cohérente et premium
- ✅ Sécurité institutionnelle renforcée
- ✅ Développement accéléré
- ✅ ORION exploitable proprement
- ✅ Base solide pour mobile & desktop

