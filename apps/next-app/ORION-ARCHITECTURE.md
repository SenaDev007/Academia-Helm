# 🛡️ ORION - Architecture Institutionnelle

## Vue d'ensemble

**ORION** est l'assistant de direction institutionnel officiel d'Academia Hub. Il s'agit d'un système d'intelligence décisionnelle strictement conçu pour les directeurs et promoteurs d'établissements.

**Positionnement** : ORION n'est **PAS** un chatbot. C'est un **ASSISTANT DE DIRECTION** institutionnel.

---

## 🎯 Principes Fondamentaux

### Contraintes Absolues (Non Négociables)

- ✅ **100% Lecture Seule** : ORION ne modifie jamais aucune donnée
- ✅ **Aucune Exécution d'Action** : ORION ne déclenche aucune opération
- ✅ **Aucune Supposition** : ORION ne fait jamais de prédictions non justifiées
- ✅ **Données Réelles Uniquement** : ORION s'appuie exclusivement sur des données réelles et agrégées
- ✅ **Ton Institutionnel** : Communication professionnelle, sobre, jamais familière

### Interdictions Absolues

- ❌ Modifier une donnée
- ❌ Donner un conseil juridique
- ❌ Donner un conseil financier externe
- ❌ Employer un ton familier
- ❌ Répondre sans données suffisantes

---

## 🏗️ Architecture en 4 Couches

ORION respecte une architecture stricte en 4 couches, garantissant la fiabilité et la traçabilité de chaque réponse.

```
┌─────────────────────────────────────────────────────────────┐
│                    COUCHE PRÉSENTATION                      │
│  Ton institutionnel • Réponses concises • Format structuré  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                  COUCHE INTERPRÉTATION                       │
│  Faits • Interprétation • Point de Vigilance                │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                    COUCHE LOGIQUE                            │
│  Règles explicites • Aucune probabilité non contrôlée        │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                    COUCHE DONNÉES                            │
│  Vues agrégées • KPI stabilisés • Aucune table métier brute  │
└─────────────────────────────────────────────────────────────┘
```

### 1️⃣ Couche Données IA

**Rôle** : Fournir uniquement des données agrégées et stabilisées à ORION.

**Sources Autorisées** :
- ✅ Vues agrégées (`v_kpi_direction`, `v_kpi_consolidated`)
- ✅ Tables KPI stabilisées (`kpi_summary`, `kpi_monthly`)
- ✅ Métriques pré-calculées (`metrics_cache`)

**Sources Interdites** :
- ❌ Tables métier brutes (`students`, `payments`, `teachers`)
- ❌ Données transactionnelles en temps réel
- ❌ Tables de logs ou d'audit

**Principe** : ORION ne lit **jamais** directement les tables métier. Toutes les données passent par des vues agrégées validées.

**Exemple** :
```sql
-- ✅ AUTORISÉ : ORION lit cette vue agrégée
SELECT * FROM v_kpi_direction WHERE tenant_id = ? AND period = ?

-- ❌ INTERDIT : ORION ne lit jamais cette table brute
SELECT * FROM students WHERE tenant_id = ?
```

### 2️⃣ Couche Logique

**Rôle** : Appliquer des règles explicites pour analyser les données.

**Principes** :
- ✅ **Règles Explicites** : Toutes les règles sont documentées et vérifiables
- ✅ **Calculs Déterministes** : Aucun calcul probabiliste non contrôlé
- ✅ **Seuils Définis** : Tous les seuils d'alerte sont explicites

**Interdictions** :
- ❌ Logique probabiliste non contrôlée
- ❌ Prédictions non justifiées
- ❌ Machine learning non supervisé

**Exemple de Règle Explicite** :
```typescript
// ✅ RÈGLE EXPLICITE : Baisse de recettes
if (currentRevenue < previousRevenue * 0.90) {
  // Baisse de plus de 10%
  generateAlert('REVENUE_DROP', 'HIGH', {
    currentValue: currentRevenue,
    previousValue: previousRevenue,
    threshold: previousRevenue * 0.90,
  });
}

// ❌ INTERDIT : Prédiction probabiliste
const prediction = mlModel.predict(futureRevenue); // INTERDIT
```

