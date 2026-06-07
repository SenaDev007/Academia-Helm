/**
 * Hook pour récupérer les codes des modules activés (feature flags) du tenant courant.
 * Utilisé par la sidebar pour n'afficher que les modules activés.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';
import * as settingsService from '@/services/settings.service';

interface FeatureItem {
  featureCode: string;
  isEnabled: boolean;
  status?: string;
}

export function useEnabledFeatureCodes() {
  const { tenant } = useAppSession();
  const [list, setList] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(() => {
    const tid = tenant?.id;
    if (!tid) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    settingsService
      .getFeatures(tid)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setList(arr);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // Réagir aux changements depuis la page Paramètres (toggle module) pour mettre à jour la sidebar
  useEffect(() => {
    const handler = () => fetchFeatures();
    window.addEventListener('settings:features-updated', handler);
    return () => window.removeEventListener('settings:features-updated', handler);
  }, [fetchFeatures]);

  const enabledSet = useMemo(() => {
    const set = new Set<string>();
    for (const f of list) {
      if (f.isEnabled && (f.status === 'ACTIVE' || !f.status)) {
        set.add(f.featureCode);
      }
    }
    return set;
  }, [list]);

  return { enabledSet, loading, list, refresh: fetchFeatures };
}
