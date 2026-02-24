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

  useEffect(() => {
    const loadSchoolLevels = async () => {
      try {
        const response = await fetch('/api/school-levels');
        if (response.ok) {
          const levels: SchoolLevel[] = await response.json();
          const activeLevels = levels.filter((l) => l.isActive);
          setAvailableLevels(activeLevels);

          const savedLevelId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
          const selectedLevel = savedLevelId
            ? activeLevels.find((l) => l.id === savedLevelId) || activeLevels[0]
            : activeLevels[0];

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
    };

    loadSchoolLevels();
  }, []);

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
