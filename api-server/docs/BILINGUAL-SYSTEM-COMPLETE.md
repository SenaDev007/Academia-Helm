# Système Bilingue Complet - Architecture & Implémentation

## 📋 Vue d'Ensemble

Ce document présente l'architecture complète du système bilingue (FR/EN) d'Academia Hub, combinant :
1. **Academic Tracks** - Séparation pédagogique FR/EN
2. **Tenant Features** - Feature flags et pricing

## 🏗️ Architecture en Deux Couches

### Couche 1 : Academic Tracks (Fondation)

**Rôle :** Séparer la logique pédagogique (matières, examens, notes, bulletins)

**Tables :**
- `academic_tracks` - Tracks disponibles (FR, EN)
- `student_academic_tracks` - Liaison élève-track (optionnelle)

**Colonnes ajoutées (NULLABLE) :**
- `subjects.academic_track_id`
- `exams.academic_track_id`
- `grades.academic_track_id`
- `classes.academic_track_id`

**Principe :**
- Les données existantes = FR par défaut (NULL = FR)
- Les nouvelles données peuvent être liées à un track spécifique
- Calculs strictement isolés par track

### Couche 2 : Tenant Features (Contrôle)

**Rôle :** Activer/désactiver l'option bilingue avec impact pricing

**Table :**
- `tenant_features` - Features activées par tenant

**Principe :**
- Feature `BILINGUAL_TRACK` = false → Sélecteur masqué, tout est FR
- Feature `BILINGUAL_TRACK` = true → Sélecteur visible, FR et EN disponibles

## 🔄 Workflow Complet

### 1. État Initial (Feature Désactivée)

```
┌─────────────────────────────────────┐
│ Dashboard                            │
├─────────────────────────────────────┤
│ [Tableau de bord]                    │
│ (Pas de sélecteur Academic Track)    │
│                                      │
│ Toutes les actions → FR par défaut   │
└─────────────────────────────────────┘
```

### 2. Activation de la Feature

```
1. Utilisateur va dans Paramètres > Options pédagogiques
2. Active le switch "Enseignement bilingue"
3. Modal de confirmation avec impact pricing
4. Validation → Feature activée
5. Track EN créé automatiquement
6. Audit log créé
```

### 3. Après Activation

```
┌─────────────────────────────────────┐
│ Dashboard                            │
├─────────────────────────────────────┤
│ [Tableau de bord]                    │
│ [Academic Track: FR | EN] ← Visible │
│                                      │
│ Actions pédagogiques → Track actif   │
└─────────────────────────────────────┘
```

### 4. Utilisation

```
1. Utilisateur sélectionne "EN" dans le sélecteur
2. Crée une matière "Mathematics" → Track EN
3. Crée un examen "Math Test" → Track EN
4. Saisit des notes → Track EN
5. Génère un bulletin → Track EN (isolé)
```

## 💰 Pricing Dynamique

### Calcul Automatique

```typescript
// Prix de base
const basePrice = 100000; // 100 000 FCFA

// Impact des features activées
const featuresImpact = await tenantFeaturesService.calculatePricingImpact(tenantId);
// { monthly: 15000, annual: 150000 }

// Prix total
const totalPrice = {
  monthly: basePrice + featuresImpact.monthly, // 115 000 FCFA
  annual: (basePrice * 12) + featuresImpact.annual, // 1 350 000 FCFA
};
```

### Affichage Transparent

L'impact pricing est **toujours** affiché avant activation :
- Modal de confirmation
- Interface Paramètres
- Facturation

## 🎨 Interface Utilisateur

### Sélecteur Academic Track

**Position :** Header du dashboard (zone contextuelle)

**Visibilité :**
- Feature désactivée → Masqué
- Feature activée → Visible et obligatoire

**Comportement :**
- Sélection FR → Toutes les actions créent des données FR
- Sélection EN → Toutes les actions créent des données EN
- Persistance dans localStorage

### Paramètres > Options pédagogiques

**Interface complète avec :**
- Switch ON/OFF
- Impact pricing affiché
- Modal de confirmation
- Messages d'avertissement

## 🔒 Protection & Sécurité

### Données Existantes

- ✅ Aucune modification des données existantes
- ✅ Désactivation ne supprime rien
- ✅ Réactivation possible sans perte

### Validation

- ✅ Prérequis vérifiés avant activation
- ✅ Dépendances vérifiées avant désactivation
- ✅ Confirmation explicite requise

### Audit

- ✅ Toute activation/désactivation journalisée
- ✅ Traçabilité complète (qui, quand, pourquoi)
- ✅ Impact pricing enregistré

