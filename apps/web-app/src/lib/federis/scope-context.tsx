/**
 * useFederisScope — Contexte de périmètre du patronat national (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ AGRÉGATION NATIONALE (2026-10-01) :
 *
 * Le patronat national connecté voit, dans TOUS les modules, l'agrégation de
 * tout ce qui se fait dans chaque département. Il peut restreindre la vue à
 * UN département (sélecteur de la barre de périmètre). Il est en LECTURE
 * SEULE partout, sauf pour les départements dont le coordonnateur lui a
 * donné la main (délégation).
 *
 * Ce contexte est fourni par le FederisLayout (monté une seule fois — layout
 * partagé du groupe (connected)) et consommé par :
 *   - la barre de périmètre (sélecteur de département + statut lecture seule) ;
 *   - les hooks de données (paramètre ?departmentId= des listes) ;
 *   - les gardes d'écriture UI (boutons d'action masqués en lecture seule).
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient } from '@/lib/api/client';

export interface FederisScopeDepartment {
  patronatId: string;
  name: string;
  territoryName: string | null;
  canWrite: boolean;
  grantedAt: string | null;
  grantedByName: string | null;
}

interface FederisScopeContextValue {
  /** true si le patronat connecté est NATIONAL (agrégation active). */
  isNational: boolean;
  /** Départements du réseau + statut de délégation du compte connecté. */
  departments: FederisScopeDepartment[];
  /** Département sélectionné (null = tous — vue agrégée). */
  selectedDepartmentId: string | null;
  setSelectedDepartmentId: (id: string | null) => void;
  /**
   * Droit d'écriture EFFECTIF dans le contexte courant :
   *   - territorial : toujours true (gardes de fonction normales) ;
   *   - national « tous les départements » : false (lecture seule stricte) ;
   *   - national + département sélectionné : true SEULEMENT si ce département
   *     a délégué ses droits au compte connecté.
   */
  canWrite: boolean;
  /** Libellé court du statut (affiché par la barre de périmètre). */
  readOnlyLabel: string | null;
  /** Recharge les délégations (après une action de délégation). */
  refresh: () => Promise<void>;
}

const FederisScopeContext = createContext<FederisScopeContextValue>({
  isNational: false,
  departments: [],
  selectedDepartmentId: null,
  setSelectedDepartmentId: () => undefined,
  canWrite: true,
  readOnlyLabel: null,
  refresh: async () => undefined,
});

const DEPARTMENT_STORAGE_KEY = 'federis_selected_department';

export function FederisScopeProvider({
  children,
  isNational,
}: {
  children: ReactNode;
  isNational: boolean;
}) {
  const [departments, setDepartments] = useState<FederisScopeDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentIdState] = useState<string | null>(null);

  // Restaure le dernier département sélectionné (persistance douce par onglet)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DEPARTMENT_STORAGE_KEY);
      if (saved) setSelectedDepartmentIdState(saved);
    } catch {
      /* sessionStorage indisponible */
    }
  }, []);

  const load = useCallback(async () => {
    if (!isNational) return;
    try {
      const res = await apiClient.get('/federis/patronat/delegations', { timeout: 15000 });
      if (res.data?.isNational && Array.isArray(res.data.departments)) {
        setDepartments(res.data.departments);
      }
    } catch {
      // Départements indisponibles — la barre reste utilisable sans statut
    }
  }, [isNational]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSelectedDepartmentId = useCallback((id: string | null) => {
    setSelectedDepartmentIdState(id);
    try {
      if (id) sessionStorage.setItem(DEPARTMENT_STORAGE_KEY, id);
      else sessionStorage.removeItem(DEPARTMENT_STORAGE_KEY);
    } catch {
      /* sessionStorage indisponible */
    }
  }, []);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.patronatId === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId],
  );

  const canWrite = useMemo(() => {
    if (!isNational) return true;
    // National : écriture uniquement si UN département est sélectionné ET
    // que son coordonnateur a délégué ses droits au compte connecté.
    return !!selectedDepartment?.canWrite;
  }, [isNational, selectedDepartment]);

  const readOnlyLabel = useMemo(() => {
    if (!isNational) return null;
    if (!selectedDepartmentId) {
      return 'Vue agrégée de tous les départements — lecture seule';
    }
    if (!selectedDepartment?.canWrite) {
      return `Lecture seule — ${selectedDepartment?.territoryName ?? selectedDepartment?.name ?? 'ce département'} ne vous a pas délégué de droits`;
    }
    return `Modification autorisée — délégué par ${selectedDepartment.grantedByName ?? 'le coordonnateur départemental'}`;
  }, [isNational, selectedDepartmentId, selectedDepartment]);

  const value = useMemo<FederisScopeContextValue>(
    () => ({
      isNational,
      departments,
      selectedDepartmentId,
      setSelectedDepartmentId,
      canWrite,
      readOnlyLabel,
      refresh: load,
    }),
    [isNational, departments, selectedDepartmentId, setSelectedDepartmentId, canWrite, readOnlyLabel, load],
  );

  return <FederisScopeContext.Provider value={value}>{children}</FederisScopeContext.Provider>;
}

export function useFederisScope() {
  return useContext(FederisScopeContext);
}
