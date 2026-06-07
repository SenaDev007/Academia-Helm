# 🏗️ ATLAS — Architecture Technique (Dormante)

## Statut

⏸️ **DORMANT** — Structure préparée, non activée

---

## Vue d'ensemble

ATLAS est l'assistant conversationnel guidé d'Academia Hub, conçu pour réduire la friction utilisateur en expliquant les fonctionnalités et en guidant dans l'interface.

**Important** : ATLAS est préparé mais **non activé**. L'activation nécessitera une validation produit et l'activation du feature flag.

---

## Structure Technique

### Services Backend (Préparés)

```
src/lib/atlas/
├── atlas-documentation.service.ts    # Charge la documentation
├── atlas-ui-metadata.service.ts       # Charge les métadonnées UI
├── atlas-prompt-builder.ts            # Construit les prompts ATLAS
├── atlas-llm.service.ts               # Appelle le LLM
├── atlas-response-validator.ts        # Valide les réponses
└── atlas-history.service.ts           # Journalise les interactions
```

### Routes API (Préparées, Dormantes)

```
src/app/api/atlas/
├── query/route.ts                     # POST /api/atlas/query
├── help/route.ts                      # GET /api/atlas/help
└── guide/route.ts                     # GET /api/atlas/guide
```

### Composants Frontend (Préparés, Non Exposés)

```
src/components/atlas/
├── AtlasPanel.tsx                     # Panel principal ATLAS
├── AtlasChat.tsx                      # Interface de chat
└── AtlasHelp.tsx                      # Aide contextuelle
```

---

## Feature Flag

### Configuration

```typescript
// .env
ATLAS_ENABLED=false  # Par défaut, désactivé
```

### Validation d'Accès

```typescript
// src/lib/atlas/atlas-access.ts
export function isAtlasEnabled(): boolean {
  return process.env.ATLAS_ENABLED === 'true';
}

export function validateAtlasAccess(userRole: string): boolean {
  if (!isAtlasEnabled()) {
    return false; // ATLAS désactivé
  }
  
  const allowedRoles = ['SECRETARY', 'TEACHER', 'PARENT', 'STUDENT'];
  return allowedRoles.includes(userRole);
}
```

---

## Services Détail

### 1. AtlasDocumentationService

**Rôle** : Charger la documentation officielle

**Sources** :
- Documentation markdown (`docs/`)
- FAQ validée
- Guides utilisateur

**Fonctions** :
```typescript
async function loadDocumentation(module?: string): Promise<Documentation>
async function searchDocumentation(query: string): Promise<Documentation[]>
async function loadFAQ(): Promise<FAQ[]>
```

### 2. AtlasUiMetadataService

**Rôle** : Charger les métadonnées UI

**Sources** :
- Labels des modules
- Structure de navigation
- Noms de fonctionnalités
- Chemins de pages

**Fonctions** :
```typescript
async function loadModuleMetadata(): Promise<ModuleMetadata[]>
async function loadNavigationStructure(): Promise<NavigationNode[]>
async function findPageByFeature(feature: string): Promise<string>
```

### 3. AtlasPromptBuilder

**Rôle** : Construire les prompts ATLAS stricts

**Contraintes** :
- Aucune donnée métier
- Uniquement documentation/UI
- Ton pédagogique
- Pas de recommandations

**Fonctions** :
```typescript
function buildAtlasQueryPrompt(
  query: string,
  documentation: Documentation[],
  uiMetadata: UiMetadata
): string
```

### 4. AtlasLlmService

**Rôle** : Appeler le LLM avec validation

**Providers** :
- OpenAI (GPT-4)
- Anthropic (Claude)
- Local (fallback)

**Fonctions** :
```typescript
async function generateAtlasResponse(
  query: string,
  documentation: Documentation[],
  uiMetadata: UiMetadata
): Promise<AtlasResponse>
```

### 5. AtlasResponseValidator

**Rôle** : Valider strictement les réponses

**Validations** :
- Aucune mention de KPI
- Aucune donnée métier
- Ton pédagogique
- Pas de recommandations stratégiques

**Fonctions** :
```typescript
function validateAtlasResponse(response: any): ValidationResult
```

---

## Routes API

### POST /api/atlas/query

**Rôle** : Traiter une question ATLAS

**Flux** :
1. Vérifier feature flag
2. Valider accès utilisateur
3. Charger documentation
4. Charger métadonnées UI
5. Construire prompt
6. Appeler LLM
7. Valider réponse
8. Journaliser
9. Retourner réponse

