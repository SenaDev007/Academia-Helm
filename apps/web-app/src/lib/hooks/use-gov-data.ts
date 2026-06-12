/**
 * ============================================================================
 * USE GOV DATA — HOOK DE RÉCUPÉRATION DES DONNÉES GOUVERNEMENTALES
 * ============================================================================
 *
 * Hook React qui récupère les données depuis notre API /api/public/gov-data
 * et les transforme pour être compatibles avec le composant BeninMap.
 *
 * Stratégie :
 *   1. Récupère les données depuis notre API proxy
 *   2. Transforme le format gouvernemental → DepartmentData
 *   3. Merge avec les données statiques (fallback + infos géographiques)
 *   4. Retourne les données prêtes à l'emploi
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BENIN_DEPARTMENTS,
  type DepartmentData,
  type CircumscriptionData,
  type SecondaireData,
} from '@/data/benin-departments';

/* ── Types pour la réponse API ──────────────────────────────────────── */

interface GovKpiNationaux {
  apprenants: number;
  enseignants: number;
  etablissements: number;
  pct_filles: number;
}

interface GovCirconscription {
  id: number;
  nom: string;
  slug: string;
  etablissements: number;
  apprenants: number;
  enseignants: number;
  pct_filles: number;
}

interface GovEtablissements {
  total: number;
  public: number;
  prive: number;
}

interface GovApprenants {
  total: number;
  public: number;
  prive: number;
}

interface GovEnseignants {
  total: number;
  public: number;
  prive: number;
}

interface GovDepartment {
  nom: string;
  code: string;
  dep_id: number;
  etablissements: GovEtablissements;
  apprenants: GovApprenants;
  enseignants: GovEnseignants;
  pct_filles: number;
  circonscriptions?: GovCirconscription[];
}

interface PrimaireData {
  disponible: boolean;
  annee: string;
  generated_at: string;
  source: string;
  kpi_nationaux: GovKpiNationaux;
  par_departement: GovDepartment[];
}

interface SecondaireMeta {
  year: string;
  academic_year: string;
  generated_at: string;
  version: string;
}

interface SecondaireGovData {
  disponible: boolean;
  meta: SecondaireMeta;
  kpi_nationaux: GovKpiNationaux;
  par_departement: GovDepartment[];
}

interface GovDataResponse {
  source: string;
  fetchedAt: string;
  primaireGeneratedAt: string | null;
  secondaireGeneratedAt: string | null;
  primaire: PrimaireData | null;
  secondaire: SecondaireGovData | null;
  warning?: string;
}

/* ── Mapping nom gouvernemental → code interne ─────────────────────── */

const DEPT_NAME_TO_CODE: Record<string, string> = {
  ALIBORI: 'AL',
  ATACORA: 'AT',
  ATLANTIQUE: 'AQ',
  BORGOU: 'BO',
  COLLINES: 'CO',
  DONGA: 'DO',
  COUFFO: 'KO',
  KOUFFO: 'KO',
  LITTORAL: 'LI',
  MONO: 'MO',
  OUÉMÉ: 'OU',
  OUEME: 'OU',
  PLATEAU: 'PL',
  ZOU: 'ZO',
};

/* ── Résultat du hook ──────────────────────────────────────────────── */

export interface GovDataResult {
  /** Départements avec données fusionnées (gouvernementales + statiques) */
  departments: DepartmentData[];
  /** Totaux nationaux primaire */
  primaireTotals: {
    schools: number;
    teachers: number;
    students: number;
    publicCount: number;
    privateCount: number;
  };
  /** Totaux nationaux secondaire */
  secondaireTotals: {
    schools: number;
    teachers: number;
    students: number;
    publicCount: number;
    privateCount: number;
  };
  /** Les données sont-elles live (API) ou fallback (statiques) ? */
  isLive: boolean;
  /** Date de génération des données gouvernementales */
  primaireGeneratedAt: string | null;
  secondaireGeneratedAt: string | null;
  /** Année académique */
  academicYear: string | null;
  /** État du chargement */
  isLoading: boolean;
  /** Message d'avertissement éventuel */
  warning: string | null;
}

/* ── Hook ───────────────────────────────────────────────────────────── */