### 3️⃣ Couche Interprétation

**Rôle** : Structurer la réponse en 3 parties obligatoires.

**Structure Obligatoire** :

1. **Faits Observés** (Facts)
   - Liste des données réelles observées
   - Aucune interprétation, uniquement des faits
   - Références aux KPI sources

2. **Interprétation** (Interpretation)
   - Analyse factuelle des faits
   - Comparaisons avec périodes précédentes
   - Tendances identifiées (UP, DOWN, STABLE)

3. **Point de Vigilance** (Vigilance)
   - Points d'attention si applicable
   - Alertes générées
   - Aucun conseil, uniquement des observations

**Exemple de Structure** :
```typescript
{
  facts: [
    "Recettes janvier 2025 : 6.750.000 FCFA",
    "Taux de recouvrement : 92%",
    "15 paiements en retard : 450.000 FCFA"
  ],
  interpretation: "Les recettes sont en hausse de 8% par rapport à décembre 2024. Le taux de recouvrement est stable à 92%, légèrement en baisse de 2 points. 15 paiements sont en retard, représentant 6,7% du total.",
  vigilance: "Attention : Le nombre de paiements en retard a augmenté de 3 par rapport au mois précédent. Surveiller l'évolution du taux de recouvrement."
}
```

### 4️⃣ Couche Présentation

**Rôle** : Présenter les informations avec un ton institutionnel strict.

**Caractéristiques** :
- ✅ **Ton Institutionnel** : Professionnel, sobre, jamais familier
- ✅ **Réponses Concis** : Maximum 3-4 phrases par section
- ✅ **Format Structuré** : Toujours en 3 parties (Faits, Interprétation, Vigilance)
- ✅ **Aucune Familiarité** : Pas de "tu", pas d'emojis, pas de langage décontracté

**Exemples** :

✅ **CORRECT** :
> "Les recettes mensuelles s'élèvent à 6.750.000 FCFA, en hausse de 8% par rapport au mois précédent. Le taux de recouvrement est de 92%, légèrement en baisse de 2 points. 15 paiements sont en retard, représentant 450.000 FCFA."

❌ **INCORRECT** :
> "Hey ! Tes recettes sont super ce mois-ci ! 🎉 Elles ont augmenté de 8% ! Mais attention, tu as 15 paiements en retard, c'est pas terrible..."

---

## 📊 Fonctionnalités Obligatoires

### 1. Résumé Mensuel Automatique

**Fonctionnalité** : Génération automatique d'un résumé mensuel structuré.

**Contenu** :
- **Faits Observés** : Données financières, académiques, opérationnelles
- **Interprétation** : Vue d'ensemble, tendances, points clés
- **Vigilance** : Alertes générées automatiquement

**Fréquence** : Mensuel (généré le dernier jour du mois)

**Format** : `OrionMonthlySummary`

### 2. Alertes Hiérarchisées

**Fonctionnalité** : Détection automatique d'anomalies avec 3 niveaux.

**Niveaux** :
- **INFO** : Information factuelle
- **ATTENTION** : Point d'attention nécessitant une surveillance
- **CRITIQUE** : Situation critique nécessitant une action immédiate

**Types d'Alertes** :
- `REVENUE_DROP` : Baisse de recettes
- `LOW_RECOVERY_RATE` : Taux de recouvrement faible
- `ABSENCE_SPIKE` : Pic d'absences
- `PAYMENT_DELAY` : Retard de paiement
- `TEACHER_ABSENCE` : Absence enseignants
- `EXAM_OVERDUE` : Examens en retard
- `BUDGET_ALERT` : Alerte budgétaire
- `ENROLLMENT_DROP` : Baisse d'inscriptions

**Format** : `OrionAlert` avec structure : Faits, Interprétation, Vigilance

### 3. Réponses en Langage Naturel Factuel

**Fonctionnalité** : Compréhension de questions et génération de réponses factuelles.

**Types de Questions Supportées** :
- `FINANCIAL_STATUS` : "Quel est l'état financier ce mois-ci ?"
- `STUDENT_METRICS` : "Combien d'élèves avons-nous ?"
- `TREND_ANALYSIS` : "Comment évoluent les inscriptions ?"
- `COMPARISON` : "Comparer janvier et décembre"
- `VIGILANCE` : "Y a-t-il des points de vigilance ?"

