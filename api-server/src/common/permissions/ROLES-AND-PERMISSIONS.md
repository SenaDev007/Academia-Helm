# 🔐 SYSTÈME DE RÔLES ET PERMISSIONS - ACADEMIA HUB

## 📋 Vue d'ensemble

Ce document décrit le système strict de rôles et permissions d'Academia Hub, aligné avec la hiérarchie institutionnelle.

---

## 🏛️ HIÉRARCHIE DES RÔLES

### 🟥 NIVEAU PLATEFORME (GLOBAL)

#### 1. **Super Admin (Academia Hub)**
- **Portail**: Plateforme interne
- **Périmètre**: Toutes les écoles, tous les tenants
- **Pouvoirs**: Création école, suspension tenant, ORION plateforme, lecture globale

---

### 🟧 NIVEAU ÉCOLE — GOUVERNANCE

#### 2. **Promoteur**
- **Portail**: Portail École
- **Périmètre**: Propriétaire établissement
- **Pouvoirs**: Tous modules, décisions financières, ORION complet

#### 3. **Directeur**
- **Portail**: Portail École
- **Périmètre**: Gestion opérationnelle
- **Pouvoirs**: Élèves, pédagogique, examens, ORION opérationnel

---

### 🟩 NIVEAU ÉCOLE — ADMINISTRATION

#### 4. **Secrétaire**
- **Portail**: Portail École
- **Périmètre**: Administration scolaire
- **Pouvoirs**: Inscriptions, dossiers, documents

#### 5. **Comptable**
- **Portail**: Portail École
- **Périmètre**: Finances uniquement
- **Pouvoirs**: Encaissements, recouvrement, dépenses

#### 6. **Secrétaire–Comptable**
- **Portail**: Portail École
- **Périmètre**: Fusion Secrétaire + Comptable
- **Pouvoirs**: Union des deux rôles

---

### 🟦 NIVEAU PÉDAGOGIQUE — SECONDAIRE

#### 7. **Censeur**
- **Portail**: Portail École
- **Périmètre**: Secondaire uniquement
- **Pouvoirs**: Discipline, absences, organisation secondaire

#### 8. **Surveillant(e)**
- **Portail**: Portail École
- **Périmètre**: Vie scolaire secondaire
- **Pouvoirs**: Absences, retards, discipline, surveillance examens

---

### 🟨 NIVEAU ENSEIGNEMENT

#### 9. **Enseignant(e) / Instituteur(trice) / Professeur**
- **Portail**: Portail Enseignant
- **Périmètre**: Classes assignées
- **Pouvoirs**: Notes, fiches pédagogiques, cahier journal, consultation classes

---

### 🟩 NIVEAU FAMILLE

#### 10. **Parent**
- **Portail**: Portail Parents & Élèves
- **Périmètre**: Enfants uniquement
- **Pouvoirs**: Paiements, bulletins, communication

#### 11. **Élève**
- **Portail**: Portail Parents & Élèves
- **Périmètre**: Soi-même uniquement
- **Pouvoirs**: Consultation notes, emploi du temps, devoirs

---

## 🔐 ASSOCIATION RÔLE ↔ PORTAIL

| Rôle                 | Portail autorisé     |
| -------------------- | -------------------- |
| Super Admin          | Plateforme interne   |
| Promoteur            | Portail École        |
| Directeur            | Portail École        |
| Secrétaire           | Portail École        |
| Comptable            | Portail École        |
| Secrétaire-Comptable | Portail École        |
| Censeur              | Portail École        |
| Surveillant          | Portail École        |
| Enseignant           | Portail Enseignant   |
| Parent               | Portail Parent/Élève |
| Élève                | Portail Parent/Élève |

**Règle**: Impossible de se connecter ailleurs, même avec de bonnes infos.

---

## 📊 MATRICE DE PERMISSIONS

Voir `role-permissions.matrix.ts` pour la matrice complète.

### Actions de permission

- **READ** (👁️): Lecture seule
- **WRITE** (✅): Écriture
- **DELETE** (❌): Suppression
- **MANAGE** (🔧): Gestion complète (lecture + écriture + suppression)

### Modules

