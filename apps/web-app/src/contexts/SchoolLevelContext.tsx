/**
 * Contexte partagé pour le niveau scolaire actif.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 *
 * COMPORTEMENT "NIVEAU SCOLAIRE STRICT" :
 * - Quand l'utilisateur bascule vers un autre niveau, on invalide TOUTES les
 *   queries TanStack pour forcer le rechargement avec le nouveau niveau.
 * - On dispatch aussi un CustomEvent 'school-level-changed' pour informer
 *   les composants hors React (services, hooks personnalisés, etc.).
 *
 * ⭐ DEPUIS LE TRAVAIL OFFLINE :
 *   La liste des niveaux est maintenant chargée via React Query
 *   (`useSchoolLevelsQuery`) au lieu d'un fetch manuel. Cela permet :
 *   - l'auto-récupération quand on revient online (`refetchOnReconnect: true`)
 *   - l'invalidation automatique sur `sync-end` et `session-resumed`
 *     (gérés par QueryProvider)
 *   - un cache partagé 5 min entre tous les consommateurs
 *   - un `isLoading` correctement distingué de "pas de données"
 *     (avant : si le fetch échouait, `isLoading=false` mais `availableLevels=[]`
 *      → les pages restaient vides sans possibilité de récup)
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSessionOptional } from '@/contexts/AppSessionContext';
import { useSchoolLevelsQuery } from '@/lib/query/use-school-levels';
import { getUserScope, type UserScope } from '@/lib/auth/user-scope';

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
  const availableLevelsRef = useRef<SchoolLevel[]>([]);
  availableLevelsRef.current = availableLevels;

  // ⭐ FIX 2026-09-07 : le scope serveur arrive de façon ASYNCHRONE (login →
  //    /context/bootstrap → persistUserScope → event 'user-scope-loaded') alors
  //    que ce provider est déjà monté. Sans re-run, l'option 'ALL' resterait
  //    proposée/sauvegardée pour un compte restreint jusqu'au rechargement.
  const [scopeTick, setScopeTick] = useState(0);
  useEffect(() => {
    const onScopeLoaded = () => setScopeTick((t) => t + 1);
    window.addEventListener('user-scope-loaded', onScopeLoaded);
    return () => {
      window.removeEventListener('user-scope-loaded', onScopeLoaded);
    };
  }, []);

  // ⭐ Chargement via React Query — bénéficie du cache partagé, retry,
  //    refetchOnReconnect et invalidation sur sync-end / session-resumed.
  const { data: rawLevels, isLoading: levelsLoading } = useSchoolLevelsQuery();

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

  // ─── Construction de la liste disponible (avec option "ALL") ──────────────
  //    Lancé en effet dès que `rawLevels` change — inclut l'auto-sélection
  //    pour les enseignants (depuis leurs accreditations ou leurs classes).
  //
  // ⭐ FIX 2026-09-07 « périmètres restreints » (secrétaires, comptables…) :
  //    L'option virtuelle «Tous les niveaux» était proposée et AUTO-SÉLECTIONNÉE
  //    (withAll[0]) pour TOUS les rôles → localStorage schoolLevel = {id:'ALL'}
  //    → l'intercepteur axios envoyait x-school-level-id=ALL → AccessScopeGuard
  //    (backend, global) → 403 «Accès refusé» sur les appels directs (dont la
  //    finalisation d'inscription preRegister/admit) pour tout compte à
  //    périmètre restreint (Staff/StaffAdminAssignment — scope.allLevels=false).
  //    → L'option ALL est désormais réservée aux comptes dont le scope serveur
  //    l'autorise (transverses : promoteur, plateforme, compte sans périmètre) ;
  //    les comptes restreints sont auto-sélectionnés sur un niveau de LEUR
  //    périmètre (self-heal : un 'ALL' sauvegardé est remplacé).
  useEffect(() => {
    if (!rawLevels || rawLevels.length === 0) {
      // Pas de données — on ne touche pas à currentLevel (pour ne pas clignoter)
      setAvailableLevels([]);
      return;
    }

    const activeLevels = rawLevels.filter((l) => l.isActive);

    // Scope serveur persisté (login / context-bootstrap) — cf. user-scope.ts.
    // Null/absent → rétro-compat : on garde l'option ALL (comportement antérieur).
    const scope: UserScope | null = getUserScope();
    const scopeAllowsAll = !scope || scope.allLevels !== false;

    // Option virtuelle "Tous les niveaux" — UNIQUEMENT si le périmètre l'autorise.
    const allLevelsOption: SchoolLevel = {
      id: 'ALL',
      code: 'ALL',
      label: 'Tous les niveaux',
      isActive: true,
    };

    const withAll = scopeAllowsAll ? [allLevelsOption, ...activeLevels] : activeLevels;
    setAvailableLevels(withAll);

    // ─── Sélection du niveau courant ────────────────────────────────────────
    const savedLevelId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ID) : null;

    // Si on a déjà un niveau courant et qu'il est toujours valide, on le garde
    if (currentLevel && withAll.some((l) => l.id === currentLevel.id)) {
      // Synchroniser l'objet complet (peut avoir changé de label/code)
      const refreshed = withAll.find((l) => l.id === currentLevel.id)!;
      setCurrentLevelState(refreshed);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(refreshed));
        } catch { /* ignore quota errors */ }
      }
      return;
    }

    // ⭐ Auto-sélection du niveau pour les enseignants :
    //    Si l'utilisateur est un enseignant et qu'il n'a pas de niveau sauvegardé
    //    (ou "ALL"), on déduit son niveau depuis ses accreditations.
    //    (NB : on ne fait plus le fetch vers /api/pedagogy-space/my-classes ici
    //     — c'était une source de race condition avec AcademicYearProvider. Les
    //     accreditations du user suffisent dans la grande majorité des cas.)
    let autoSelectedLevel: SchoolLevel | null = null;
    const isTeacher = userRole === 'TEACHER' || userRole === 'TEACHER_RESP' || userRole === 'teacher';

    if (isTeacher && (!savedLevelId || savedLevelId === 'ALL') && activeLevels.length > 0) {
      if (userAccreditations && userAccreditations.length > 0) {
        for (const acc of userAccreditations) {
          const match = activeLevels.find((l) => l.code === acc);
          if (match) {
            autoSelectedLevel = match;
            break;
          }
        }
      }
    }

    // ⭐ FIX 2026-09-07 : compte à périmètre restreint (scope.allLevels=false,
    //    ex: secrétaire/secrétaire comptable) → auto-sélection d'un niveau de
    //    SON périmètre. Couvre le self-heal d'un 'ALL' sauvegardé (plus proposé)
    //    et le premier chargement sans sélection.
    if (!scopeAllowsAll && !autoSelectedLevel && (!savedLevelId || savedLevelId === 'ALL')) {
      const scopedLevelIds = scope?.levelIds ?? [];
      const scopedLevelCodes = scope?.levelCodes ?? [];
      autoSelectedLevel =
        activeLevels.find(
          (l) =>
            (l.schoolLevelId && scopedLevelIds.includes(l.schoolLevelId)) ||
            (l.code && scopedLevelCodes.includes(l.code)),
        ) || null;
    }

    const selectedLevel = autoSelectedLevel
      || (savedLevelId ? withAll.find((l) => l.id === savedLevelId) || null : null)
      || withAll[0];

    if (selectedLevel) {
      const previousLevelId = currentLevel?.id;
      setCurrentLevelState(selectedLevel);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, selectedLevel.id);
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(selectedLevel));
        } catch { /* ignore quota errors */ }
      }
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
    // ⚠️ On retire `currentLevel?.id` des deps pour éviter une boucle infinie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLevels, userRole, userAccreditations, scopeTick, invalidateQueriesForLevelChange]);

  // ─── Recharger quand l'event "settings-updated" est dispatché ──────────────
  useEffect(() => {
    const onSchoolLevelsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['school-levels'] });
    };
    window.addEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSchoolLevelsUpdated);
    return () => {
      window.removeEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSchoolLevelsUpdated);
    };
  }, [queryClient]);

  const setCurrentLevel = useCallback((levelId: string) => {
    const levels = availableLevelsRef.current;
    const level = levels.find((l) => l.id === levelId);
    if (level) {
      const previousLevelId = currentLevel?.id;
      setCurrentLevelState(level);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, levelId);
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(level));
        } catch { /* ignore quota errors */ }
      }
      if (previousLevelId !== levelId) {
        invalidateQueriesForLevelChange();
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
    isLoading: levelsLoading,
  }), [currentLevel, setCurrentLevel, availableLevels, levelsLoading]);

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
