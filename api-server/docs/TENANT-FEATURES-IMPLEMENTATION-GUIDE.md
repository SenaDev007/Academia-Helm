# Guide d'Implémentation - Tenant Features

## 🚀 Démarrage Rapide

### 1. Exécuter la Migration

```bash
# Exécuter la migration SQL
psql -U postgres -d academiahub -f migrations/002_add_tenant_features.sql
```

### 2. Vérifier l'Initialisation

```bash
# Vérifier que la table existe
SELECT * FROM tenant_features LIMIT 1;
```

## 📝 Utilisation dans le Code

### Vérifier si une Feature est Activée

```typescript
// Dans un service
const isBilingualEnabled = await tenantFeaturesService.isFeatureEnabled(
  FeatureCode.BILINGUAL_TRACK,
  tenantId
);

if (isBilingualEnabled) {
  // Afficher le sélecteur Academic Track
  // Permettre la création de données EN
} else {
  // Masquer le sélecteur
  // Toutes les actions utilisent FR par défaut
}
```

### Activer une Feature

```typescript
// Activation avec impact pricing
const result = await tenantFeaturesService.enableFeature(
  FeatureCode.BILINGUAL_TRACK,
  tenantId,
  userId,
  'Activation depuis les paramètres'
);

console.log('Feature activée:', result.feature);
console.log('Impact pricing:', result.pricingImpact);
// { monthly: 15000, annual: 150000 }
```

### Désactiver une Feature

```typescript
// Désactivation avec vérification des dépendances
const result = await tenantFeaturesService.disableFeature(
  FeatureCode.BILINGUAL_TRACK,
  tenantId,
  userId,
  'Désactivation de l\'option bilingue'
);

console.log('Feature désactivée:', result.feature);
console.log('Réduction pricing:', result.pricingImpact);
// { monthly: -15000, annual: -150000 }
```

### Calculer l'Impact Pricing Total

```typescript
// Calculer l'impact total de toutes les features activées
const impact = await tenantFeaturesService.calculatePricingImpact(tenantId);

// Utiliser pour le calcul du prix total
const basePrice = 100000; // Prix de base
const totalPrice = {
  monthly: basePrice + impact.monthly,
  annual: (basePrice * 12) + impact.annual,
};
```

## 🎨 Frontend - Sélecteur Conditionnel

### Composant React (Exemple)

```typescript
// AcademicTrackSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/hooks/useTenant';

export function AcademicTrackSelector() {
  const { tenantId } = useTenant();
  const [isBilingualEnabled, setIsBilingualEnabled] = useState(false);
  const [currentTrack, setCurrentTrack] = useState('FR');

  useEffect(() => {
    // Vérifier si la feature est activée
    checkBilingualFeature();
  }, [tenantId]);

  const checkBilingualFeature = async () => {
    const response = await fetch(`/api/tenant-features/check/BILINGUAL_TRACK`);
    const enabled = await response.json();
    setIsBilingualEnabled(enabled);
  };

  // Ne pas afficher si la feature n'est pas activée
  if (!isBilingualEnabled) {
    return null;
  }

  return (
    <div className="academic-track-selector">
      <label>Academic Track:</label>
      <select 
        value={currentTrack} 
        onChange={(e) => setCurrentTrack(e.target.value)}
      >
        <option value="FR">Francophone</option>
        <option value="EN">Anglophone</option>
      </select>
    </div>
  );
}
```

### Hook Personnalisé

```typescript
// hooks/useFeature.ts
import { useState, useEffect } from 'react';
import { FeatureCode } from '@/types';

export function useFeature(featureCode: FeatureCode) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFeature();
  }, [featureCode]);

  const checkFeature = async () => {
    try {
      const response = await fetch(`/api/tenant-features/check/${featureCode}`);
      const enabled = await response.json();
      setIsEnabled(enabled);
    } catch (error) {
      console.error('Error checking feature:', error);
    } finally {
      setLoading(false);
    }
  };

  return { isEnabled, loading, refresh: checkFeature };
}

// Utilisation
const { isEnabled: isBilingualEnabled } = useFeature(FeatureCode.BILINGUAL_TRACK);
```

## ⚙️ Paramètres > Options pédagogiques

### Composant de Paramètres

```typescript
// SettingsPedagogicalOptions.tsx
'use client';

import { useState } from 'react';
import { useFeature } from '@/hooks/useFeature';
import { FeatureCode } from '@/types';

export function SettingsPedagogicalOptions() {
  const { isEnabled, refresh } = useFeature(FeatureCode.BILINGUAL_TRACK);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleToggle = async () => {
    if (!isEnabled) {
      // Afficher modal de confirmation avec impact pricing
      setShowConfirmModal(true);
    } else {
      // Désactiver directement (avec confirmation)
      await disableFeature();
    }
  };

  const enableFeature = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tenant-features/enable/BILINGUAL_TRACK', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Activation depuis les paramètres',
        }),
      });

      const result = await response.json();
      
      // Afficher le nouveau pricing
      alert(`Option activée. Impact: +${result.pricingImpact.monthly} FCFA/mois`);
      
      refresh();
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Error enabling feature:', error);
    } finally {
      setLoading(false);
    }
  };

  const disableFeature = async () => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver l\'option bilingue ?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/tenant-features/disable/BILINGUAL_TRACK', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Désactivation depuis les paramètres',
        }),
      });

      const result = await response.json();
      
      // Afficher la réduction pricing
      alert(`Option désactivée. Réduction: ${result.pricingImpact.monthly} FCFA/mois`);
      
      refresh();
    } catch (error) {
      console.error('Error disabling feature:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-pedagogical-options">
      <h2>Options pédagogiques</h2>
      
      <div className="feature-toggle">
        <label>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggle}
            disabled={loading}
          />
          Enseignement bilingue (FR / EN)
        </label>
        
        <p className="feature-description">
          Cette option impacte la tarification et la structure pédagogique.
        </p>
        
        {isEnabled && (
          <div className="pricing-impact">
            <strong>Impact pricing :</strong>
            <ul>
              <li>+15 000 FCFA/mois</li>
              <li>+150 000 FCFA/an</li>
            </ul>
          </div>
        )}
      </div>

      {showConfirmModal && (
        <ConfirmFeatureModal
          feature="BILINGUAL_TRACK"
          onConfirm={enableFeature}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
}
```

