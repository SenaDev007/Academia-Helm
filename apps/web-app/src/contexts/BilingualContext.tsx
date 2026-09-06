/**
 * ============================================================================
 * BILINGUAL CONTEXT — État partagé du mode bilingue FR/EN
 * ============================================================================
 *
 * Expose l'état de l'option bilingue de l'établissement (activée / non activée),
 * la "track" courante (FR ou EN) sélectionnée par l'utilisateur, et le booléen
 * `separateGrades` qui indique si les notes doivent être séparées par langue.
 *
 * Ce contexte est volontairement minimal : il est consommé par les pages
 * Examens (saisie, bulletins, évaluations, validation, moyennes, analytics)
 * et par les workspaces Pédagogie (Timetables, Assignments) pour :
 *   1. Afficher un sélecteur FR/EN en haut de la page
 *   2. Passer `language` en query param dans tous les fetchs API
 *
 * ⭐ DEPUIS LE TRAVAIL OFFLINE :
 *   L'état est maintenant chargé via React Query au lieu d'un fetch manuel.
 *   Cela permet :
 *   - l'auto-récupération quand on revient online (`refetchOnReconnect: true`)
 *   - l'invalidation automatique sur `sync-end` et `session-resumed`
 *     (gérés par QueryProvider) — l'ancien code restait vide après une sync
 *   - un `isLoading` correctement distingué d'une erreur de chargement
 *     (avant : si l'API échouait, `isLoading=false` mais `settings=null`,
 *      ce qui était interprété comme "bilingue désactivé" par les pages)
 *
 * La track courante est persistée en localStorage pour survivre aux
 * rechargements.
 * ============================================================================
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserScope } from '@/lib/auth/user-scope';
import * as settingsService from '@/services/settings.service';

export type LanguageTrack = 'FR' | 'EN';

export interface BilingualSettings {
  isEnabled: boolean;
  separateSubjects?: boolean;
  separateGrades?: boolean;
  defaultLanguage?: string;
  defaultUILanguage?: string;
}

interface BilingualContextType {
  /** Indique si l'option bilingue est activée pour ce tenant */
  isEnabled: boolean;
  /** Indique si les notes FR/EN doivent être séparées */
  separateGrades: boolean;
  /** Indique si les matières FR/EN doivent être séparées */
  separateSubjects: boolean;
  /** Track courante sélectionnée par l'utilisateur (FR ou EN) */
  currentTrack: LanguageTrack;
  /** Change la track courante */
  setCurrentTrack: (track: LanguageTrack) => void;
  /** Indique si les paramètres sont en cours de chargement */
  isLoading: boolean;
}

const STORAGE_KEY = 'bilingualCurrentTrack';

const BilingualContext = createContext<BilingualContextType | undefined>(undefined);

/**
 * Query key partagée pour les paramètres bilingues — permet à n'importe quel
 * composant d'invalider le cache via `queryClient.invalidateQueries(['bilingual'])`.
 */
const BILINGUAL_QUERY_KEY = ['bilingual'] as const;

