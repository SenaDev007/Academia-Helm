# 🔒 Règles de Séparation Strictes — ORION vs ATLAS

## Vue d'ensemble

ORION et ATLAS sont deux IA distinctes avec des rôles strictement séparés. Aucun mélange n'est autorisé.

---

## 🔒 Règle n°1 — Séparation des Accès

### Données Autorisées

| Élément | ORION | ATLAS |
|---------|-------|-------|
| **KPI** | ✅ Lecture seule | ❌ Interdit |
| **Données financières** | ✅ Lecture seule | ❌ Interdit |
| **Données RH** | ✅ Lecture seule | ❌ Interdit |
| **Données pédagogiques** | ✅ Lecture seule | ❌ Interdit |
| **Bilans** | ✅ Lecture seule | ❌ Interdit |
| **Alertes** | ✅ Lecture seule | ❌ Interdit |
| **Documentation** | ❌ Interdit | ✅ Lecture seule |
| **Métadonnées UI** | ❌ Interdit | ✅ Lecture seule |
| **FAQ** | ❌ Interdit | ✅ Lecture seule |
| **Structure navigation** | ❌ Interdit | ✅ Lecture seule |

### Validation Technique

```typescript
// ORION : Accès KPI uniquement
const orionDataSources = [
  'kpi_financial_monthly',
  'kpi_hr_monthly',
  'kpi_pedagogy_term',
  'kpi_system_health'
];

// ATLAS : Accès documentation uniquement
const atlasDataSources = [
  'documentation',
  'ui_metadata',
  'faq',
  'navigation_structure'
];
```

---

## 🔒 Règle n°2 — Séparation des Utilisateurs

### Rôles Autorisés

| Rôle | ORION | ATLAS |
|------|-------|-------|
| **Directeur** | ✅ Accès complet | ❌ Interdit |
| **Promoteur** | ✅ Accès complet | ❌ Interdit |
| **Admin global** | ✅ Accès complet | ❌ Interdit |
| **Secrétariat** | ❌ Interdit | ✅ Accès complet |
| **Enseignant** | ❌ Interdit | ✅ Accès complet |
| **Parent** | ❌ Interdit | ✅ Accès complet |
| **Élève** | ❌ Interdit | ✅ Accès complet |

### Validation d'Accès

```typescript
// ORION : Rôles direction uniquement
const orionAllowedRoles = [
  'DIRECTOR',
  'SUPER_DIRECTOR',
  'ADMIN'
];

// ATLAS : Rôles opérationnels uniquement
const atlasAllowedRoles = [
  'SECRETARY',
  'TEACHER',
  'PARENT',
  'STUDENT'
];

// Validation stricte
function validateOrionAccess(userRole: string): boolean {
  return orionAllowedRoles.includes(userRole);
}

function validateAtlasAccess(userRole: string): boolean {
  return atlasAllowedRoles.includes(userRole);
}
```

---

## 🔒 Règle n°3 — Séparation des Responsabilités

### ORION — IA de Direction

**Rôle** : Éclairer, synthétiser, alerter

**Peut** :
- ✅ Analyser des KPI
- ✅ Générer des résumés mensuels
- ✅ Détecter des alertes
- ✅ Comparer des périodes
- ✅ Identifier des tendances

**Ne peut pas** :
- ❌ Modifier des données
- ❌ Prendre des décisions
- ❌ Donner des conseils stratégiques
- ❌ Guider dans l'interface
- ❌ Expliquer des fonctionnalités

### ATLAS — IA Conversationnelle

**Rôle** : Expliquer, guider, assister

**Peut** :
- ✅ Expliquer une fonctionnalité
- ✅ Guider dans l'interface
- ✅ Répondre à "comment faire"
- ✅ Orienter vers un module
- ✅ Clarifier un terme

**Ne peut pas** :
- ❌ Analyser des données
- ❌ Commenter des chiffres
- ❌ Comparer des périodes
- ❌ Donner un avis de gestion
- ❌ Proposer une décision

### Principe Fondamental

👉 **Aucune IA ne fait les deux.**

---

## 🔒 Règle n°4 — Séparation Technique

### Services Backend Distincts

```
src/lib/orion/
├── orion-kpi.service.ts
├── orion-rule-engine.ts
├── orion-prompt-builder.ts
├── orion-llm.service.ts
└── orion-response-validator.ts

src/lib/atlas/
├── atlas-documentation.service.ts
├── atlas-prompt-builder.ts
├── atlas-llm.service.ts
└── atlas-response-validator.ts
```

