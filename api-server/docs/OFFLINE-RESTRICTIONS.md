# 🚫 Opérations Interdites Offline - Academia Hub

**Date** : Documentation restrictions offline  
**Statut** : ✅ **Règles définies**

---

## 🎯 Principe Fondamental

Certaines opérations nécessitent une connexion active car elles impliquent :
- Validation serveur obligatoire
- Paiements en ligne
- Génération de documents officiels signés
- Actions administratives critiques

---

## ❌ OPÉRATIONS INTERDITES OFFLINE

### 1. Paiements Fedapay

**Raison** : Nécessite connexion API externe, validation transaction en temps réel

**Opérations interdites** :
- Création paiement via Fedapay (`paymentMethod = 'FEDAPAY'`)
- Initiation flux de paiement Fedapay
- Validation transaction Fedapay
- Récupération statut paiement Fedapay

**Message utilisateur** :
> "Les paiements Fedapay nécessitent une connexion internet active. Veuillez vous connecter pour procéder au paiement."

---

### 2. Validation de Paiements

**Raison** : Validation serveur, règles métier complexes, génération reçus

**Opérations interdites** :
- Validation paiement par administrateur
- Génération reçu après validation
- Confirmation paiement (changement `status = 'validated'`)
- Annulation paiement validé

**Message utilisateur** :
> "La validation des paiements nécessite une connexion serveur. Veuillez vous connecter pour valider ce paiement."

---

### 3. Suppression de Données

**Raison** : Traçabilité, audit, récupération impossible

**Opérations interdites** :
- Suppression physique (`DELETE`) de toute table métier
- Suppression d'élèves, paiements, notes, etc.
- Archivage définitif de données

**Note** : Le **soft delete** (`status = 'DELETED'`) est autorisé offline.

**Message utilisateur** :
> "La suppression définitive nécessite une connexion serveur pour traçabilité. Utilisez la désactivation en mode offline."

---

### 4. Actions Super Admin

**Raison** : Accès système, configurations critiques, sécurité

**Opérations interdites** :
- Création/modification de tenants
- Configuration système globale
- Gestion des utilisateurs Super Admin
- Modification paramètres de sécurité critiques

**Message utilisateur** :
> "Cette action d'administration système nécessite une connexion serveur sécurisée."

---

### 5. Génération Documents Officiels Finaux

**Raison** : Signature électronique, validation serveur, archivage

**Opérations interdites** :
- Génération reçu officiel (PDF signé)
- Génération bulletin scolaire final
- Génération carte d'identité élève
- Génération attestations officielles

**Note** : La **préparation** et **prévisualisation** de documents sont autorisées offline.

**Message utilisateur** :
> "La génération du document officiel final nécessite une signature serveur. La prévisualisation est disponible en mode offline."

---

## ✅ OPÉRATIONS AUTORISÉES OFFLINE

### 1. Saisie Pédagogique

**Opérations autorisées** :
- Création/modification notes
- Création/modification devoirs
- Saisie présences/absences
- Ajout commentaires pédagogiques
- Préparation fiches pédagogiques

**Tables concernées** :
- `grades`
- `homework_entries`
- `attendance_records`
- `absences`
- `pedagogical_documents` (statut DRAFT)

---

### 2. Pré-inscriptions

**Opérations autorisées** :
- Création demande inscription
- Modification données pré-inscription
- Ajout documents pré-inscription
- Validation pré-inscription (statut PENDING)

**Tables concernées** :
- `student_enrollments` (statut PENDING)
- `student_documents` (type PRE_INSCRIPTION)

**Note** : La validation finale nécessite connexion.

---

### 3. Saisie Absences

**Opérations autorisées** :
- Enregistrement présence/absence
- Justification absences
- Modification absences (si non validées)

**Tables concernées** :
- `attendance_records`
- `absences` (statut PENDING)

**Note** : La validation officielle nécessite connexion.

---

### 4. Préparation Documents

**Opérations autorisées** :
- Création brouillon document
- Prévisualisation document
- Modification contenu document
- Ajout annotations

**Tables concernées** :
- `student_documents` (statut DRAFT)
- `pedagogical_documents` (statut DRAFT)
- `report_cards` (statut DRAFT)

**Note** : La génération finale nécessite connexion.

---

## 🔒 Implémentation Client

### Vérification Opération Autorisée Offline