## 📊 Intégration ORION

### Détection Automatique

```typescript
// ORION détecte si la feature est activée
const isBilingualEnabled = await tenantFeaturesService.isFeatureEnabled(
  FeatureCode.BILINGUAL_TRACK,
  tenantId
);

if (isBilingualEnabled) {
  // Analyser performances FR vs EN
  const analysis = await analyzeBilingualPerformance(tenantId);
  
  // Générer des alertes si écart significatif
  if (analysis.performanceGap > 5) {
    await generateAlert({
      type: 'BILINGUAL_PERFORMANCE_GAP',
      message: `Écart de ${analysis.performanceGap} points entre FR et EN`,
    });
  }
}
```

### Alertes ORION

ORION peut générer :
- Écart de performance FR vs EN
- Impact financier de l'option bilingue
- Recommandations d'optimisation

## 🧪 Scénarios de Test

### Scénario 1 : Activation lors de l'Onboarding

```
1. Créer un nouveau tenant
2. Activer BILINGUAL_TRACK lors de l'onboarding
3. Vérifier que le track EN est créé
4. Vérifier que le sélecteur est visible
5. Vérifier l'impact pricing
```

### Scénario 2 : Activation depuis Paramètres

```
1. Tenant existant avec données FR
2. Aller dans Paramètres > Options pédagogiques
3. Activer BILINGUAL_TRACK
4. Vérifier que les données FR ne sont pas affectées
5. Vérifier que le sélecteur apparaît
```

### Scénario 3 : Utilisation Bilingue

```
1. Feature activée
2. Sélectionner "EN" dans le sélecteur
3. Créer une classe "Nursery 1" (EN)
4. Créer une matière "Mathematics" (EN)
5. Créer un examen (EN)
6. Saisir des notes (EN)
7. Vérifier que tout est isolé du FR
```

### Scénario 4 : Désactivation

```
1. Feature activée avec données EN existantes
2. Désactiver BILINGUAL_TRACK
3. Vérifier que le sélecteur disparaît
4. Vérifier que les données EN sont conservées
5. Vérifier la réduction pricing
```

## 📝 Checklist d'Implémentation Complète

### Backend ✅
- [x] Table `academic_tracks`
- [x] Table `student_academic_tracks`
- [x] Colonnes `academic_track_id` sur tables pédagogiques
- [x] Table `tenant_features`
- [x] Service `AcademicTracksService`
- [x] Service `TenantFeaturesService`
- [x] Intégration pricing
- [x] Audit et logs
- [x] Migrations SQL

### Frontend ✅
- [x] Service `tenant-features.service.ts`
- [x] Hook `useFeature`
- [x] Composant `<AcademicTrackSelector />`
- [x] Composant `<PedagogicalOptionsSettings />`
- [x] Intégration dans `DashboardHeader`

### Documentation ✅
- [x] Architecture Academic Tracks
- [x] Architecture Tenant Features
- [x] Guides d'implémentation
- [x] Résumés et checklists

## 🎯 Objectifs Atteints

- ✅ Système bilingue complet et fonctionnel
- ✅ Feature flags maîtrisés
- ✅ Pricing dynamique et transparent
- ✅ Protection totale des données existantes
- ✅ Audit et traçabilité complets
- ✅ Architecture extensible
- ✅ Zéro régression
- ✅ Zéro surprise client

## 🚀 Prochaines Étapes (Optionnelles)

### Améliorations Futures

1. **Vérifications de Dépendances Avancées**
   - Détecter automatiquement les données EN avant désactivation
   - Afficher un résumé détaillé (X classes, Y matières, Z notes)

2. **Pricing Plus Sophistiqué**
   - Pricing par nombre d'élèves bilingues
   - Pricing dégressif
   - Périodes d'essai gratuites

3. **Analytics ORION**
   - Dashboard de comparaison FR vs EN
   - Recommandations personnalisées
   - Alertes proactives

4. **Extensions**
   - Cambridge Curriculum
   - IB Program
   - Montessori

## 📚 Ressources

- [Architecture Academic Tracks](./ACADEMIC-TRACKS-ARCHITECTURE.md)
- [Architecture Tenant Features](./TENANT-FEATURES-ARCHITECTURE.md)
- [Guide Implémentation Academic Tracks](./ACADEMIC-TRACKS-IMPLEMENTATION-GUIDE.md)
- [Guide Implémentation Tenant Features](./TENANT-FEATURES-IMPLEMENTATION-GUIDE.md)
- [Migrations SQL](../migrations/)

