# 🛡️ ORION - Documentation d'Implémentation

## Vue d'ensemble

ORION est l'assistant de direction institutionnel officiel d'Academia Hub, implémenté avec une architecture stricte en 4 couches garantissant la fiabilité et la traçabilité.

---

## 🏗️ Architecture Implémentée

### Structure des Services

```
src/lib/orion/
├── orion-kpi.service.ts        # COUCHE 1 : Données (vues agrégées uniquement)
├── orion-rule-engine.ts        # COUCHE 2 : Logique (règles déterministes)
├── orion-prompt-builder.ts    # COUCHE 3 : Interprétation (construction prompts)
├── orion-llm.service.ts        # COUCHE 3 : Interprétation (appel LLM)
├── orion-response-validator.ts # COUCHE 3 : Interprétation (validation)
└── orion-history.service.ts    # Journalisation
```

### Routes API Next.js

```
src/app/api/orion/
├── query/route.ts              # POST /api/orion/query
├── monthly-summary/route.ts    # GET /api/orion/monthly-summary
├── alerts/route.ts             # GET /api/orion/alerts
├── alerts/[id]/acknowledge/route.ts # POST /api/orion/alerts/:id/acknowledge
└── history/route.ts            # GET /api/orion/history
```

### Composants Frontend

```
src/components/orion/
├── OrionPanel.tsx              # Panel principal (4 onglets)
├── OrionSummary.tsx            # Composant résumé mensuel
├── OrionAlerts.tsx             # Composant alertes
└── OrionHistory.tsx            # Composant historique
```

---

## 🔄 Flux d'Exécution

### 1. Requête ORION (POST /api/orion/query)

```
1. Vérification authentification + rôle (DIRECTOR, SUPER_DIRECTOR, ADMIN)
2. COUCHE 1 : Charger KPI depuis vues agrégées (loadDirectionKpi)
3. COUCHE 1 : Charger KPI période précédente (loadPreviousPeriodKpi)
4. COUCHE 2 : Exécuter règles déterministes (executeOrionRules)
5. COUCHE 3 : Construire prompt strict (buildOrionQueryPrompt)
6. COUCHE 3 : Appeler LLM (generateOrionResponse)
7. COUCHE 3 : Valider réponse (validateOrionResponse)
8. Fallback local si réponse non conforme
9. Journaliser l'analyse (logOrionQuery)
10. Retourner réponse structurée
```

### 2. Résumé Mensuel (GET /api/orion/monthly-summary)

```
1. Vérification authentification + rôle
2. COUCHE 1 : Charger KPI période actuelle
3. COUCHE 1 : Charger KPI période précédente
4. COUCHE 2 : Exécuter règles (générer alertes)
5. COUCHE 3 : Générer résumé via LLM (generateOrionSummary)
6. Construire OrionMonthlySummary
7. Journaliser (logOrionSummary)
8. Retourner résumé
```

### 3. Alertes (GET /api/orion/alerts)

```
1. Vérification authentification + rôle
2. COUCHE 1 : Charger KPI
3. COUCHE 2 : Exécuter règles (executeOrionRules)
4. Filtrer par niveau si demandé
5. Retourner alertes
```

---

## 📋 Services Backend Détail

### 1. OrionKpiService

**Rôle** : Charger les KPI depuis les tables IA dédiées uniquement.

**Fonctions** :
- `loadFinancialKpi(tenantId, period?)` : Charge depuis `kpi_financial_monthly`
- `loadHrKpi(tenantId, period?)` : Charge depuis `kpi_hr_monthly`
- `loadPedagogyKpi(tenantId, term?)` : Charge depuis `kpi_pedagogy_term`
- `loadSystemHealthKpi(tenantId, period?)` : Charge depuis `kpi_system_health`
- `loadDirectionKpi(tenantId, period?)` : Construit DirectionKpiSummary depuis les tables KPI
- `loadPreviousPeriodKpi(tenantId, currentPeriod)` : Charge période précédente

**Contraintes** :
- ❌ JAMAIS de lecture directe des tables métier
- ✅ UNIQUEMENT tables KPI IA (`kpi_*`)

### 2. OrionRuleEngine

**Rôle** : Exécuter les règles déterministes depuis JSON versionné.

**Architecture** :
- Règles externalisées en JSON (`orion_rules_v1.json`)
- Chargement dynamique des règles
- Évaluation des conditions sur les métriques KPI
- Génération d'alertes structurées