```typescript
/**
 * Vérifie si une opération est autorisée en mode offline
 */
function isOperationAllowedOffline(
  tableName: string,
  operationType: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: any,
): { allowed: boolean; reason?: string } {
  // 1. Suppression physique interdite
  if (operationType === 'DELETE' && payload.status !== 'DELETED') {
    return {
      allowed: false,
      reason: 'La suppression définitive nécessite une connexion serveur pour traçabilité. Utilisez la désactivation en mode offline.',
    };
  }

  // 2. Paiements Fedapay interdits
  if (tableName === 'payments' && payload.paymentMethod === 'FEDAPAY') {
    return {
      allowed: false,
      reason: 'Les paiements Fedapay nécessitent une connexion internet active. Veuillez vous connecter pour procéder au paiement.',
    };
  }

  // 3. Validation paiements interdite
  if (tableName === 'payments' && payload.status === 'validated') {
    return {
      allowed: false,
      reason: 'La validation des paiements nécessite une connexion serveur. Veuillez vous connecter pour valider ce paiement.',
    };
  }

  // 4. Génération documents officiels interdite
  if (
    (tableName === 'payment_receipts' || tableName === 'report_cards') &&
    payload.status === 'FINAL'
  ) {
    return {
      allowed: false,
      reason: 'La génération du document officiel final nécessite une signature serveur. La prévisualisation est disponible en mode offline.',
    };
  }

  // 5. Actions Super Admin interdites
  if (tableName === 'tenants' || tableName === 'users') {
    const userRole = getCurrentUserRole();
    if (userRole === 'SUPER_ADMIN' && (operationType === 'INSERT' || operationType === 'UPDATE')) {
      return {
        allowed: false,
        reason: 'Cette action d\'administration système nécessite une connexion serveur sécurisée.',
      };
    }
  }

  // Opération autorisée
  return { allowed: true };
}
```

---

### Désactivation Boutons/Éléments UI

```typescript
/**
 * Désactive les boutons/actions interdites en mode offline
 */
function disableOfflineRestrictedActions() {
  const isOffline = !navigator.onLine;

  if (isOffline) {
    // Désactiver bouton "Payer avec Fedapay"
    const fedapayButton = document.querySelector('[data-action="fedapay-payment"]');
    if (fedapayButton) {
      fedapayButton.disabled = true;
      fedapayButton.setAttribute('title', 'Paiements Fedapay nécessitent une connexion internet');
    }

    // Désactiver bouton "Valider paiement"
    const validatePaymentButton = document.querySelector('[data-action="validate-payment"]');
    if (validatePaymentButton) {
      validatePaymentButton.disabled = true;
      validatePaymentButton.setAttribute('title', 'Validation nécessite une connexion serveur');
    }

    // Désactiver bouton "Supprimer définitivement"
    const deleteButton = document.querySelector('[data-action="delete-permanent"]');
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.setAttribute('title', 'Suppression définitive nécessite une connexion serveur');
    }

    // Désactiver bouton "Générer document officiel"
    const generateDocButton = document.querySelector('[data-action="generate-official-document"]');
    if (generateDocButton) {
      generateDocButton.disabled = true;
      generateDocButton.setAttribute('title', 'Génération nécessite une signature serveur');
    }
  }
}
```

---

## 📋 Tableau Récapitulatif

| Opération | Offline | Raison | Alternative Offline |
|-----------|---------|--------|-------------------|
| **Paiement Fedapay** | ❌ | API externe | Aucune |
| **Validation paiement** | ❌ | Règles métier serveur | Création paiement (PENDING) |
| **Suppression physique** | ❌ | Traçabilité | Soft delete (DELETED) |
| **Actions Super Admin** | ❌ | Sécurité | Aucune |
| **Génération document final** | ❌ | Signature serveur | Prévisualisation (DRAFT) |
| **Saisie pédagogique** | ✅ | - | - |
| **Pré-inscriptions** | ✅ | - | - |
| **Saisie absences** | ✅ | - | - |
| **Préparation documents** | ✅ | - | - |

---

## ✅ Checklist Implémentation

### Côté Client

- [ ] Détection mode offline (`navigator.onLine`)
- [ ] Vérification opération autorisée avant exécution
- [ ] Désactivation boutons interdits en mode offline
- [ ] Affichage badge "Mode hors connexion"
- [ ] Messages utilisateur clairs pour chaque restriction
- [ ] Validation côté client avant sync

### Côté Serveur

- [ ] Validation règles métier serveur (même si offline)
- [ ] Rejet paiements Fedapay sans connexion API
- [ ] Rejet suppressions physiques (soft delete uniquement)
- [ ] Rejet documents officiels sans signature serveur

---

## 🎨 Badge "Mode Hors Connexion"

**Design** :
- Badge rouge/orange discret en haut de l'interface
- Icône WiFi barrée
- Texte : "Mode hors connexion"

**Comportement** :
- Affiché uniquement si `!navigator.onLine`
- Masqué automatiquement à la reconnexion
- Clickable pour voir détails/actions en attente

---

**Les opérations interdites offline sont maintenant documentées !** ✅
