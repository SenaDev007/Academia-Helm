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
 * L'état est chargé depuis `/api/settings/bilingual` (géré par settingsService).
 * La track courante est persistée en localStorage pour survivre aux
 * rechargements.
 *
 * NOTE — Ce fichier est un stub fonctionnel qui pourra être enrichi par
 * l'agent responsable du BilingualContext. Il expose déjà le contrat
 * `{ isEnabled, currentTrack, setCurrentTrack, separateGrades }` attendu
 * par les pages Examens et Pédagogie.
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

export function BilingualProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BilingualSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrack, setCurrentTrackState] = useState<LanguageTrack>('FR');

  // ── Load bilingual settings from API ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await settingsService.getBilingualSettings();
        if (!mounted) return;
        if (data && typeof data === 'object') {
          setSettings(data as BilingualSettings);
          // Initialiser la track courante à partir de la langue par défaut
          const defaultLang = (data as any).defaultLanguage || (data as any).defaultUILanguage || 'FR';
          const initial: LanguageTrack = defaultLang === 'EN' ? 'EN' : 'FR';

          // Par défaut, toujours commencer sur FR (langue principale au Bénin).
          // On ne restaure PAS depuis localStorage pour éviter qu'un utilisateur
          // qui a basculé sur EN une fois reste bloqué sur EN à chaque visite.
          // L'utilisateur peut basculer manuellement via le switch FR/EN.
          setCurrentTrackState('FR');
        }
      } catch (err) {
        // Silencieux : si l'API n'est pas disponible, on reste en mode non-bilingue
        if (mounted) setSettings(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
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
