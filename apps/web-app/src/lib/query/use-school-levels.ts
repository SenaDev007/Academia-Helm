/**
 * ============================================================================
 * USE SCHOOL LEVELS — Hook React Query partagé pour les niveaux scolaires
 * ============================================================================
 *
 * AVANT : 18 composants faisaient chacun `fetch('/api/school-levels')` dans
 * un useEffect → 18 appels backend au lieu d'1, pas de cache partagé.
 *
 * MAINTENANT : 1 seul hook, cache 5 min partagé entre tous les composants.
 *
 * ⭐ V19 — ROBUSTESSE LOGIN (retour utilisateur : « le niveau scolaire ne
 *    charge pas à temps, comme les années scolaires ») :
 *    - les ERREURS (y compris abort/timeout) sont PROPAGÉES au lieu d'être
 *      avalées en `[]` → React Query retrye (avant : un échec réseau =
 *      « succès » avec liste vide → « Aucun niveau scolaire » rouge, figé) ;
 *    - SNAPSHOT localStorage : la dernière liste connue s'affiche
 *      INSTANTANÉMENT au montage pendant que le réseau répond ;
 *    - retry ×3 + refetch toutes les 5 s tant que la liste est VIDE (une
 *      école active a toujours ≥ 1 niveau — un [] est un échec déguisé) ;
 *    - networkMode 'always' : hors ligne, la queryFn tourne quand même et
 *      l'intercepteur offline sert le cache IndexedDB (response_cache).
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { authFetch } from '@/lib/api/auth-fetch';

export interface SchoolLevel {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  schoolLevelId?: string | null;
}

const LEVELS_SNAPSHOT_KEY = 'ah_school_levels_snapshot';
const LEVELS_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export async function fetchSchoolLevels(): Promise<SchoolLevel[]> {
  // ⭐ FIX 2026-09-14 « sélecteur niveau bloqué » : authFetch au lieu de fetch nu
  //    — sur 401 (JWT 15 min expiré), rafraîchit le token et relit UNE fois au
  //    lieu de renvoyer une liste vide « en succès » qui figeait le sélecteur.
  //    Timeout 12 s aligné sur le SW et le BFF (le 8 s historique coupait
  //    AVANT la fin du BFF sur cold start Neon → erreurs en cascade).
  const res = await authFetch('/api/school-levels', { timeoutMs: 12_000 });
  if (!res.ok) {
    // ⭐ V19 : propager l'erreur → retry React Query (≠ [] silencieux figé)
    throw new Error(`Chargement des niveaux scolaires impossible (HTTP ${res.status})`);
  }
  const data = await res.json();
  const levels = Array.isArray(data) ? data : [];
  // ⭐ V19 : snapshot localStorage pour l'affichage instantané au prochain login
  if (typeof window !== 'undefined' && levels.length > 0) {
    try {
      localStorage.setItem(
        LEVELS_SNAPSHOT_KEY,
        JSON.stringify({ savedAt: Date.now(), levels })
      );
    } catch { /* quota — non bloquant */ }
  }
  return levels;
}

/** ⭐ V19 : relit le snapshot localStorage (null si absent/périmé). */
export function readSchoolLevelsSnapshot(): SchoolLevel[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEVELS_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as { savedAt: number; levels: SchoolLevel[] };
    if (!Array.isArray(snapshot?.levels) || snapshot.levels.length === 0) return null;
    if (Date.now() - (snapshot.savedAt || 0) > LEVELS_SNAPSHOT_MAX_AGE_MS) return null;
    return snapshot.levels;
  } catch {
    return null;
  }
}

export function useSchoolLevelsQuery() {
  return useQuery<SchoolLevel[]>({
    queryKey: ['school-levels'],
    queryFn: fetchSchoolLevels,
    // ⭐ V19 : affichage instantané au montage (stale-while-revalidate)
    initialData: () => readSchoolLevelsSnapshot() ?? undefined,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1200 * 2 ** attempt, 5000),
    // ⭐ V19 : rejouer tant que la liste est VIDE (échec déguisé)
    refetchInterval: (query) => {
      const list = query.state.data as SchoolLevel[] | undefined;
      return Array.isArray(list) && list.length === 0 ? 5000 : false;
    },
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // ⭐ V19 : la queryFn tourne AUSSI hors ligne (cache IDB via intercepteur)
    networkMode: 'always',
  });
}

export default useSchoolLevelsQuery;
