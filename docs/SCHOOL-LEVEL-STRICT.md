# Niveau Solaire Strict — Academia Helm

## Vue d'ensemble

Le système gère le filtrage par niveau scolaire (Maternelle, Primaire, Secondaire) de la même manière que l'année scolaire stricte. Les données des modules Élèves, Finance, Pédagogie et Examens sont filtrées par niveau — pas de mélange entre niveaux.

## Règles métier

### Sélecteur de niveau dans le header
- N'affiche QUE les niveaux activés dans **Paramètres → Structure**
- Si seule la Maternelle est activée → le sélecteur ne montre que Maternelle
- Si Maternelle + Primaire → le sélecteur montre ces 2 niveaux + "Tous les niveaux"
- Si les 3 → les 3 s'affichent + "Tous les niveaux"
- Warning rouge si aucun niveau n'est activé

### Modules en "niveau scolaire strict" (4 modules)

| Module | Règle | Onglet agrégation |
|---|---|---|
| **Élèves** | Données filtrées par niveau | `/app/students/aggregation` — bilan global des effectifs |
| **Finance** | Frais, paiements, recouvrements filtrés par niveau | `/app/finance/aggregation` — bilan global financier |
| **Pédagogie** | Classes, enseignants, EDT filtrés par niveau | `/app/pedagogy/aggregation` — bilan global structure |
| **Examens** | Notes, bulletins, statistiques filtrés par niveau | `/app/exams/aggregation` — statistiques globales |

### Modules NON concernés
HR, Communication, Library, Transport, Canteen, Infirmary, QHSE, EduCast, Shop, Laboratory, Paramètres — pas de filtre niveau strict.

## Architecture

### Frontend
- `SchoolLevelContext` — contexte React partagé avec invalidation TanStack Query au changement de niveau
- `SchoolLevelSelector` — dropdown dans le header avec coloration par niveau
- Intercepteur Axios injecte `x-school-level-id` dans toutes les requêtes
- `useModuleContext()` expose `schoolLevel` à tous les composants
- `CustomEvent('school-level-changed')` pour les composants hors React

### Backend
- La plupart des modèles Prisma ont `schoolLevelId`
- Les services `findAll*` filtrent par `schoolLevelId` (optionnel — si "ALL" ou non fourni, tous les niveaux)
- Le garde `AcademicYearEnforcementGuard` n'exige pas `schoolLevelId` (seulement `academicYearId`)

### Onglets d'agrégation
Chaque module strict a un onglet "Agrégation & Bilan Global" qui :
- Fetch les données pour CHAQUE niveau scolaire activé
- Affiche un tableau comparatif (une ligne par niveau)
- Affiche les totaux tous niveaux confondus en bas du tableau
- KPI cards en haut avec les totaux globaux

## Fichiers clés

### Frontend
- `apps/web-app/src/contexts/SchoolLevelContext.tsx` — Contexte + invalidation TanStack
- `apps/web-app/src/components/pilotage/SchoolLevelSelector.tsx` — Sélecteur header
- `apps/web-app/src/app/(app)/finance/aggregation/page.tsx` — Agrégation Finance
- `apps/web-app/src/app/(app)/exams/aggregation/page.tsx` — Agrégation Examens
- `apps/web-app/src/app/(app)/students/aggregation/page.tsx` — Agrégation Élèves
- `apps/web-app/src/app/(app)/pedagogy/aggregation/page.tsx` — Agrégation Pédagogie

### Configuration des onglets
- `apps/web-app/src/components/finance/finance-tabs.tsx` — onglet 'aggregation' ajouté
- `apps/web-app/src/app/(app)/exams/sub-modules.ts` — onglet 'aggregation' ajouté
- `apps/web-app/src/components/pedagogy/pedagogy-tabs.tsx` — onglet 'aggregation' ajouté

## localStorage

Deux clés écrites en parallèle :
- `currentSchoolLevelId` — juste l'ID (pour restauration au reload)
- `schoolLevel` — objet JSON complet (pour l'intercepteur Axios → header `x-school-level-id`)
