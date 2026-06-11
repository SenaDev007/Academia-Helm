# 🏫 Architecture Multi-Écoles (Multi-School)

## Vue d'ensemble

Le système multi-écoles permet à un **promoteur (SUPER_DIRECTOR)** de gérer plusieurs établissements scolaires depuis un seul compte, tout en conservant une **isolation stricte des données** entre établissements.

---

## 🎯 Objectifs

- **Un compte promoteur** pour gérer plusieurs écoles
- **Vues séparées** : chaque établissement conserve son propre dashboard
- **Bilans consolidés** : vue agrégée en lecture seule pour le promoteur
- **Isolation stricte** : aucune opération ne peut mélanger les données entre établissements

---

## 📋 Modélisation

### Entités

#### 1. **SchoolGroup** (Groupe Scolaire)

```typescript
interface SchoolGroup {
  id: string;
  name: string; // Nom du groupe (ex: "Groupe Éducatif ABC")
  ownerId: string; // ID du promoteur (SUPER_DIRECTOR)
  tenantIds: string[]; // Liste des IDs des établissements
  createdAt: string;
  updatedAt: string;
}
```

**Rôle** : Regroupe plusieurs établissements (tenants) sous un même promoteur.

#### 2. **User** (Étendu)

```typescript
interface User {
  // ... champs existants
  role: 'admin' | 'director' | 'teacher' | 'secretary' | 'SUPER_DIRECTOR';
  tenantId: string; // Tenant actif (pour SUPER_DIRECTOR, c'est le tenant sélectionné)
  accessibleTenants?: Tenant[]; // Liste des tenants accessibles (SUPER_DIRECTOR uniquement)
  schoolGroupId?: string; // ID du groupe scolaire si promoteur
}
```

**Nouveau rôle** : `SUPER_DIRECTOR` (Promoteur)
- Peut accéder à plusieurs établissements
- Peut basculer entre établissements
- Peut consulter les bilans consolidés

#### 3. **Tenant** (Inchangé)

Chaque établissement reste un tenant isolé avec ses propres données.

---

## 🔄 Flux de Bascule Entre Établissements

### 1. Sélection du Tenant

Le promoteur voit un **sélecteur de tenant** dans le header du dashboard :

```
[École Primaire Les Étoiles ▼]
```

### 2. Changement de Tenant

1. Clic sur le sélecteur → Menu déroulant avec liste des établissements
2. Sélection d'un établissement → Appel API `POST /auth/switch-tenant`
3. Redirection automatique vers le sous-domaine du nouveau tenant :
   ```
   https://nouvelle-ecole.academiahub.com/app
   ```

### 3. Isolation Garantie

- Chaque établissement conserve son sous-domaine unique
- Les données restent strictement isolées
- Aucune opération ne peut mélanger les données

---

## 📊 Bilans Consolidés

### Page `/app/consolidated`

**Accès** : Uniquement pour les `SUPER_DIRECTOR`

**Fonctionnalités** :
- Vue d'ensemble consolidée de tous les établissements
- Indicateurs agrégés :
  - Effectif total (somme)
  - Enseignants total (somme)
  - Recettes consolidées (somme)
  - Taux de recouvrement moyen (moyenne pondérée)
- Bilans par établissement (données isolées, pas de mélange)

**Contraintes** :
- ✅ **Lecture seule** : Aucune modification possible
- ✅ **Agrégation explicite** : Calculs effectués uniquement pour cette vue
- ✅ **Isolation préservée** : Aucune opération ne mélange les données

---

## 🔐 Sécurité & Isolation

### Principes Fondamentaux

1. **Isolation des Données**
   - Chaque tenant conserve ses données dans sa propre base/namespace
   - Aucune requête ne peut accéder aux données d'un autre tenant
   - Les agrégations consolidées sont calculées explicitement, jamais stockées

2. **Isolation Opérationnelle**
   - Aucune opération (CRUD) ne peut mélanger les données entre tenants
   - Chaque établissement fonctionne indépendamment
   - Les bilans consolidés sont en **lecture seule**

3. **Contrôle d'Accès**
   - Seuls les `SUPER_DIRECTOR` peuvent accéder à plusieurs tenants
   - Le backend vérifie les permissions à chaque requête
   - Le frontend ne fait que présenter les données autorisées