**Format de Réponse** : Toujours structuré en 3 parties (Faits, Interprétation, Vigilance)

### 4. Historique des Analyses

**Fonctionnalité** : Conservation de l'historique de toutes les analyses ORION.

**Types d'Historique** :
- Questions posées et réponses
- Résumés mensuels générés
- Alertes créées

**Utilisation** : Consultation, traçabilité, analyse de l'évolution

---

## 🔒 Sécurité et Contrôles

### Contrôle d'Accès

**Rôles Autorisés** :
- `DIRECTOR` : Directeur d'établissement
- `SUPER_DIRECTOR` : Promoteur (groupe scolaire)
- `ADMIN` : Administrateur de l'établissement

**Vérification** :
- Frontend : Vérification du rôle avant affichage
- Backend : Vérification du rôle dans le token JWT

### Isolation des Données

**Multi-tenant Strict** :
- Chaque établissement ne voit que ses propres données
- Les promoteurs voient les données consolidées de leurs établissements
- Aucun mélange de données entre établissements

### Validation des Réponses

**Contrôles** :
- Vérification que la réponse est basée sur des données réelles
- Rejet des réponses spéculatives
- Calcul du score de confiance
- Indicateur `dataSufficient` si données insuffisantes
- Logging de toutes les interactions

---

## 🚀 API Routes Backend (à Implémenter)

### 1. POST /api/orion/query

**Rôle** : Traite une question en langage naturel.

**Request** :
```json
{
  "query": "Quel est l'état financier ce mois-ci ?",
  "context": {
    "period": "2025-01",
    "module": "FINANCE"
  }
}
```

**Response** :
```json
{
  "id": "response_123",
  "queryId": "query_456",
  "answer": {
    "facts": [
      "Recettes janvier 2025 : 6.750.000 FCFA",
      "Taux de recouvrement : 92%"
    ],
    "interpretation": "Les recettes sont en hausse de 8%...",
    "vigilance": "Attention : 15 paiements en retard..."
  },
  "dataSources": [
    {
      "kpi": "totalRevenue",
      "value": 6750000,
      "period": "2025-01",
      "source": "DirectionKpiSummary"
    }
  ],
  "confidence": 95,
  "dataSufficient": true,
  "createdAt": "2025-01-20T14:30:00Z"
}
```

