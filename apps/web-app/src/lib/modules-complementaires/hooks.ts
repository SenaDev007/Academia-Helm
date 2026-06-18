/**
 * ============================================================================
 * HOOKS MODULES COMPLÉMENTAIRES
 * ============================================================================
 *
 * Hooks React pour les 8 modules complémentaires.
 * Tous les hooks acceptent academicYearId et gèrent le chargement/erreur.
 *
 * Hooks disponibles :
 * - useModulesDashboard(module, academicYearId) — stats dashboard
 * - useModulesList(module, resource, academicYearId) — liste paginée
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

export interface ModulesApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook pour récupérer les statistiques d'un dashboard de module.
 *
 * @param module Le nom du module ('library', 'transport', 'canteen', etc.)
 * @param academicYearId L'ID de l'année scolaire (requis)
 *
 * Usage :
 *   const { academicYear } = useModuleContext();
 *   const { data, loading, error } = useModulesDashboard('library', academicYear?.id);
 */
export function useModulesDashboard<T = any>(
  module: string,
  academicYearId?: string,
): ModulesApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!academicYearId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await modulesApi.get<T>(
        `${module}/dashboard`,
        buildModulesApiOptions(academicYearId),
      );
      // Compatibilité : le backend peut retourner { data: ... } ou directement l'objet
      setData((result as any)?.data ?? result);
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Erreur de chargement';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [module, academicYearId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook pour récupérer une liste de ressources d'un module.
 *
 * @param module Le nom du module ('library', 'transport', etc.)
 * @param resource Le nom de la ressource ('books', 'loans', 'vehicles', etc.)
 * @param academicYearId L'ID de l'année scolaire (requis)
 * @param extraFilters Filtres additionnels (optionnels)
 *
 * Usage :
 *   const { academicYear } = useModuleContext();
 *   const { data, loading, error } = useModulesList('library', 'books', academicYear?.id);
 */
export function useModulesList<T = any>(
  module: string,
  resource: string,
  academicYearId?: string,
  extraFilters?: Record<string, string | number | boolean | undefined>,
): ModulesApiState<T[]> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!academicYearId) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const options = buildModulesApiOptions(academicYearId);
      if (extraFilters) {
        for (const [k, v] of Object.entries(extraFilters)) {
          if (v !== undefined && v !== null && v !== '') {
            options[k] = String(v);
          }
        }
      }
      const result = await modulesApi.get(`${module}/${resource}`, options);
      // Compatibilité : le backend peut retourner { data: [...] } ou directement un tableau
      const list = Array.isArray(result) ? result : (result as any)?.data ?? [];
      setData(list);
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Erreur de chargement';
      setError(message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [module, resource, academicYearId, JSON.stringify(extraFilters)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
