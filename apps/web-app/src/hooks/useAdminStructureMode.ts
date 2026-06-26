'use client';

/**
 * ============================================================================
 * useAdminStructureMode — Hook pour le mode d'administration scolaire
 * ============================================================================
 *
 * Charge et expose le mode d'administration du tenant courant :
 *   - SEPARATE : chaque niveau a sa propre administration
 *   - FUSED_MATERNELLE_PRIMAIRE : maternelle+primaire fusionnés, secondaire à part
 *
 * Utilisation :
 *   const { mode, groups, loading, setMode } = useAdminStructureMode();
 *
 * Le mode est mis en cache en localStorage pour éviter les appels API
 * répétés. Une invalidation manuelle est possible via reload().
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  adminStructureService,
  type AdminStructureMode,
  type AdminGroup,
} from '@/services/admin-structure.service';

const STORAGE_KEY = 'admin_structure_mode';
const GROUPS_STORAGE_KEY = 'admin_structure_groups';

interface UseAdminStructureModeResult {
  mode: AdminStructureMode;
  groups: AdminGroup[];
  loading: boolean;
  error: string | null;
  setMode: (mode: AdminStructureMode) => Promise<void>;
  reload: () => Promise<void>;
}

export function useAdminStructureMode(): UseAdminStructureModeResult {
  const [mode, setModeState] = useState<AdminStructureMode>('SEPARATE');
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminStructureService.getGroups();
      setModeState(data.mode);
      setGroups(data.groups || []);
      // Cache localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, data.mode);
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(data.groups || []));
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement du mode d\'administration');
      // Fallback : lire depuis localStorage
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY) as AdminStructureMode | null;
        if (cached) setModeState(cached);
        const cachedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
        if (cachedGroups) {
          try { setGroups(JSON.parse(cachedGroups)); } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setMode = useCallback(async (newMode: AdminStructureMode) => {
    setLoading(true);
    setError(null);
    try {
      await adminStructureService.setMode(newMode);
      setModeState(newMode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newMode);
      }
      // Recharger les groups car ils dépendent du mode
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour du mode');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  return { mode, groups, loading, error, setMode, reload: load };
}