export function useGovData(): GovDataResult {
  const [govResponse, setGovResponse] = useState<GovDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchGovData() {
      try {
        const response = await fetch('/api/public/gov-data');
        if (response.ok && !cancelled) {
          const data: GovDataResponse = await response.json();
          setGovResponse(data);
        }
      } catch {
        // Silently fallback to static data
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGovData();

    // Rafraîchir toutes les 6 heures
    const interval = setInterval(fetchGovData, 6 * 60 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    const primaire = govResponse?.primaire ?? null;
    const secondaire = govResponse?.secondaire ?? null;
    const isLive = govResponse?.source === 'live';
    const warning = govResponse?.warning ?? null;

    // Construire les maps gouvernementales par code département
    const primaireByCode = new Map<string, GovDepartment>();
    const secondaireByCode = new Map<string, GovDepartment>();

    if (primaire?.par_departement) {
      for (const dept of primaire.par_departement) {
        const code = DEPT_NAME_TO_CODE[dept.nom.toUpperCase()] ?? dept.code?.toUpperCase()?.slice(0, 2);
        if (code) primaireByCode.set(code, dept);
      }
    }

    if (secondaire?.par_departement) {
      for (const dept of secondaire.par_departement) {
        const code = DEPT_NAME_TO_CODE[dept.nom.toUpperCase()] ?? dept.code?.toUpperCase()?.slice(0, 2);
        if (code) secondaireByCode.set(code, dept);
      }
    }

    // Fusionner : données statiques (structure géographique) + données gouvernementales (stats live)
    const mergedDepartments = BENIN_DEPARTMENTS.map((staticDept): DepartmentData => {
      const govPrimaire = primaireByCode.get(staticDept.code);
      const govSecondaire = secondaireByCode.get(staticDept.code);

      // Primaire : utiliser les données gov si disponibles, sinon statiques
      const schoolCount = govPrimaire?.etablissements?.total ?? staticDept.schoolCount;
      const teacherCount = govPrimaire?.enseignants?.total ?? staticDept.teacherCount;
      const studentCount = govPrimaire?.apprenants?.total ?? staticDept.studentCount;
      const femalePercent = govPrimaire?.pct_filles ?? staticDept.femalePercent;
      const publicCount = govPrimaire?.etablissements?.public ?? staticDept.publicCount;
      const privateCount = govPrimaire?.etablissements?.prive ?? staticDept.privateCount;

      // Circonscriptions : utiliser les données gov si disponibles
      let circumscriptions = staticDept.circumscriptions;
      if (govPrimaire?.circonscriptions && govPrimaire.circonscriptions.length > 0) {
        circumscriptions = govPrimaire.circonscriptions.map((circ): CircumscriptionData => ({
          name: circ.nom,
          schoolCount: circ.etablissements,
          studentCount: circ.apprenants,
          teacherCount: circ.enseignants,
          femalePercent: circ.pct_filles,
        }));
      }

      // Secondaire : utiliser les données gov si disponibles
      let secondaireData: SecondaireData = staticDept.secondaire;
      if (govSecondaire) {
        secondaireData = {
          schoolCount: govSecondaire.etablissements?.total ?? staticDept.secondaire.schoolCount,
          studentCount: govSecondaire.apprenants?.total ?? staticDept.secondaire.studentCount,
          teacherCount: govSecondaire.enseignants?.total ?? staticDept.secondaire.teacherCount,
          femalePercent: govSecondaire.pct_filles ?? staticDept.secondaire.femalePercent,
          publicCount: govSecondaire.etablissements?.public ?? staticDept.secondaire.publicCount,
          privateCount: govSecondaire.etablissements?.prive ?? staticDept.secondaire.privateCount,
        };
      }

      return {
        ...staticDept,
        schoolCount,
        teacherCount,
        studentCount,
        femalePercent,
        publicCount,
        privateCount,
        circumscriptions,
        secondaire: secondaireData,
      };
    });

    // Totaux nationaux
    const primaireTotals = primaire?.kpi_nationaux
      ? {
          schools: primaire.kpi_nationaux.etablissements,
          teachers: primaire.kpi_nationaux.enseignants,
          students: primaire.kpi_nationaux.apprenants,
          publicCount: mergedDepartments.reduce((s, d) => s + d.publicCount, 0),
          privateCount: mergedDepartments.reduce((s, d) => s + d.privateCount, 0),
        }
      : {
          schools: BENIN_DEPARTMENTS.reduce((s, d) => s + d.schoolCount, 0),
          teachers: BENIN_DEPARTMENTS.reduce((s, d) => s + d.teacherCount, 0),
          students: BENIN_DEPARTMENTS.reduce((s, d) => s + d.studentCount, 0),
          publicCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.publicCount, 0),
          privateCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.privateCount, 0),
        };

    const secondaireTotals = secondaire?.kpi_nationaux
      ? {
          schools: secondaire.kpi_nationaux.etablissements,
          teachers: secondaire.kpi_nationaux.enseignants,
          students: secondaire.kpi_nationaux.apprenants,
          publicCount: mergedDepartments.reduce((s, d) => s + d.secondaire.publicCount, 0),
          privateCount: mergedDepartments.reduce((s, d) => s + d.secondaire.privateCount, 0),
        }
      : {
          schools: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.schoolCount, 0),
          teachers: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.teacherCount, 0),
          students: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.studentCount, 0),
          publicCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.publicCount, 0),
          privateCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.privateCount, 0),
        };

    return {
      departments: mergedDepartments,
      primaireTotals,
      secondaireTotals,
      isLive,
      primaireGeneratedAt: govResponse?.primaireGeneratedAt ?? null,
      secondaireGeneratedAt: govResponse?.secondaireGeneratedAt ?? null,
      academicYear: primaire?.annee ?? secondaire?.meta?.academic_year ?? null,
      isLoading,
      warning,
    };
  }, [govResponse, isLoading]);
}
