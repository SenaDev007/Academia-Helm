/**
 * Hook React pour vérifier si une feature est activée
 */

import { useState, useEffect } from 'react';
import { isFeatureEnabled, FeatureCode } from '@/lib/features/tenant-features.service';

// Ré-exporter FeatureCode pour simplifier les imports côté composants
export { FeatureCode } from '@/lib/features/tenant-features.service';

export function useFeature(featureCode: FeatureCode) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    checkFeature();
  }, [featureCode]);

  const checkFeature = async () => {
    setLoading(true);
    setError(null);
    try {
      const enabled = await isFeatureEnabled(featureCode);
      setIsEnabled(enabled);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    isEnabled,
    loading,
    error,
    refresh: checkFeature,
  };
}

