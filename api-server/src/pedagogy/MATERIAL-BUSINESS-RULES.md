# 🔒 RÈGLES MÉTIER - MATÉRIEL & FOURNITURES PÉDAGOGIQUES

## 📋 Vue d'ensemble

Ce document décrit les règles métier **NON NÉGOCIABLES** implémentées pour le sous-module "Matériel & Fournitures pédagogiques" du Module 2.

---

## 🔐 RÈGLES STRUCTURELLES GLOBALES

### R1 — Contexte obligatoire ✅

**Implémentation**: `MaterialContextGuard`

Toute requête API doit contenir :
- ✅ `tenant_id` (obligatoire)
- ✅ `academic_year_id` (obligatoire pour écriture)
- ✅ `user_id` (obligatoire)
- ✅ `role` (obligatoire)

**Validation**:
- ❌ Aucune opération sans contexte complet
- ❌ Aucune écriture hors année scolaire active (sauf Super Admin)

**Fichiers**:
- `apps/api-server/src/pedagogy/guards/material-context.guard.ts`

---

### R2 — Séparation stricte par niveau scolaire ✅

**Implémentation**: Validation dans les services

- Un matériel est **rattaché à un niveau scolaire**
- Une attribution enseignant **ne peut concerner qu'un niveau qu'il enseigne**
- Un stock est **segmenté par niveau et classe**

**Validation**:
- ❌ Pas de mutualisation implicite entre niveaux
- ✅ Vérification que l'enseignant enseigne dans le niveau demandé

**Fichiers**:
- `apps/api-server/src/pedagogy/teacher-material-assignments-prisma.service.ts` (ligne 58-72)

---

### R3 — Traçabilité absolue ✅

**Implémentation**: `MaterialMovementsPrismaService` + `MaterialAuditInterceptor`

- Toute entrée / sortie de stock crée **obligatoirement** un `MaterialMovement`
- Le stock **ne se modifie jamais directement**
- Aucun `DELETE` physique

**Principe**: **Le mouvement est la vérité, le stock est une projection.**

**Fichiers**:
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts`
- `apps/api-server/src/pedagogy/interceptors/material-audit.interceptor.ts`

---

## 📦 RÈGLES DE GESTION DU STOCK

### R4 — Stock non négatif ✅

**Implémentation**: `MaterialStockGuard` + validation dans `updateStockAfterMovement`

Avant toute attribution :
- ✅ `quantityAvailable >= quantityDemandée`

Sinon :
- ❌ rejet API (`409 CONFLICT`)
- ✅ message explicite

**Fichiers**:
- `apps/api-server/src/pedagogy/guards/material-stock.guard.ts`
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts` (ligne 141-146, 163-167, 176-180)

---

### R5 — Achat / entrée en stock ✅

**Implémentation**: `MaterialMovementsPrismaService.updateStockAfterMovement`

Lors d'un achat :
- ✅ création `MaterialMovement (PURCHASE)`
- ✅ incrément `quantityTotal`
- ✅ incrément `quantityAvailable`

**Fichiers**:
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts` (ligne 133-136)

---

### R6 — Attribution à un enseignant ✅

**Implémentation**: `TeacherMaterialAssignmentsPrismaService` + `MaterialMovementsPrismaService`

Lors d'une attribution :
- ✅ création `MaterialMovement (ASSIGNMENT)`
- ✅ décrément `quantityAvailable`
- ✅ création `TeacherMaterialAssignment`
- ✅ signature numérique obligatoire (checkbox + timestamp)

**Fichiers**:
- `apps/api-server/src/pedagogy/teacher-material-assignments-prisma.service.ts`
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts` (ligne 138-146)

---

### R7 — Retour / fin d'année ✅

**Implémentation**: `MaterialMovementsPrismaService.updateStockAfterMovement`

Lors d'un retour :
- ✅ création `MaterialMovement (RETURN)`
- ✅ incrément `quantityAvailable`
- ✅ mise à jour de l'état du matériel

**Fichiers**:
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts` (ligne 148-154)

---

### R8 — Détérioration / perte ✅

**Implémentation**: `MaterialMovementsPrismaService.updateStockAfterMovement`

- ✅ `MaterialMovement (DAMAGE)` ou `(DECOMMISSION)`
- ✅ décrément définitif du stock
- ✅ justification obligatoire (notes)

**Fichiers**:
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts` (ligne 159-170)

---

## 👨‍🏫 RÈGLES CÔTÉ ENSEIGNANT

### R9 — Responsabilité annuelle ✅

**Implémentation**: `AnnualTeacherSuppliesPrismaService`