---

## 🛠️ Implémentation Technique

### Services

#### `tenant-switch.service.ts`

```typescript
// Changer de tenant actif
switchTenant(tenantId: string, subdomain: string): Promise<void>

// Récupérer les tenants accessibles
getAccessibleTenants(): Promise<Tenant[]>
```

#### `consolidated-kpi.service.ts`

```typescript
// Récupérer les bilans consolidés
getConsolidatedKpi(period?: string): Promise<ConsolidatedKpiResponse>
```

### Composants

#### `TenantSwitcher`

Composant de sélection/bascule de tenant dans le header.

**Affichage** :
- Uniquement pour les `SUPER_DIRECTOR`
- Menu déroulant avec liste des établissements
- Indication du tenant actif

#### `ConsolidatedKpiPage`

Page de bilans consolidés multi-écoles.

**Contenu** :
- Indicateurs consolidés (sommes, moyennes)
- Bilans par établissement (données isolées)
- Note importante sur l'isolation des données

---

## 📡 API Backend Attendue

### Routes Requises

1. **`POST /auth/switch-tenant`**
   - Change le tenant actif pour l'utilisateur
   - Vérifie que l'utilisateur a accès au tenant
   - Retourne la nouvelle session

2. **`GET /auth/accessible-tenants`**
   - Liste des tenants accessibles pour l'utilisateur actuel
   - Retourne uniquement les tenants du groupe (si SUPER_DIRECTOR)

3. **`GET /analytics/consolidated`**
   - Bilans consolidés pour tous les établissements du groupe
   - Paramètre optionnel `period` pour la période de référence
   - Retourne `ConsolidatedKpiResponse`

---

## 🎨 UX & Navigation

### Header Dashboard

Pour les `SUPER_DIRECTOR`, le header affiche :
- **Sélecteur de tenant** : Bouton avec nom de l'établissement actif
- **Badge "Promoteur"** : Indication du rôle
- **Menu déroulant** : Liste des établissements accessibles

### Navigation

- **Dashboard principal** (`/app`) : Vue de l'établissement actif
- **Bilans consolidés** (`/app/consolidated`) : Vue agrégée multi-écoles
- **Autres modules** : Fonctionnent normalement pour le tenant actif

---

## ⚠️ Contraintes & Limitations

### Isolation Stricte

- ❌ **Aucune opération cross-tenant** : Impossible de créer/modifier des données d'un autre tenant
- ❌ **Aucun mélange de données** : Les données restent strictement isolées
- ✅ **Agrégation explicite uniquement** : Les bilans consolidés sont calculés à la volée, jamais stockés

### Performance

- Les agrégations consolidées peuvent être coûteuses si beaucoup d'établissements
- Le backend doit optimiser les requêtes d'agrégation
- Cache recommandé pour les bilans consolidés (avec invalidation appropriée)

### Sécurité

- Vérification stricte des permissions côté backend
- Validation que l'utilisateur appartient bien au groupe scolaire
- Isolation garantie au niveau base de données

---

## 📝 Exemple d'Utilisation

### Scénario : Promoteur avec 3 Écoles

1. **Connexion** : Le promoteur se connecte avec son compte `SUPER_DIRECTOR`
2. **Sélection** : Il voit le sélecteur avec "École Primaire Les Étoiles" (tenant actif)
3. **Bascule** : Il clique et sélectionne "Collège Excellence"
4. **Redirection** : Il est redirigé vers `excellence.academiahub.com/app`
5. **Consultation** : Il consulte le dashboard de "Collège Excellence"
6. **Bilans consolidés** : Il accède à `/app/consolidated` pour voir la vue agrégée des 3 écoles

---

## 🔄 Évolutions Futures

### Possibilités

- **Gestion centralisée** : Création/modification d'établissements depuis le compte promoteur
- **Rapports comparatifs** : Comparaison entre établissements
- **Transferts** : Transfert d'élèves entre établissements (avec workflow d'approbation)

### Limitations à Respecter

- Isolation des données opérationnelles
- Pas de mélange automatique
- Consentement explicite pour toute opération cross-tenant

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2025