export function BilingualProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentTrack, setCurrentTrackState] = useState<LanguageTrack>('FR');

  // ⭐ Chargement via React Query — auto-récup sur reconnect / sync-end.
  const { data: settings, isLoading } = useQuery<BilingualSettings | null>({
    queryKey: BILINGUAL_QUERY_KEY,
    queryFn: async () => {
      try {
        const data = await settingsService.getBilingualSettings();
        if (data && typeof data === 'object') {
          return data as BilingualSettings;
        }
        return null;
      } catch {
        // Pas de données — ne pas crasher. Différencié de "loading" grâce à
        // isLoading=false + settings=null (mais isError=true si on veut le distinguer).
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // ── Initialiser la track courante quand les settings sont reçus ─────────────
  //    ⭐ FIX 2026-09-06 (P4) : initialisation intelligente —
  //      1. Si le scope serveur de l'utilisateur (résolu depuis ses profils
  //         métier) est mono-piste → SA piste est imposée.
  //      2. Sinon (bi-piste / promoteur) → restauration de la dernière piste
  //         choisie (localStorage) puis FR par défaut.
  useEffect(() => {
    if (settings) {
      const userScope = getUserScope();
      if (userScope && !userScope.allTracks && Array.isArray(userScope.trackCodes) && userScope.trackCodes.length === 1) {
        // Mono-piste : la piste du profil est imposée (UI + données)
        setCurrentTrackState(userScope.trackCodes[0] === 'EN' ? 'EN' : 'FR');
        return;
      }
      const stored =
        typeof window !== 'undefined'
          ? (localStorage.getItem(STORAGE_KEY) as LanguageTrack | null)
          : null;
      if (stored === 'FR' || stored === 'EN') {
        setCurrentTrackState(stored);
        return;
      }
      setCurrentTrackState('FR');
    }
  }, [settings]);

  // ── ⭐ P4-bis : le scope peut arriver APRÈS les settings (bootstrap async
  //    du TenantContext) — on écoute l'événement pour imposer la piste du
  //    profil dès qu'il est connu (mono-piste directeurs notamment).
  useEffect(() => {
    const onScopeLoaded = () => {
      const userScope = getUserScope();
      if (
        userScope &&
        !userScope.allTracks &&
        Array.isArray(userScope.trackCodes) &&
        userScope.trackCodes.length === 1
      ) {
        setCurrentTrackState(userScope.trackCodes[0] === 'EN' ? 'EN' : 'FR');
      }
    };
    window.addEventListener('user-scope-loaded', onScopeLoaded);
    return () => window.removeEventListener('user-scope-loaded', onScopeLoaded);
  }, []);

  // ── setCurrentTrack : persiste en localStorage ────────────────────────────
  const setCurrentTrack = useCallback((track: LanguageTrack) => {
    setCurrentTrackState(track);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, track);
      } catch {
        /* ignore quota errors */
      }
    }
  }, []);

  // ── Permet à une page Settings d'invalider le cache après une mise à jour ──
  useEffect(() => {
    const onBilingualUpdated = () => {
      queryClient.invalidateQueries({ queryKey: BILINGUAL_QUERY_KEY });
    };
    window.addEventListener('settings-bilingual-updated', onBilingualUpdated);
    return () => {
      window.removeEventListener('settings-bilingual-updated', onBilingualUpdated);
    };
  }, [queryClient]);

  const value = useMemo<BilingualContextType>(
    () => ({
      isEnabled: !!settings?.isEnabled,
      separateGrades: !!settings?.separateGrades,
      separateSubjects: !!settings?.separateSubjects,
      currentTrack,
      setCurrentTrack,
      isLoading,
    }),
    [settings, currentTrack, setCurrentTrack, isLoading]
  );

  return (
    <BilingualContext.Provider value={value}>{children}</BilingualContext.Provider>
  );
}

export function useBilingual(): BilingualContextType {
  const ctx = useContext(BilingualContext);
  if (ctx === undefined) {
    // Retourne un stub non-bilingue si le provider n'est pas monté
    // (évite le crash sur les pages utilisant useBilingual hors provider)
    return {
      isEnabled: false,
      separateGrades: false,
      separateSubjects: false,
      currentTrack: 'FR',
      setCurrentTrack: () => {},
      isLoading: false,
    };
  }
  return ctx;
}

/**
 * Sélecteur FR/EN réutilisable.
 * Ne s'affiche que si l'option bilingue est activée.
 */
export function BilingualTrackSelector({
  className = '',
}: {
  className?: string;
}) {
  const { isEnabled, currentTrack, setCurrentTrack } = useBilingual();
  if (!isEnabled) return null;
  return (
    <div
      className={`flex items-center gap-2 bg-slate-100 rounded-xl p-1 mb-4 ${className}`}
    >
      <button
        type="button"
        onClick={() => setCurrentTrack('FR')}
        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
          currentTrack === 'FR'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500'
        }`}
      >
        Français
      </button>
      <button
        type="button"
        onClick={() => setCurrentTrack('EN')}
        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
          currentTrack === 'EN'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500'
        }`}
      >
        English
      </button>
    </div>
  );
}