Chaque enseignant :
- ✅ possède une **fiche annuelle de dotation** (`AnnualTeacherSupply`)
- ✅ visible par :
  - directeur
  - promoteur
  - inspection (lecture seule)

**Fichiers**:
- `apps/api-server/src/pedagogy/annual-teacher-supplies-prisma.service.ts`

---

### R10 — Non-transférabilité ✅

**Implémentation**: `MaterialRbacGuard`

Un enseignant :
- ❌ ne peut pas transférer le matériel
- ❌ ne peut pas modifier la dotation
- ✅ peut consulter son historique

**Fichiers**:
- `apps/api-server/src/pedagogy/guards/material-rbac.guard.ts` (ligne 50-60)

---

## 🔐 RÈGLES DE DROITS (RBAC)

**Implémentation**: `MaterialRbacGuard`

| Rôle        | Droits                | Status |
| ----------- | --------------------- | ------ |
| Promoteur   | Tout                  | ✅     |
| Directeur   | Tout sauf suppression | ✅     |
| Comptable   | Lecture               | ✅     |
| Secrétaire  | Lecture               | ✅     |
| Enseignant  | Lecture personnelle   | ✅     |
| Super Admin | Tout                  | ✅     |

**Fichiers**:
- `apps/api-server/src/pedagogy/guards/material-rbac.guard.ts`

---

## 🧠 RÈGLES ORION (LECTURE SEULE)

ORION doit détecter :
- ✅ enseignant sous-doté
- ✅ stock incohérent
- ✅ matériel détérioré excessif
- ✅ niveau scolaire sous-équipé

**Contraintes**:
- ❌ ORION n'écrit jamais
- ❌ ORION ne corrige rien

**Note**: À implémenter dans `PedagogyOrionService` (lecture seule)

---

## 🔐 VALIDATIONS API IMPLÉMENTÉES

Chaque endpoint vérifie :

```typescript
✅ assertTenantContext()        // MaterialContextGuard
✅ assertAcademicYearActive()    // MaterialContextGuard
✅ assertUserRole()              // MaterialRbacGuard
✅ assertSchoolLevelAccess()    // Validation dans services
✅ assertStockAvailability()    // MaterialStockGuard
```

---

## 📁 STRUCTURE DES FICHIERS

### Guards
- `apps/api-server/src/pedagogy/guards/material-context.guard.ts` - R1
- `apps/api-server/src/pedagogy/guards/material-rbac.guard.ts` - RBAC
- `apps/api-server/src/pedagogy/guards/material-stock.guard.ts` - R4

### Interceptors
- `apps/api-server/src/pedagogy/interceptors/material-audit.interceptor.ts` - R3 (audit)

### Services
- `apps/api-server/src/pedagogy/pedagogical-materials-prisma.service.ts` - CRUD matériel
- `apps/api-server/src/pedagogy/material-movements-prisma.service.ts` - R3, R5, R6, R7, R8
- `apps/api-server/src/pedagogy/teacher-material-assignments-prisma.service.ts` - R2, R6, R10
- `apps/api-server/src/pedagogy/material-stocks-prisma.service.ts` - Consultation stock
- `apps/api-server/src/pedagogy/annual-teacher-supplies-prisma.service.ts` - R9

### Controllers
Tous les controllers utilisent :
- `MaterialContextGuard` - R1
- `MaterialRbacGuard` - RBAC
- `MaterialStockGuard` - R4 (uniquement pour attributions)
- `MaterialAuditInterceptor` - R3 (audit)

---

## ✅ CHECKLIST D'IMPLÉMENTATION

- [x] R1 - Contexte obligatoire
- [x] R2 - Séparation par niveau scolaire
- [x] R3 - Traçabilité absolue
- [x] R4 - Stock non négatif
- [x] R5 - Achat / entrée en stock
- [x] R6 - Attribution à un enseignant
- [x] R7 - Retour / fin d'année
- [x] R8 - Détérioration / perte
- [x] R9 - Responsabilité annuelle
- [x] R10 - Non-transférabilité
- [x] RBAC - Droits par rôle
- [x] Audit automatique
- [x] Validation stock avant attribution
- [x] Validation enseignant dans niveau

---

## 🚀 PROCHAINES ÉTAPES

1. **Tests unitaires** pour chaque règle métier
2. **Tests d'intégration** pour les scénarios complets
3. **Documentation API** (Swagger/OpenAPI)
4. **Intégration ORION** (lecture seule)
5. **Frontend** avec validation côté client

---

**Date de création**: 2024
**Dernière mise à jour**: 2024
**Version**: 1.0.0
