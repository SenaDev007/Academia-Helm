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
import { useAppSessionOptional } from '@/contexts/AppSessionContext';

export interface SchoolLevel {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  /**
   * UUID de school_levels (table SQL school_levels).
   * Différent de `id` qui est l'UUID de education_levels.
   * Nécessaire pour les appels API finance/fee-structures/fee-regimes
   * qui ont une FK vers school_levels.id.
   */
  schoolLevelId?: string | null;
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
  const session = useAppSessionOptional();
  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const userAccreditations = session?.user?.accreditations;
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

        // ⭐ Auto-sélection du niveau pour les enseignants :
        //    Si l'utilisateur est un enseignant (TEACHER/TEACHER_RESP) et qu'il n'a pas
        //    de niveau sauvegardé (ou "ALL"), on déduit son niveau depuis ses
        //    accreditations ou on fetch ses classes assignées.
        let autoSelectedLevel: SchoolLevel | null = null;
        const isTeacher = userRole === 'TEACHER' || userRole === 'TEACHER_RESP' || userRole === 'teacher';

        if (isTeacher && (!savedLevelId || savedLevelId === 'ALL') && activeLevels.length > 0) {
          // 1. Essayons d'abord les accreditations du user
          if (userAccreditations && userAccreditations.length > 0) {
            // Prendre la première accreditation qui correspond à un niveau actif
            for (const acc of userAccreditations) {
              const match = activeLevels.find((l) => l.code === acc);
              if (match) {
                autoSelectedLevel = match;
                break;
              }
            }
          }

          // 2. Si pas d'accreditation, fetch /api/pedagogy-space/my-classes pour déduire le niveau
          if (!autoSelectedLevel && userId) {
            try {
              // ⭐ Récupérer l'academicYearId depuis localStorage (clé 'currentAcademicYearId')
              const academicYearId = typeof window !== 'undefined'
                ? (localStorage.getItem('currentAcademicYearId') || localStorage.getItem('academicYearId') || '')
                : '';
              // ⭐ Si pas d'academicYearId, on fait quand même le fetch — le backend
              //    peut utiliser l'année par défaut depuis le header X-Academic-Year-ID
              const url = academicYearId
                ? `/api/pedagogy-space/my-classes?teacherId=${userId}&academicYearId=${academicYearId}`
                : `/api/pedagogy-space/my-classes?teacherId=${userId}`;
              const classesRes = await fetch(url, { credentials: 'include' });
              if (classesRes.ok) {
                const classesData = await classesRes.json();
                const classes = Array.isArray(classesData) ? classesData : (classesData?.data || []);
                // Prendre le schoolLevelCode de la première classe
                if (classes.length > 0) {
                  const firstClass = classes[0];
                  const slCode = firstClass.schoolLevel?.code
                    || firstClass.physicalClass?.schoolLevel?.code
                    || firstClass.schoolLevelCode
                    || '';
                  if (slCode) {
                    autoSelectedLevel = activeLevels.find((l) => l.code === slCode) || null;
                  }
                }
              }
            } catch {
              // Silent fallback
            }
          }
        }

        const selectedLevel = autoSelectedLevel
          || (savedLevelId ? withAll.find((l) => l.id === savedLevelId) || null : null)
          || withAll[0];

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
  }, [currentLevel?.id, invalidateQueriesForLevelChange, userRole, userId, userAccreditations]);

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