### Prompts Distincts

- **ORION** : Prompt strict avec contraintes directionnelles
- **ATLAS** : Prompt strict avec contraintes opérationnelles
- **Aucun mélange** : Prompts séparés, jamais combinés

### Logs Distincts

```typescript
// ORION : Logs directionnels
logger.info('ORION_QUERY', {
  userId,
  tenantId,
  query,
  response,
  dataSources: ['kpi_financial_monthly', ...]
});

// ATLAS : Logs opérationnels
logger.info('ATLAS_QUERY', {
  userId,
  tenantId,
  query,
  response,
  dataSources: ['documentation', 'ui_metadata']
});
```

### Endpoints Distincts

```
/api/orion/*
├── /api/orion/query
├── /api/orion/monthly-summary
├── /api/orion/alerts
└── /api/orion/history

/api/atlas/*
├── /api/atlas/query
├── /api/atlas/help
└── /api/atlas/guide
```

### Feature Flags Séparés

```typescript
// ORION : Toujours activé (Phase 1)
const ORION_ENABLED = true;

// ATLAS : Dormant (Phase 2)
const ATLAS_ENABLED = process.env.ATLAS_ENABLED === 'true'; // false par défaut
```

### Validation Stricte des Accès

```typescript
// Middleware de validation
function validateOrionAccess(req: Request): boolean {
  const userRole = req.user.role;
  const allowedRoles = ['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN'];
  
  if (!allowedRoles.includes(userRole)) {
    throw new Error('Accès ORION refusé');
  }
  
  // Vérifier qu'aucune donnée ATLAS n'est utilisée
  const dataSources = req.body.dataSources || [];
  const forbiddenSources = ['documentation', 'ui_metadata', 'faq'];
  
  if (dataSources.some((source: string) => forbiddenSources.includes(source))) {
    throw new Error('Sources de données interdites pour ORION');
  }
  
  return true;
}

function validateAtlasAccess(req: Request): boolean {
  const userRole = req.user.role;
  const allowedRoles = ['SECRETARY', 'TEACHER', 'PARENT', 'STUDENT'];
  
  if (!allowedRoles.includes(userRole)) {
    throw new Error('Accès ATLAS refusé');
  }
  
  // Vérifier qu'aucune donnée ORION n'est utilisée
  const dataSources = req.body.dataSources || [];
  const forbiddenSources = ['kpi_financial_monthly', 'kpi_hr_monthly', ...];
  
  if (dataSources.some((source: string) => forbiddenSources.includes(source))) {
    throw new Error('Sources de données interdites pour ATLAS');
  }
  
  return true;
}
```

---

## 🚫 Interdictions Absolues

### Pour ORION

- ❌ Accéder à la documentation
- ❌ Expliquer des fonctionnalités
- ❌ Guider dans l'interface
- ❌ Répondre à "comment faire"

### Pour ATLAS

- ❌ Accéder aux KPI
- ❌ Analyser des données
- ❌ Commenter des chiffres
- ❌ Comparer des périodes
- ❌ Générer des alertes

### Général

- ❌ Mélanger les prompts
- ❌ Partager les données entre IA
- ❌ Utiliser les mêmes endpoints
- ❌ Mélanger les logs

---

## ✅ Validation Continue

### Tests Automatiques

```typescript
describe('Séparation ORION / ATLAS', () => {
  it('ORION ne doit pas accéder à la documentation', () => {
    const orionService = new OrionService();
    expect(() => {
      orionService.loadDocumentation();
    }).toThrow('Accès interdit');
  });
  
  it('ATLAS ne doit pas accéder aux KPI', () => {
    const atlasService = new AtlasService();
    expect(() => {
      atlasService.loadKpi();
    }).toThrow('Accès interdit');
  });
});
```

### Monitoring

- Logs séparés
- Métriques distinctes
- Alertes en cas de violation
- Audit régulier

---

## 📝 Résumé

- ✅ **Séparation des accès** : Données strictement isolées
- ✅ **Séparation des utilisateurs** : Rôles distincts
- ✅ **Séparation des responsabilités** : Rôles clairs
- ✅ **Séparation technique** : Services, endpoints, logs distincts
- ✅ **Validation continue** : Tests et monitoring

**Version** : 1.0  
**Dernière mise à jour** : 2025

