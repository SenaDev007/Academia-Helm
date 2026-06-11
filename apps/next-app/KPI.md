# 📊 Module Bilans & Indicateurs — KPI Directionnels

Ce document décrit le contrat de données attendu pour le module **Bilans & KPI** (vue Direction) côté frontend.  
Toutes les agrégations et calculs sont effectués **côté backend**.

---

## 🎯 Objectifs

- Vue synthétique réservée aux directeurs / promoteurs
- Lecture seule
- Aucune ambiguïté de calcul : les valeurs sont déjà agrégées par l’API
- Données traçables et performantes

---

## 🧱 Contrat de Réponse API

Route backend attendue : `GET /analytics/direction`  
Type utilisé côté frontend : `DirectionKpiResponse` (`src/types/index.ts`)

```ts
export interface DirectionKpiResponse {
  summary: DirectionKpiSummary;
  revenueByPeriod: RevenueByPeriodPoint[];
  moduleKpis: ModuleKpi[];
}
```

### 1️⃣ `DirectionKpiSummary` — KPI synthèse

```ts
export interface DirectionKpiSummary {
  totalStudents: number;
  totalTeachers: number;
  periodLabel: string;  // ex: "Année 2024-2025" ou "Mois en cours"
  totalRevenue: number; // Recettes totales sur la période
  currency: string;     // ex: "XOF"
  recoveryRate: number; // 0–100 (%)
  teacherPresenceRate: number; // 0–100 (%)
  examsActivityIndex: number;  // 0–100 (indice synthétique)
}
```

**Exemples de règles côté backend (indicatives)** :
- `totalStudents` = nombre d’élèves actifs sur l’année scolaire de référence
- `totalRevenue` = somme des encaissements (tous moyens) sur la période
- `recoveryRate` = `encaissements_effectifs / montants_facturés * 100`
- `teacherPresenceRate` = `présences / (présences + absences non justifiées) * 100`
- `examsActivityIndex` = indice pondéré basé sur :
  - nombre d’évaluations enregistrées
  - taux de complétion des notes
  - publication des bulletins

> ℹ️ Ces règles sont **implémentées côté API**. Le frontend consomme uniquement les valeurs finales.

### 2️⃣ `RevenueByPeriodPoint` — Recettes par période

```ts
export interface RevenueByPeriodPoint {
  period: string; // ex: "Jan", "Fév 2025", "T1 2025"
  amount: number; // Montant encaissé sur la période
}
```

- Périodicité au choix du backend : mensuelle, trimestrielle, etc.
- La page `/app/reports` affiche ces points sous forme de barres horizontales simples.

### 3️⃣ `ModuleKpi` — Bilans par module

```ts
export interface ModuleKpi {
  module: 'SCOLARITY' | 'FINANCE' | 'HR' | 'EXAMS';
  label: string; // ex: "Scolarité & Élèves", "Finances & Encaissements"
  indicators: {
    name: string;  // Nom lisible de l’indicateur
    value: number; // Valeur numérique brute
    unit?: string; // ex: '%', 'élèves', 'FCFA'
  }[];
}
```

**Exemples possibles** (à affiner côté backend) :

- Module `SCOLARITY` :
  - `Effectif total` — nb élèves
  - `Taux d’occupation` — % de capacité utilisée

- Module `FINANCE` :
  - `Montant facturé` — FCFA
  - `Montant encaissé` — FCFA
  - `Taux de recouvrement` — %

- Module `HR` :
  - `Enseignants actifs` — nb
  - `Taux de présence` — %

- Module `EXAMS` :
  - `Évaluations enregistrées` — nb
  - `Bulletins générés` — nb
  - `Complétion des notes` — %

---

## 🧩 Intégration Frontend

- Service : `src/services/kpi.service.ts`
  - `getDirectionKpi()` → `GET /analytics/direction` → `DirectionKpiResponse`
- Page : `/app/reports`
  - Fichiers :
    - `src/components/dashboard/DirectionKpiPage.tsx`
    - `src/app/app/reports/page.tsx`
- Navigation :
  - Entrée de menu dans `DashboardSidebar` : **“Bilans & KPI”** (`/app/reports`)

### UX / UI

- **Lecture seule** : aucun bouton de modification, suppression ou écriture.
- **Cartes KPI** :
  - Effectif total (élèves)
  - Recettes sur la période
  - Taux de recouvrement
  - Présence enseignants
- **Graphiques sobres** :
  - Barres horizontales pour les recettes par période
  - Barres de progression pour les pourcentages (recouvrement, présence)
- **Bilans par module** :
  - Cartes séparées par module (Scolarité, Finances, RH, Examens)
  - Liste d’indicateurs simples : nom + valeur (+ unité)

---

## 🔐 Contraintes & Performance

- Aucune agrégation côté frontend : tout vient de l’API déjà calculé.
- Données chargées via une seule requête (`/analytics/direction`) pour limiter les allers-retours.
- Module accessible uniquement sous `/app/*` → protégé par :
  - middleware multi-tenant
  - session utilisateur
- Aucune modification de données depuis ce module : consultation stricte.

---

## ✅ Résumé

- **KPI directionnels définis** et typés (`DirectionKpiResponse`).
- **Agrégations serveur** spécifiées de manière claire, sans logique ambiguë côté client.
- **Dashboard KPI** disponible sur `/app/reports`, réservé aux décideurs, en lecture seule.


