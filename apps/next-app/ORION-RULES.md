# 📋 ORION Rules - Système de Règles Versionnées

## Vue d'ensemble

ORION utilise un système de règles externalisées en JSON, versionnées, traçables, auditables et évolutives. Les règles sont **indépendantes du code**, permettant leur modification sans déploiement.

---

## 🎯 Principes

### Avantages du Système JSON

- ✅ **Traçabilité** : Chaque règle a un ID unique et une version
- ✅ **Auditabilité** : Historique des modifications de règles
- ✅ **Évolutivité** : Ajout/modification de règles sans changement de code
- ✅ **Indépendance** : Règles séparées de la logique métier
- ✅ **Testabilité** : Règles testables indépendamment

### Structure d'une Règle

```json
{
  "id": "FIN_REV_DROP",
  "category": "FINANCE",
  "severity": "CRITICAL",
  "condition": {
    "metric": "variation_percent",
    "operator": "<=",
    "value": -10
  },
  "message": "Baisse des recettes supérieure à 10 % sur la période.",
  "description": "Détecte une baisse significative des recettes...",
  "enabled": true
}
```

---

## 📊 Catégories de Règles

### FINANCE

Règles liées aux indicateurs financiers :
- `FIN_REV_DROP` : Baisse de recettes
- `FIN_COLLECTION_LOW` : Taux de recouvrement faible
- `FIN_COLLECTION_CRITICAL` : Taux de recouvrement critique

**Métriques disponibles** :
- `variation_percent` : Variation en pourcentage
- `collection_rate` : Taux de recouvrement (0-100)
- `revenue_collected` : Recettes encaissées
- `revenue_expected` : Recettes attendues

### RH

Règles liées aux ressources humaines :
- `HR_ABSENCE_HIGH` : Taux d'absence élevé
- `HR_ABSENCE_CRITICAL` : Taux d'absence critique

**Métriques disponibles** :
- `absence_rate` : Taux d'absence (0-100)
- `teachers_total` : Nombre total d'enseignants
- `teachers_absent` : Nombre d'enseignants absents

### PEDAGOGY

Règles liées aux indicateurs pédagogiques :
- `PED_SUCCESS_DROP` : Taux de réussite faible
- `PED_SUCCESS_CRITICAL` : Taux de réussite critique

**Métriques disponibles** :
- `success_rate` : Taux de réussite (0-100)
- `average_score` : Note moyenne
- `failure_rate` : Taux d'échec (0-100)

### SYSTEM

Règles liées à la santé du système :
- `SYS_KPI_MISSING` : Données KPI manquantes
- `SYS_KPI_MISSING_CRITICAL` : Nombre important de KPI manquants

**Métriques disponibles** :
- `missing_kpi_count` : Nombre de KPI manquants
- `alerts_open` : Nombre d'alertes ouvertes

---

## 🔧 Opérateurs Supportés

| Opérateur | Description | Exemple |
|-----------|-------------|---------|
| `<` | Inférieur à | `variation_percent < -10` |
| `<=` | Inférieur ou égal à | `collection_rate <= 70` |
| `>` | Supérieur à | `absence_rate > 10` |
| `>=` | Supérieur ou égal à | `success_rate >= 60` |
| `==` | Égal à | `missing_kpi_count == 0` |
| `!=` | Différent de | `alerts_open != 0` |

---

## 📈 Niveaux de Sévérité

| Sévérité | Niveau ORION | Description |
|----------|--------------|-------------|
| `INFO` | INFO | Information factuelle |
| `ALERT` | ATTENTION | Point d'attention |
| `WARNING` | ATTENTION | Avertissement |
| `CRITICAL` | CRITIQUE | Situation critique |

---

## 📝 Format du Fichier de Règles

**Fichier** : `public/orion-rules/orion_rules_v1.json`

**Structure** :
```json
{
  "version": "1.0",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "rules": [
    {
      "id": "RULE_ID",
      "category": "FINANCE | RH | PEDAGOGY | SYSTEM",
      "severity": "INFO | ALERT | WARNING | CRITICAL",
      "condition": {
        "metric": "nom_metrique",
        "operator": "< | <= | > | >= | == | !=",
        "value": 0
      },
      "message": "Message d'alerte",
      "description": "Description de la règle",
      "enabled": true
    }
  ]
}
```

---

## 🔄 Versionnement

### Principe

- Chaque version de règles est dans un fichier séparé
- Format : `orion_rules_v{version}.json`
- Exemples : `orion_rules_v1.json`, `orion_rules_v1.1.json`, `orion_rules_v2.json`

### Migration

Lors d'une mise à jour de règles :
1. Créer un nouveau fichier `orion_rules_v1.1.json`
2. Copier les règles existantes
3. Modifier/ajouter les règles nécessaires
4. Mettre à jour `updatedAt`
5. Le backend charge automatiquement la nouvelle version

### Rétrocompatibilité

- Les anciennes versions restent disponibles
- Possibilité de charger une version spécifique
- Historique des règles conservé

---

## 🧪 Tests des Règles

### Test d'une Règle