## 🔍 Vérifications de Dépendances

### Avant Désactivation

```typescript
// Vérifier s'il existe des données EN avant désactivation
async function checkBilingualDependencies(tenantId: string): Promise<{
  hasClasses: boolean;
  hasSubjects: boolean;
  hasExams: boolean;
  hasGrades: boolean;
  canDisable: boolean;
}> {
  const enTrack = await academicTracksRepository.findByCode(AcademicTrackCode.EN, tenantId);
  
  if (!enTrack) {
    return { hasClasses: false, hasSubjects: false, hasExams: false, hasGrades: false, canDisable: true };
  }

  const [classesCount, subjectsCount, examsCount, gradesCount] = await Promise.all([
    classesRepository.count({ where: { tenantId, academicTrackId: enTrack.id } }),
    subjectsRepository.count({ where: { tenantId, academicTrackId: enTrack.id } }),
    examsRepository.count({ where: { tenantId, academicTrackId: enTrack.id } }),
    gradesRepository.count({ where: { tenantId, academicTrackId: enTrack.id } }),
  ]);

  return {
    hasClasses: classesCount > 0,
    hasSubjects: subjectsCount > 0,
    hasExams: examsCount > 0,
    hasGrades: gradesCount > 0,
    canDisable: true, // Toujours possible, mais avec avertissement
  };
}
```

## 📊 Intégration avec ORION

### Détection et Analyse

```typescript
// Dans le service ORION
async function analyzeBilingualPerformance(tenantId: string) {
  const isBilingualEnabled = await tenantFeaturesService.isFeatureEnabled(
    FeatureCode.BILINGUAL_TRACK,
    tenantId
  );

  if (!isBilingualEnabled) {
    return null; // Pas d'analyse bilingue si non activé
  }

  // Analyser performances FR vs EN
  const frStats = await calculateTrackStats(tenantId, AcademicTrackCode.FR);
  const enStats = await calculateTrackStats(tenantId, AcademicTrackCode.EN);

  // Générer des alertes si écart significatif
  if (Math.abs(frStats.average - enStats.average) > 5) {
    return {
      alert: 'PERFORMANCE_GAP',
      message: `Écart de performance entre FR (${frStats.average}) et EN (${enStats.average})`,
      recommendation: 'Analyser les causes de l\'écart',
    };
  }

  return { frStats, enStats };
}
```

## ⚠️ Points d'Attention

### 1. Toujours Vérifier la Feature Avant Affichage

```typescript
// ❌ MAUVAIS
<AcademicTrackSelector /> // Toujours affiché

// ✅ BON
{isBilingualEnabled && <AcademicTrackSelector />}
```

### 2. Utiliser le Track par Défaut si Feature Désactivée

```typescript
// ✅ BON
const trackId = isBilingualEnabled && selectedTrack === 'EN' 
  ? enTrackId 
  : frTrackId; // Toujours FR par défaut
```

### 3. Ne Jamais Supprimer les Données EN

```typescript
// ❌ MAUVAIS
if (!isBilingualEnabled) {
  await deleteAllENTracks(tenantId); // DANGEREUX !
}

// ✅ BON
if (!isBilingualEnabled) {
  // Masquer l'UI, mais conserver les données
  return null;
}
```

## 🧪 Tests

### Test : Activation de Feature

```typescript
it('should enable bilingual feature and calculate pricing', async () => {
  const result = await tenantFeaturesService.enableFeature(
    FeatureCode.BILINGUAL_TRACK,
    tenantId,
    userId
  );

  expect(result.feature.status).toBe(FeatureStatus.ENABLED);
  expect(result.pricingImpact.monthly).toBe(15000);
  expect(result.pricingImpact.annual).toBe(150000);
});
```

### Test : Sélecteur Conditionnel

```typescript
it('should hide selector when feature disabled', async () => {
  const isEnabled = await tenantFeaturesService.isFeatureEnabled(
    FeatureCode.BILINGUAL_TRACK,
    tenantId
  );

  expect(isEnabled).toBe(false);
  // Le sélecteur ne doit pas être rendu
});
```

## 📚 Ressources

- [Architecture Tenant Features](./TENANT-FEATURES-ARCHITECTURE.md)
- [Migration SQL](../migrations/002_add_tenant_features.sql)
- [API Endpoints](../API-ENDPOINTS.md)