**Exemple** :
```typescript
POST /api/atlas/query
{
  "query": "Comment ajouter un nouvel élève ?",
  "context": {
    "module": "scolarite"
  }
}
```

### GET /api/atlas/help

**Rôle** : Récupérer l'aide contextuelle

**Flux** :
1. Vérifier feature flag
2. Valider accès utilisateur
3. Charger aide pour module/page
4. Retourner aide structurée

### GET /api/atlas/guide

**Rôle** : Récupérer un guide pas à pas

**Flux** :
1. Vérifier feature flag
2. Valider accès utilisateur
3. Charger guide pour fonctionnalité
4. Retourner guide structuré

---

## Composants Frontend

### AtlasPanel

**Rôle** : Panel principal ATLAS

**Fonctionnalités** :
- Interface de chat
- Historique des questions
- Suggestions de questions
- Liens vers documentation

**Accès** :
- Uniquement si `ATLAS_ENABLED=true`
- Uniquement pour rôles opérationnels

### AtlasChat

**Rôle** : Interface de chat

**Fonctionnalités** :
- Saisie de question
- Affichage des réponses
- Historique local
- Suggestions contextuelles

### AtlasHelp

**Rôle** : Aide contextuelle

**Fonctionnalités** :
- Aide selon la page active
- Liens vers documentation
- Guides pas à pas
- FAQ contextuelle

---

## Validation Stricte

### Validation d'Accès

```typescript
// Middleware
function validateAtlasAccess(req: Request): boolean {
  // 1. Vérifier feature flag
  if (!isAtlasEnabled()) {
    throw new Error('ATLAS non activé');
  }
  
  // 2. Vérifier rôle
  const userRole = req.user.role;
  const allowedRoles = ['SECRETARY', 'TEACHER', 'PARENT', 'STUDENT'];
  if (!allowedRoles.includes(userRole)) {
    throw new Error('Accès ATLAS refusé pour ce rôle');
  }
  
  return true;
}
```

### Validation de Contenu

```typescript
// Validateur de réponse
function validateAtlasResponse(response: string): ValidationResult {
  const forbiddenKeywords = [
    'kpi', 'recouvrement', 'encaissement', 'taux',
    'performance', 'bilan', 'analyse', 'recommandation',
    'stratégie', 'décision', 'avis'
  ];
  
  const lowerResponse = response.toLowerCase();
  for (const keyword of forbiddenKeywords) {
    if (lowerResponse.includes(keyword)) {
      return {
        valid: false,
        error: `Mot interdit détecté : ${keyword}`
      };
    }
  }
  
  return { valid: true };
}
```

---

## Journalisation

### Logs ATLAS

```typescript
logger.info('ATLAS_QUERY', {
  userId,
  tenantId,
  query,
  response,
  dataSources: ['documentation', 'ui_metadata'],
  timestamp: new Date().toISOString()
});
```

### Historique

```typescript
// Table : atlas_interaction_history
{
  id: UUID,
  userId: UUID,
  tenantId: UUID,
  query: string,
  response: string,
  dataSources: string[],
  createdAt: timestamp
}
```

---

## Activation Future

### Étapes d'Activation

1. **Validation Produit** : Valider le besoin et l'UX
2. **Tests Internes** : Tester les prompts et réponses
3. **Tests Utilisateurs** : Tests avec utilisateurs réels
4. **Activation Feature Flag** : `ATLAS_ENABLED=true`
5. **Déploiement Progressif** : Activation par phases

### Checklist d'Activation

- [ ] Prompts validés
- [ ] Validation de contenu testée
- [ ] Documentation complète
- [ ] Tests utilisateurs réussis
- [ ] Feature flag activé
- [ ] Monitoring en place
- [ ] Support prêt

---

## Séparation ORION / ATLAS

### Technique

- ✅ Services distincts
- ✅ Endpoints distincts
- ✅ Logs distincts
- ✅ Feature flags séparés

### Données

- ✅ ATLAS : Documentation uniquement
- ✅ ORION : KPI uniquement
- ❌ Aucun mélange

### Utilisateurs

- ✅ ATLAS : Opérationnels uniquement
- ✅ ORION : Direction uniquement
- ❌ Aucun chevauchement

---

## Résumé

- ⏸️ **Statut** : Dormant (non activé)
- 📝 **Structure** : Préparée et documentée
- 🔒 **Séparation** : Stricte avec ORION
- 🚀 **Activation** : Nécessite validation produit
- 📋 **Documentation** : Complète et prête

**Version** : 1.0  
**Dernière mise à jour** : 2025