```typescript
// Exemple : Tester la règle FIN_REV_DROP
const rule: OrionRule = {
  id: "FIN_REV_DROP",
  category: "FINANCE",
  severity: "CRITICAL",
  condition: {
    metric: "variation_percent",
    operator: "<=",
    value: -10
  },
  message: "Baisse des recettes supérieure à 10 %",
  enabled: true
};

const financialKpi: KpiFinancialMonthly = {
  variationPercent: -15, // Baisse de 15%
  // ... autres champs
};

// La règle doit générer une alerte CRITIQUE
```

### Validation

- ✅ Vérifier que la condition est correctement évaluée
- ✅ Vérifier que le niveau de sévérité est correct
- ✅ Vérifier que le message est approprié
- ✅ Vérifier que la règle peut être désactivée (`enabled: false`)

---

## 📋 Règles Actuelles (v1.0)

### FINANCE

1. **FIN_REV_DROP** (CRITICAL)
   - Condition : `variation_percent <= -10`
   - Détecte une baisse de recettes >= 10%

2. **FIN_COLLECTION_LOW** (WARNING)
   - Condition : `collection_rate < 70`
   - Détecte un taux de recouvrement < 70%

3. **FIN_COLLECTION_CRITICAL** (CRITICAL)
   - Condition : `collection_rate < 50`
   - Détecte un taux de recouvrement < 50%

### RH

1. **HR_ABSENCE_HIGH** (ALERT)
   - Condition : `absence_rate > 10`
   - Détecte un taux d'absence > 10%

2. **HR_ABSENCE_CRITICAL** (CRITICAL)
   - Condition : `absence_rate > 20`
   - Détecte un taux d'absence > 20%

### PEDAGOGY

1. **PED_SUCCESS_DROP** (WARNING)
   - Condition : `success_rate < 60`
   - Détecte un taux de réussite < 60%

2. **PED_SUCCESS_CRITICAL** (CRITICAL)
   - Condition : `success_rate < 40`
   - Détecte un taux de réussite < 40%

### SYSTEM

1. **SYS_KPI_MISSING** (INFO)
   - Condition : `missing_kpi_count > 0`
   - Détecte des KPI manquants

2. **SYS_KPI_MISSING_CRITICAL** (WARNING)
   - Condition : `missing_kpi_count > 5`
   - Détecte plus de 5 KPI manquants

---

## 🚀 Utilisation dans le Code

### Chargement des Règles

```typescript
import { loadOrionRules, executeOrionRules } from '@/lib/orion/orion-rule-engine';

// Charger les règles version 1.0
const rulesVersion = await loadOrionRules('1.0');

// Exécuter les règles
const alerts = await executeOrionRules(
  rulesVersion,
  financialKpi,
  hrKpi,
  pedagogyKpis,
  systemHealthKpi
);
```

### Exécution d'une Règle Spécifique

```typescript
import { executeFinancialRule } from '@/lib/orion/orion-rule-engine';

const alert = executeFinancialRule(rule, financialKpi);
if (alert) {
  // Alerte générée
}
```

---

## 📝 Ajout d'une Nouvelle Règle

### Processus

1. **Identifier la métrique** : Quelle métrique KPI utiliser ?
2. **Définir le seuil** : Quelle valeur déclenche l'alerte ?
3. **Choisir la sévérité** : INFO, ALERT, WARNING, ou CRITICAL ?
4. **Rédiger le message** : Message clair et factuel
5. **Ajouter au JSON** : Ajouter la règle dans `orion_rules_v1.json`
6. **Tester** : Vérifier que la règle fonctionne correctement
7. **Documenter** : Documenter la règle dans ce fichier

### Exemple

```json
{
  "id": "FIN_REVENUE_HIGH",
  "category": "FINANCE",
  "severity": "INFO",
  "condition": {
    "metric": "variation_percent",
    "operator": ">",
    "value": 20
  },
  "message": "Hausse significative des recettes : plus de 20%.",
  "description": "Détecte une hausse importante des recettes, indicateur positif.",
  "enabled": true
}
```

---

## ⚠️ Bonnes Pratiques

### Rédaction des Règles

- ✅ **Messages factuels** : Basés uniquement sur les données
- ✅ **Seuils explicites** : Valeurs numériques claires
- ✅ **Descriptions claires** : Expliquer le contexte de la règle
- ❌ **Pas de suppositions** : Ne pas supposer les causes
- ❌ **Pas de conseils** : Uniquement des observations

### Gestion des Versions

- ✅ **Versionner les changements** : Créer une nouvelle version pour modifications majeures
- ✅ **Conserver l'historique** : Garder les anciennes versions
- ✅ **Documenter les changements** : Noter les modifications dans `updatedAt`
- ✅ **Tester avant déploiement** : Valider les nouvelles règles

---

## 📝 Résumé

- ✅ **Règles externalisées** : JSON indépendant du code
- ✅ **Versionnées** : Système de versionnement clair
- ✅ **Traçables** : Chaque règle a un ID unique
- ✅ **Auditables** : Historique des modifications
- ✅ **Évolutives** : Ajout/modification sans déploiement
- ✅ **Testables** : Règles testables indépendamment

**Version actuelle** : 1.0  
**Dernière mise à jour** : 2025

