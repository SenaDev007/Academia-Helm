# Architecture Tenant Features - Feature Flags & Pricing

## 📋 Vue d'ensemble

Ce document décrit l'architecture du système de **Feature Flags par Tenant** pour gérer les fonctionnalités optionnelles (ex: BILINGUAL_TRACK) avec impact sur le pricing.

## 🎯 Principe Fondamental

**Les features sont :**
- ✅ Optionnelles et activables par le promoteur
- ✅ Facturables en supplément
- ✅ Désactivables sans casser les données existantes
- ✅ Auditées et traçables

**Le module Francophone (FR) reste TOUJOURS actif par défaut.**

## 🏗️ Structure de la Base de Données

### Table `tenant_features`

```sql
CREATE TABLE tenant_features (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    feature_code VARCHAR(50) NOT NULL, -- 'BILINGUAL_TRACK', etc.
    status VARCHAR(20) NOT NULL, -- 'DISABLED', 'ENABLED', 'PENDING'
    enabled_at TIMESTAMPTZ,
    enabled_by UUID,
    disabled_at TIMESTAMPTZ,
    disabled_by UUID,
    metadata JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(tenant_id, feature_code)
);
```

**Codes de features :**
- `BILINGUAL_TRACK` = Option bilingue FR/EN

**Statuts :**
- `DISABLED` = Désactivée (par défaut)
- `ENABLED` = Activée
- `PENDING` = En attente de validation

## 🔄 Workflow d'Activation

### 1. Activation lors de l'Onboarding

```typescript
// Lors de la création du compte
POST /api/tenant-features/enable/BILINGUAL_TRACK
{
  "reason": "Activation lors de l'onboarding"
}

// Réponse avec impact pricing
{
  "feature": { ... },
  "pricingImpact": {
    "monthly": 15000,  // +15 000 FCFA/mois
    "annual": 150000   // +150 000 FCFA/an
  }
}
```

### 2. Activation depuis Paramètres

```typescript
// Paramètres > Options pédagogiques
POST /api/tenant-features/enable/BILINGUAL_TRACK
{
  "reason": "Activation manuelle depuis les paramètres"
}
```

### 3. Désactivation

```typescript
// Paramètres > Options pédagogiques
POST /api/tenant-features/disable/BILINGUAL_TRACK
{
  "reason": "Désactivation de l'option bilingue"
}

// Réponse avec impact pricing (négatif)
{
  "feature": { ... },
  "pricingImpact": {
    "monthly": -15000,  // -15 000 FCFA/mois
    "annual": -150000   // -150 000 FCFA/an
  }
}
```

## 💰 Système de Pricing

### Configuration des Prix

```typescript
const FEATURE_PRICING: Record<FeatureCode, { monthly: number; annual: number }> = {
  [FeatureCode.BILINGUAL_TRACK]: {
    monthly: 15000,  // 15 000 FCFA/mois supplément
    annual: 150000,   // 150 000 FCFA/an supplément
  },
};
```

### Calcul du Pricing Total

```typescript
// Récupérer l'impact pricing total
GET /api/tenant-features/pricing-impact

// Réponse
{
  "monthly": 15000,  // Total des features activées
  "annual": 150000
}
```

### Intégration avec le Pricing Principal

```typescript
// Prix de base
const basePrice = 100000; // 100 000 FCFA

// Impact des features
const featuresImpact = await tenantFeaturesService.calculatePricingImpact(tenantId);

// Prix total
const totalPrice = {
  monthly: basePrice + featuresImpact.monthly,
  annual: (basePrice * 12) + featuresImpact.annual,
};
```

## 🎨 Interface Utilisateur

### Sélecteur Academic Track (Conditionnel)

**Position :** Header du dashboard (zone contextuelle)

**Composant :** `<AcademicTrackSelector />`

**Règle de visibilité :**
```typescript
// Vérifier si la feature est activée
const isBilingualEnabled = await checkFeature('BILINGUAL_TRACK', tenantId);

// Afficher le sélecteur uniquement si activé
{isBilingualEnabled && (
  <AcademicTrackSelector 
    currentTrack={currentTrack}
    onTrackChange={handleTrackChange}
  />
)}
```

**Valeurs :**
- `Francophone (FR)` — par défaut, toujours disponible
- `Anglophone (EN)` — uniquement si `BILINGUAL_TRACK` activé

**Comportement :**
- Si feature désactivée → sélecteur masqué, toutes les actions utilisent FR
- Si feature activée → sélecteur visible et obligatoire

