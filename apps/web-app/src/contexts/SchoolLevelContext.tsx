/**
 * Contexte partagé pour le niveau scolaire actif.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 *
 * COMPORTEMENT "NIVEAU SCOLAIRE STRICT" :
 * - Quand l'utilisateur bascule vers un autre niveau, on invalide TOUTES les
 *   queries TanStack pour forcer le rechargement avec le nouveau niveau.
 * - On dispatch aussi un CustomEvent 'school-level-changed' pour informer
 *   les composants hors React (services, hooks personnalisés, etc.).
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface SchoolLevel {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
}

/**
 * Nom du CustomEvent dispatch quand le niveau scolaire change.
 * Permet aux composants hors React d'écouter le changement.
 */
export const SCHOOL_LEVEL_CHANGED_EVENT = 'school-level-changed';

/**
 * Clés localStorage utilisées pour la persistance du niveau scolaire :
 * - STORAGE_KEY_ID ('currentSchoolLevelId') : juste l'ID, lu par ce contexte
 *   pour restaurer la sélection utilisateur entre les rechargements.
 * - STORAGE_KEY_OBJ ('schoolLevel') : l'objet niveau JSON complet, lu par
 *   l'intercepteur Axios (`lib/api/client.ts`) pour injecter le header
 *   `x-school-level-id` dans toutes les requêtes API sortantes.
 *
 * Les DEUX clés doivent être écrites en parallèle pour éviter le bug où
 * l'intercepteur ne trouve pas le niveau (header jamais injecté).
 */
const STORAGE_KEY_ID = 'currentSchoolLevelId';
const STORAGE_KEY_OBJ = 'schoolLevel';

import { SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT } from '@/lib/settings/events';

interface SchoolLevelContextType {
  currentLevel: SchoolLevel | null;
  setCurrentLevel: (levelId: string) => void;
  availableLevels: SchoolLevel[];
  isLoading: boolean;
}

const SchoolLevelContext = createContext<SchoolLevelContextType | undefined>(undefined);

export function SchoolLevelProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentLevel, setCurrentLevelState] = useState<SchoolLevel | null>(null);
  const [availableLevels, setAvailableLevels] = useState<SchoolLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const availableLevelsRef = useRef<SchoolLevel[]>([]);
  availableLevelsRef.current = availableLevels;

  /**
   * Invalide toutes les queries TanStack quand le niveau scolaire change.
   * Cela force le rechargement des données de tous les modules avec le
   * nouveau niveau (students, finance, pedagogy, exams, etc.).
   *
   * On préserve les queries liées aux niveaux scolaires eux-mêmes
   * (school-levels) pour éviter une boucle de rechargement.
   */
  const invalidateQueriesForLevelChange = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return true;
        // Préserver les queries 'school-levels' (sinon boucle)
        const firstKey = String(key[0]);
        if (firstKey === 'school-levels') return false;
        return true;
      },
    });
  }, [queryClient]);

  const loadSchoolLevels = useCallback(async () => {
    try {
      const response = await fetch('/api/school-levels', { cache: 'no-store' });
      if (response.ok) {
        const levels: SchoolLevel[] = await response.json();
        const activeLevels = levels.filter((l) => l.isActive);

        // Option virtuelle "Tous les niveaux" réservée aux rôles de plateforme.
        // Pour l'instant on l'ajoute toujours côté client; le backend gère 'ALL'.
        const allLevelsOption: SchoolLevel = {
          id: 'ALL',
          code: 'ALL',
          label: 'Tous les niveaux',
          isActive: true,
        };

        const withAll = [allLevelsOption, ...activeLevels];
        setAvailableLevels(withAll);

        const savedLevelId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ID) : null;
        const selectedLevel = savedLevelId
          ? withAll.find((l) => l.id === savedLevelId) || withAll[0]
          : withAll[0];

        if (selectedLevel) {
          const previousLevelId = currentLevel?.id;
          setCurrentLevelState(selectedLevel);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_ID, selectedLevel.id);
            // Synchroniser aussi l'objet JSON complet pour l'intercepteur Axios
            try {
              localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(selectedLevel));
            } catch {
              /* ignore quota errors */
            }
          }
          // Si le niveau a changé (pas juste le premier chargement), invalider les queries
          if (previousLevelId && previousLevelId !== selectedLevel.id) {
            invalidateQueriesForLevelChange();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent(SCHOOL_LEVEL_CHANGED_EVENT, {
                  detail: { previousLevelId, newLevelId: selectedLevel.id },
                }),
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load school levels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentLevel?.id, invalidateQueriesForLevelChange]);

  useEffect(() => {
    loadSchoolLevels();
  }, [loadSchoolLevels]);

  useEffect(() => {
    const onSchoolLevelsUpdated = () => {
      setIsLoading(true);
      void loadSchoolLevels();
    };
    window.addEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSchoolLevelsUpdated);
    return () => {
      window.removeEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSchoolLevelsUpdated);
    };
  }, [loadSchoolLevels]);

  const setCurrentLevel = useCallback((levelId: string) => {
    const levels = availableLevelsRef.current;
    const level = levels.find((l) => l.id === levelId);
    if (level) {
      const previousLevelId = currentLevel?.id;
      setCurrentLevelState(level);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, levelId);
        // Synchroniser aussi l'objet JSON complet pour l'intercepteur Axios
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(level));
        } catch {
          /* ignore quota errors */
        }
      }
      // Si le niveau a vraiment changé, invalider toutes les queries TanStack
      // pour forcer le rechargement avec le nouveau niveau
      if (previousLevelId !== levelId) {
        invalidateQueriesForLevelChange();
        // Dispatcher un CustomEvent pour informer les composants hors React
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(SCHOOL_LEVEL_CHANGED_EVENT, {
              detail: { previousLevelId, newLevelId: levelId },
            }),
          );
        }
      }
    }
  }, [currentLevel?.id, invalidateQueriesForLevelChange]);

  const value = useMemo<SchoolLevelContextType>(() => ({
    currentLevel,
    setCurrentLevel,
    availableLevels,
    isLoading,
  }), [currentLevel, setCurrentLevel, availableLevels, isLoading]);

  return (
    <SchoolLevelContext.Provider value={value}>
      {children}
    </SchoolLevelContext.Provider>
  );
}

export function useSchoolLevelContext(): SchoolLevelContextType {
  const context = useContext(SchoolLevelContext);
  if (context === undefined) {
    throw new Error('useSchoolLevelContext must be used within SchoolLevelProvider');
  }
  return context;
}