- `ELEVES`: Gestion des élèves
- `INSCRIPTIONS`: Inscriptions
- `DOCUMENTS_SCOLAIRES`: Documents scolaires
- `ORGANISATION_PEDAGOGIQUE`: Organisation pédagogique
- `MATERIEL_PEDAGOGIQUE`: Matériel pédagogique
- `EXAMENS`: Examens
- `BULLETINS`: Bulletins
- `FINANCES`: Finances
- `RECOUVREMENT`: Recouvrement
- `DEPENSES`: Dépenses
- `RH`: Ressources humaines
- `PAIE`: Paie
- `COMMUNICATION`: Communication
- `PARAMETRES`: Paramètres
- `ANNEES_SCOLAIRES`: Années scolaires
- `ORION`: ORION (IA de pilotage)
- `QHSE`: QHSE

---

## 🛠️ UTILISATION TECHNIQUE

### Guards

#### 1. PortalAccessGuard
Vérifie que l'utilisateur accède au portail autorisé.

```typescript
@UseGuards(JwtAuthGuard, PortalAccessGuard)
@Controller('api/students')
export class StudentsController {}
```

#### 2. ModulePermissionGuard
Vérifie les permissions sur un module.

```typescript
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.ELEVES)
@RequiredPermission(PermissionAction.MANAGE)
@Controller('api/students')
export class StudentsController {}
```

### Décorateurs

#### @RequiredModule
Spécifie le module requis.

```typescript
@RequiredModule(Module.FINANCES)
@Get()
async findAll() {}
```

#### @RequiredPermission
Spécifie l'action requise (par défaut: READ).

```typescript
@RequiredModule(Module.FINANCES)
@RequiredPermission(PermissionAction.MANAGE)
@Post()
async create() {}
```

### Service PermissionsService

```typescript
constructor(private permissionsService: PermissionsService) {}

// Vérifier une permission
const canManage = this.permissionsService.hasPermission(
  UserRole.DIRECTEUR,
  Module.ELEVES,
  PermissionAction.MANAGE
);

// Récupérer les modules accessibles
const modules = this.permissionsService.getAccessibleModules(UserRole.ENSEIGNANT);

// Récupérer le portail autorisé
const portal = this.permissionsService.getAuthorizedPortal(UserRole.DIRECTEUR);
```

---

## 🚀 DASHBOARDS PAR RÔLE

### Super Admin — Dashboard Plateforme
- Nombre d'écoles actives
- Abonnements en cours / expirés
- Alertes ORION plateforme
- Dernières écoles créées
- Recherche école
- Logs & audits

### Promoteur — Dashboard Stratégique
- Recettes globales
- Impayés critiques
- Effectif total
- Résumé ORION
- Sélecteur année scolaire
- Alertes prioritaires

### Directeur — Dashboard Opérationnel
- Classes & effectifs
- Examens en cours
- Absences du jour
- Messages à valider
- ORION opérationnel
- KPI pédagogiques

### Secrétaire
- Inscriptions en attente
- Documents à générer
- Nouveaux élèves
- Messages administratifs

### Comptable
- Paiements du jour
- Recouvrement
- Impayés
- Clôture journalière
- Trésorerie

### Censeur
- Absences critiques
- Incidents disciplinaires
- Organisation secondaire
- Surveillance examens

### Enseignant
- Mes classes
- Notes à saisir
- Documents pédagogiques
- Emploi du temps
- Notifications direction

### Parent
- Situation scolaire enfant
- Solde scolarité
- Bulletins
- Messages école
- Payer scolarité (Fedapay)

---

## 📝 NOTES IMPORTANTES

1. **Un utilisateur = un rôle principal par session**
   - Les cumuls se gèrent via permissions, pas via confusion

2. **Permissions pilotent l'UI**
   - Pas de menus "fantômes"
   - Pas de boutons désactivés inutiles
   - La permission pilote l'affichage

3. **Contexte obligatoire**
   - `tenant_id` (sauf Super Admin)
   - `academic_year_id` (toujours en contexte)
   - `user_id` et `role`

4. **Audit des accès**
   - Toutes les tentatives d'accès sont loggées
   - Les violations sont tracées

---

## 🔄 MIGRATION DES RÔLES EXISTANTS

Le système utilise le champ `role` existant dans `User` et le normalise vers `UserRole`.

Mapping automatique:
- `SUPER_DIRECTOR` → `DIRECTEUR`
- `ADMIN` → `DIRECTEUR`
- `TEACHER` → `ENSEIGNANT`
- `STUDENT` → `ELEVE`
- etc.

---

**Date de création**: 2024
**Dernière mise à jour**: 2024
**Version**: 1.0.0