### Paramètres > Options pédagogiques

**Interface :**
```
┌─────────────────────────────────────────┐
│ Options pédagogiques                    │
├─────────────────────────────────────────┤
│                                         │
│ ☐ Enseignement bilingue (FR / EN)      │
│                                         │
│   Cette option impacte la tarification  │
│   et la structure pédagogique.          │
│                                         │
│   Impact pricing :                      │
│   • +15 000 FCFA/mois                  │
│   • +150 000 FCFA/an                   │
│                                         │
│   [Activer] [Annuler]                  │
└─────────────────────────────────────────┘
```

**Workflow :**
1. Utilisateur active le switch
2. Modal de confirmation avec impact pricing
3. Validation explicite requise
4. Activation avec audit
5. Recalcul du pricing

## 🔒 Protection des Données

### Désactivation avec Données Existantes

**Règle :** Ne jamais supprimer les données EN existantes.

**Comportement :**
- Désactiver la feature → masquer l'UI EN
- Les données EN restent en base de données
- Accès en lecture seule possible si nécessaire
- Réactivation possible sans perte de données

**Modal de confirmation :**
```
⚠️ Attention

L'option bilingue est actuellement utilisée :
• 3 classes EN
• 12 matières EN
• 45 examens EN
• 234 notes EN

La désactivation masquera l'interface EN mais
conservera toutes les données existantes.

Souhaitez-vous continuer ?
```

## 📊 Audit & Traçabilité

### Journalisation Automatique

Toute activation/désactivation est journalisée :

```typescript
// Audit log créé automatiquement
{
  "action": "FEATURE_ENABLED",
  "resource": "tenant_feature",
  "resourceId": "feature-uuid",
  "changes": {
    "featureCode": "BILINGUAL_TRACK",
    "status": "ENABLED",
    "pricingImpact": {
      "monthly": 15000,
      "annual": 150000
    },
    "reason": "Activation depuis les paramètres"
  },
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Consultation des Logs

```typescript
// Récupérer l'historique d'une feature
GET /api/audit-logs?resource=tenant_feature&resourceId=feature-uuid
```

## 🤖 Intégration ORION

### Détection de la Feature

```typescript
// ORION vérifie si la feature est activée
const isBilingualEnabled = await tenantFeaturesService.isFeatureEnabled(
  FeatureCode.BILINGUAL_TRACK,
  tenantId
);

if (isBilingualEnabled) {
  // Analyser performances FR vs EN
  const frStats = await analyzeTrackPerformance(tenantId, 'FR');
  const enStats = await analyzeTrackPerformance(tenantId, 'EN');
  
  // Comparer et alerter
  if (frStats.average < enStats.average - 5) {
    // Alerte : performance EN supérieure à FR
  }
}
```

### Alertes ORION

ORION peut générer des alertes spécifiques :
- Écart de performance FR vs EN
- Impact financier de l'option bilingue
- Recommandations d'optimisation

## 🔧 API Endpoints

### Vérifier si une feature est activée

```typescript
GET /api/tenant-features/check/BILINGUAL_TRACK
// Réponse: true/false
```

### Activer une feature

```typescript
POST /api/tenant-features/enable/BILINGUAL_TRACK
Body: { "reason": "..." }
// Réponse: { feature, pricingImpact }
```

### Désactiver une feature

```typescript
POST /api/tenant-features/disable/BILINGUAL_TRACK
Body: { "reason": "..." }
// Réponse: { feature, pricingImpact }
```

### Récupérer l'impact pricing

```typescript
GET /api/tenant-features/pricing-impact
// Réponse: { monthly, annual }
```

## 📝 Checklist d'Implémentation

- [x] Créer la table `tenant_features`
- [x] Créer le service `TenantFeaturesService`
- [x] Intégrer avec le pricing
- [x] Ajouter l'audit et les logs
- [ ] Créer le composant `<AcademicTrackSelector />` (frontend)
- [ ] Créer l'interface Paramètres > Options pédagogiques (frontend)
- [ ] Adapter les calculs ORION pour détecter la feature
- [ ] Ajouter les tests unitaires
- [ ] Ajouter les tests d'intégration

## 🎯 Objectif Final

- ✅ Option bilingue maîtrisée
- ✅ Activation contrôlée
- ✅ Pricing cohérent
- ✅ Zéro casse
- ✅ Zéro surprise client
- ✅ Architecture extensible

