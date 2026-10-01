/**
 * useFederisExams — Hook partagé des pages workflow examens (Academia Federis)
 *
 * Charge la liste des examens nationaux du patronat (année scolaire active)
 * et gère la sélection courante (paramètre ?exam= pour les liens croisés
 * Examens → Centres → Candidats).
 *
 * ⭐ T45 — Sélection initiale canonique : l'API renvoie les examens triés par
 * date de début décroissante, si bien que le premier de la liste était souvent
 * le baccalauréat — les modules Délibération, Notes & Moyennes et Candidats
 * s'ouvraient donc sur l'onglet « Baccalauréat » au lieu du PREMIER onglet.
 * La sélection par défaut honore désormais l'ordre canonique des types
 * (CEP → BEPC → BAC → CAP, celui des barres d'onglets) : le premier examen
 * du premier type disponible (typiquement le CEP) est sélectionné d'office.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
// ⭐ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (département sélectionné)
import { useFederisScope } from '@/lib/federis/scope-context';

export interface FederisExamDepartment {
  name: string;
  territoryName: string | null;
}

export interface FederisExam {
  id: string;
  code: string;
  name: string;
  examType: string;
  level: string;
  status: string;
  startDate: string;
  endDate: string;
  centersCount: number;
  candidatesCount: number;
  /** ⭐ Département propriétaire de la campagne (vue agrégée nationale). */
  department?: FederisExamDepartment | null;
}

/** ⭐ T45 — Ordre canonique des types d'examen (celui des barres d'onglets).
 *  La sélection par défaut s'ouvre sur le PREMIER type disponible (CEP). */
const EXAM_TYPE_ORDER = ['CEP', 'BEPC', 'BAC', 'CAP'] as const;

export function useFederisExams() {
  const searchParams = useSearchParams();
  const { selectedDepartmentId } = useFederisScope();
  const [exams, setExams] = useState<FederisExam[]>([]);
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);

  // ⭐ T45 — Sélection initiale : ?exam= puis premier examen du PREMIER type
  // canonique disponible (CEP → BEPC → BAC → CAP) — plus exams[0] (tri
  // chronologique descendant = baccalauréat par défaut).
  // ⭐ 2026-10-01 — Changement de département (national) : la sélection est
  // réinitialisée — les examens du périmètre précédent ne sont plus valides.
  useEffect(() => {
    setExamId(null);
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (examId) return;
    const fromUrl = searchParams?.get('exam');
    if (fromUrl) {
      setExamId(fromUrl);
    } else if (exams.length > 0) {
      const firstCanonical = EXAM_TYPE_ORDER.map((t) =>
        exams.find((e) => (e.examType ?? 'CEP') === t),
      ).find(Boolean);
      setExamId((firstCanonical ?? exams[0]).id);
    }
  }, [searchParams, exams, examId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ⭐ AGRÉGATION NATIONALE : departmentId restreint la vue à UN
      //    département du réseau (sélecteur de la barre de périmètre).
      const res = await apiClient.get('/federis/exams', {
        timeout: 20000,
        params: selectedDepartmentId ? { departmentId: selectedDepartmentId } : undefined,
      });
      setExams(res.data?.exams ?? []);
      setAcademicYear(res.data?.academicYear?.label ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les examens.');
    } finally {
      setLoading(false);
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    exams,
    academicYear,
    loading,
    error,
    examId,
    setExamId,
    reload: load,
    selectedExam: exams.find((e) => e.id === examId) ?? null,
  };
}

/** Badge de statut d'examen (partagé Examens / Centres / Candidats). */
export const EXAM_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  REGISTRATION_OPEN: 'bg-blue-100 text-blue-800',
  REGISTRATION_CLOSED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-purple-100 text-purple-800',
  RESULTS_PUBLISHED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export const EXAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  REGISTRATION_OPEN: 'Inscriptions ouvertes',
  REGISTRATION_CLOSED: 'Inscriptions closes',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  RESULTS_PUBLISHED: 'Résultats publiés',
  CANCELLED: 'Annulé',
  ARCHIVED: 'Archivé',
};
