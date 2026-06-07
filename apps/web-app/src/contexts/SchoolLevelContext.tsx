/**
 * Contexte partagé pour le niveau scolaire actif.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';

export interface SchoolLevel {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
}

const STORAGE_KEY = 'currentSchoolLevelId';
import { SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT } from '@/lib/settings/events';

interface SchoolLevelContextType {
  currentLevel: SchoolLevel | null;
  setCurrentLevel: (levelId: string) => void;
  availableLevels: SchoolLevel[];
  isLoading: boolean;
}

const SchoolLevelContext = createContext<SchoolLevelContextType | undefined>(undefined);

export function SchoolLevelProvider({ children }: { children: ReactNode }) {
  const [currentLevel, setCurrentLevelState] = useState<SchoolLevel | null>(null);
  const [availableLevels, setAvailableLevels] = useState<SchoolLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const availableLevelsRef = useRef<SchoolLevel[]>([]);
  availableLevelsRef.current = availableLevels;

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

        const savedLevelId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        const selectedLevel = savedLevelId
          ? withAll.find((l) => l.id === savedLevelId) || withAll[0]
          : withAll[0];

        if (selectedLevel) {
          setCurrentLevelState(selectedLevel);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, selectedLevel.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load school levels:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      setCurrentLevelState(level);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, levelId);
      }
    }
  }, []);

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