**Fonctions** :
- `loadOrionRules(version)` : Charge les règles depuis JSON
- `executeOrionRules(rulesVersion, financialKpi, hrKpi, pedagogyKpis, systemHealthKpi)` : Exécute toutes les règles
- `evaluateCondition(value, operator, threshold)` : Évalue une condition

**Règles par Catégorie** :
- **FINANCE** : Baisse recettes, taux recouvrement faible
- **RH** : Taux d'absence élevé
- **PEDAGOGY** : Taux de réussite faible
- **SYSTEM** : KPI manquants

**Format des Règles** :
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
  "message": "Baisse des recettes supérieure à 10 %",
  "enabled": true
}
```

### 3. OrionPromptBuilder

**Rôle** : Construire des prompts stricts garantissant les contraintes ORION.

**Fonctions** :
- `buildOrionQueryPrompt(query, kpiData, alerts)` : Prompt pour question
- `buildOrionSummaryPrompt(kpiData, previousKpiData, alerts)` : Prompt pour résumé
- `validateOrionPrompt(prompt)` : Valider le prompt

**Structure du Prompt** :
1. Instructions ORION (contraintes absolues)
2. Données disponibles (KPI uniquement)
3. Alertes actives
4. Question ou demande
5. Structure de réponse requise (JSON)
6. Règles strictes

### 4. OrionLlmService

**Rôle** : Appeler le LLM avec fallback local.

**Providers Supportés** :
- OpenAI (GPT-4)
- Anthropic (Claude)
- Local (fallback basique)

**Fonctions** :
- `generateOrionResponse(query, kpiData, alerts)` : Génère réponse pour question
- `generateOrionSummary(kpiData, previousKpiData, alerts)` : Génère résumé mensuel

**Fallback Local** :
Si le LLM échoue ou retourne une réponse non conforme, un fallback local génère une réponse factuelle basique basée uniquement sur les KPI.

### 5. OrionResponseValidator

**Rôle** : Valider strictement les réponses ORION.

**Validations** :
- Structure JSON (facts, interpretation, vigilance)
- Mots interdits (suppositions, conseils)
- Mots familiers interdits
- Longueur (concision)

**Mots Interdits** :
- Suppositions : "probablement", "semble", "devrait"
- Conseils : "recommandation", "conseil", "suggestion d'action"
- Familiers : "salut", "hey", "tu", "ton"

### 6. OrionHistoryService

**Rôle** : Journaliser toutes les analyses ORION.

**Fonctions** :
- `logOrionQuery(tenantId, userId, query, response)` : Journalise une requête
- `logOrionSummary(tenantId, summary)` : Journalise un résumé
- `logOrionAlert(tenantId, alert)` : Journalise une alerte

---

## 🎨 Frontend - Composants

### OrionPanel

**Rôle** : Panel principal avec 4 onglets.

**Onglets** :
1. **Requête** : Interface de questions
2. **Résumé Mensuel** : Résumé automatique
3. **Alertes** : Liste des alertes hiérarchisées
4. **Historique** : Historique des analyses

**Boutons de Requêtes Types** :
- "Résumé du mois"
- "Points d'attention"
- "Tendances"
- "Quel est l'état financier ce mois-ci ?"

### OrionSummary

**Rôle** : Affiche le résumé mensuel structuré.

**Sections** :
- Faits Observés (Financier, Académique, Opérationnel)
- Interprétation (Overview, Tendances, Points Clés)
- Points de Vigilance (Alertes)

### OrionAlerts

**Rôle** : Affiche les alertes avec filtrage par niveau.

**Fonctionnalités** :
- Filtrage par niveau (INFO, ATTENTION, CRITIQUE)
- Acquittement d'alerte
- Affichage structuré (Faits, Interprétation, Vigilance)

### OrionHistory

**Rôle** : Affiche l'historique des analyses.

**Affichage** :
- Liste chronologique
- Type d'analyse (QUERY, MONTHLY_SUMMARY, ALERT)
- Contenu structuré

---

## 🔒 Sécurité et Contrôles

### Contrôle d'Accès

**Frontend** :
- Vérification du rôle avant affichage du panel
- Rôles autorisés : `DIRECTOR`, `SUPER_DIRECTOR`, `ADMIN`

**Backend** (à implémenter) :
- Vérification JWT dans chaque route
- Vérification du rôle dans le token
- Extraction du `tenantId` depuis le token

### Journalisation

**Toutes les interactions sont journalisées** :
- Questions posées
- Réponses générées
- Résumés mensuels
- Alertes créées

**Données journalisées** :
- Tenant ID
- User ID
- Type d'analyse
- Contenu (facts, interpretation, vigilance)
- Sources de données
- Timestamp

---

## 🧪 Tests Unitaires

### Tests du Moteur de Règles

**Fichier** : `src/lib/orion/__tests__/orion-rule-engine.test.ts`

**Tests Couverts** :
- ✅ `detectRevenueDrop` : Baisse de recettes
- ✅ `detectLowRecoveryRate` : Taux recouvrement faible
- ✅ `detectLowTeacherPresence` : Présence enseignants faible
- ✅ `executeOrionRules` : Exécution de toutes les règles
- ✅ Seuils explicites

**Exécution** :
```bash
npm test -- orion-rule-engine.test.ts
```

---

## 📊 Règles et Limites Documentées

### Règles Implémentées

| Règle | Seuil | Niveaux |
|-------|-------|---------|
| Baisse de recettes | >= 10% | INFO (10-15%), ATTENTION (15-20%), CRITIQUE (>=20%) |
| Taux recouvrement faible | < 85% | INFO (80-85%), ATTENTION (75-80%), CRITIQUE (<75%) |
| Présence enseignants faible | < 90% | ATTENTION (85-90%), CRITIQUE (<85%) |

### Limites

**Données** :
- ORION ne lit QUE les vues agrégées
- Aucune lecture directe des tables métier
- Données insuffisantes → Réponse avec `dataSufficient: false`

**Réponses** :
- Maximum 5 faits par réponse
- Maximum 3-4 phrases par section
- Aucune supposition autorisée
- Aucun conseil autorisé

**LLM** :
- Temperature : 0.1 (très basse pour factuel)
- Max tokens : 1000
- Fallback local si échec

---

## 🚀 Points d'Extension Futurs

### Phase 2 : Règles Additionnelles

**Règles à Ajouter** :
- Détection pic d'absences élèves
- Détection examens en retard
- Détection baisse d'inscriptions
- Détection alertes budgétaires

### Phase 3 : Analyses Avancées

**Fonctionnalités** :
- Comparaisons multi-périodes (trimestre, année)
- Tendances long terme (basées sur données historiques uniquement)
- Benchmarking anonymisé (si données agrégées disponibles)

### Phase 4 : Personnalisation

**Fonctionnalités** :
- Seuils personnalisables par établissement
- Préférences d'affichage
- Notifications par email des résumés mensuels

---

## 📝 Checklist d'Implémentation Backend

### Backend API (NestJS/Node.js)

- [ ] Créer module `orion` dans `apps/api-server/src/orion/`
- [ ] Implémenter `OrionKpiService` (lecture vues agrégées)
- [ ] Implémenter `OrionRuleEngine` (règles déterministes)
- [ ] Implémenter `OrionLlmService` (appel LLM + fallback)
- [ ] Implémenter `OrionResponseValidator` (validation stricte)
- [ ] Implémenter `OrionHistoryService` (journalisation)
- [ ] Créer controller `OrionController` avec routes :
  - [ ] `POST /api/orion/query`
  - [ ] `GET /api/orion/monthly-summary`
  - [ ] `GET /api/orion/alerts`
  - [ ] `POST /api/orion/alerts/:id/acknowledge`
  - [ ] `GET /api/orion/history`
- [ ] Créer guards pour vérification rôle
- [ ] Créer table `orion_analysis_history` en base
- [ ] Créer vues agrégées `v_kpi_direction`, `v_kpi_consolidated`

### Tests

- [ ] Tests unitaires moteur de règles
- [ ] Tests intégration routes API
- [ ] Tests validation réponses
- [ ] Tests fallback local

---

## 📝 Résumé

- ✅ **Architecture en 4 couches** : Implémentée strictement
- ✅ **Services backend** : 6 services créés
- ✅ **Routes API** : 5 routes Next.js créées
- ✅ **Composants frontend** : 4 composants créés
- ✅ **Intégration dashboard** : ORION intégré dans le dashboard direction
- ✅ **Tests unitaires** : Tests du moteur de règles créés
- ✅ **Documentation** : Règles et limites documentées

**Version** : 1.0.0  
**Dernière mise à jour** : 2025