**Logique Backend** :
1. Classifier le type de question
2. Récupérer les données depuis les vues agrégées uniquement
3. Appliquer les règles explicites
4. Générer la réponse structurée (Faits, Interprétation, Vigilance)
5. Valider la réponse (vérifier qu'elle est factuelle)
6. Enregistrer dans l'historique

### 2. GET /api/orion/monthly-summary

**Rôle** : Génère ou récupère le résumé mensuel.

**Query Params** :
- `period` : Période (ex: "2025-01")

**Response** : `OrionMonthlySummary`

**Logique Backend** :
1. Récupérer les KPI depuis les vues agrégées
2. Appliquer les règles explicites pour identifier les tendances
3. Générer les alertes automatiques
4. Structurer le résumé (Faits, Interprétation, Vigilance)
5. Enregistrer le résumé
6. Retourner le résumé

### 3. GET /api/orion/alerts

**Rôle** : Récupère les alertes ORION.

**Query Params** :
- `level` : Niveau (INFO, ATTENTION, CRITIQUE)
- `acknowledged` : Si true, retourne uniquement les alertes acquittées

**Response** : `OrionAlert[]`

**Logique Backend** :
1. Analyser les KPI depuis les vues agrégées
2. Appliquer les règles explicites pour détecter les anomalies
3. Générer les alertes avec structure (Faits, Interprétation, Vigilance)
4. Filtrer selon les paramètres
5. Retourner les alertes

### 4. POST /api/orion/alerts/:id/acknowledge

**Rôle** : Acquitte une alerte.

**Response** : 200 OK

### 5. GET /api/orion/history

**Rôle** : Récupère l'historique des analyses.

**Query Params** :
- `limit` : Nombre max de résultats
- `type` : Type (QUERY, MONTHLY_SUMMARY, ALERT)
- `startDate` : Date de début
- `endDate` : Date de fin

**Response** : `OrionAnalysisHistory[]`

### 6. GET /api/orion/config

**Rôle** : Récupère la configuration ORION.

**Response** : `OrionConfig`

### 7. PUT /api/orion/config

**Rôle** : Met à jour la configuration ORION.

**Request** : `Partial<OrionConfig>`

**Response** : `OrionConfig`

---

## 🔧 Service IA Backend

### Architecture du Service

**Option Recommandée** : LLM avec Prompt Engineering Strict

**Principe** : Utiliser un LLM (OpenAI GPT-4, Anthropic Claude) avec des prompts stricts garantissant :
- Réponses factuelles uniquement
- Structure en 3 parties (Faits, Interprétation, Vigilance)
- Ton institutionnel
- Aucune supposition

### Pipeline de Traitement

```
Question → Classification → Extraction Données (Vues Agrégées) → 
Application Règles Explicites → Génération IA (Prompt Strict) → 
Validation → Structuration (Faits/Interprétation/Vigilance) → Réponse
```

### Exemple de Prompt Strict

```
Tu es ORION, l'assistant de direction institutionnel d'Academia Hub.

CONTRAINTES ABSOLUES :
- Tu es 100% lecture seule
- Tu ne modifies jamais aucune donnée
- Tu ne fais jamais de suppositions
- Tu t'appuies UNIQUEMENT sur les données fournies
- Ton ton est institutionnel, professionnel, sobre

DONNÉES DISPONIBLES :
- Recettes janvier 2025 : 6.750.000 FCFA
- Recettes décembre 2024 : 7.670.000 FCFA
- Taux de recouvrement : 92%
- Paiements en retard : 15 (450.000 FCFA)

QUESTION : "Quel est l'état financier ce mois-ci ?"

RÉPONSE REQUISE (structure obligatoire) :

FAITS OBSERVÉS :
- Liste des données réelles uniquement

INTERPRÉTATION :
- Analyse factuelle des données
- Comparaisons avec périodes précédentes
- Tendances identifiées

VIGILANCE (si applicable) :
- Points d'attention basés sur les données

Ne fais AUCUNE supposition. Base-toi UNIQUEMENT sur les données fournies.
```

---

## 📈 Points d'Extension Futurs

### Phase 2 : Analyses Avancées

**Fonctionnalités** :
- Comparaisons multi-périodes (trimestre, année)
- Analyses prédictives basées sur des tendances historiques (sous contrôle strict)
- Benchmarking avec établissements similaires (anonymisé)

**Contraintes** :
- Toujours basé sur des données réelles
- Aucune prédiction non justifiée
- Benchmarking uniquement avec données agrégées anonymisées

### Phase 3 : Intégrations Externes

**Fonctionnalités** :
- Intégration avec systèmes comptables externes (lecture seule)
- Import de données bancaires (lecture seule)
- Export de rapports ORION

**Contraintes** :
- Toutes les intégrations en lecture seule
- Aucune modification de données externes
- Validation stricte des données importées

### Phase 4 : Personnalisation

**Fonctionnalités** :
- Seuils d'alerte personnalisables par établissement
- Préférences d'affichage
- Notifications par email des résumés mensuels

**Contraintes** :
- Personnalisation uniquement pour les paramètres d'affichage
- Aucune modification des règles de logique métier
- Seuils personnalisables mais avec limites de sécurité

---

## 📝 Résumé

- ✅ **Architecture en 4 couches** : Données, Logique, Interprétation, Présentation
- ✅ **Contraintes absolues** : 100% lecture seule, aucune supposition, données réelles uniquement
- ✅ **Ton institutionnel** : Professionnel, sobre, jamais familier
- ✅ **Structure stricte** : Faits, Interprétation, Vigilance
- ✅ **Accès restreint** : Réservé aux rôles élevés
- ✅ **Fonctionnalités complètes** : Résumé mensuel, alertes, questions, historique
- ✅ **Points d'extension** : Roadmap claire pour les phases futures

**Version** : 1.0.0  
**Dernière mise à jour** : 2025

