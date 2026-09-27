/**
 * useFederisExams — Hook partagé des pages workflow examens (Academia Federis)
 *
 * Charge la liste des examens nationaux du patronat (année scolaire active)
 * et gère la sélection courante (paramètre ?exam= pour les liens croisés
 * Examens → Centres → Candidats).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

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
}

export function useFederisExams() {
  const searchParams = useSearchParams();
  const [exams, setExams] = useState<FederisExam[]>([]);
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);

  // Sélection initiale : ?exam= puis premier examen de la liste
  useEffect(() => {
    if (examId) return;
    const fromUrl = searchParams?.get('exam');
    if (fromUrl) {
      setExamId(fromUrl);
    } else if (exams.length > 0) {
      setExamId(exams[0].id);
    }
  }, [searchParams, exams, examId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/exams', { timeout: 20000 });
      setExams(res.data?.exams ?? []);
      setAcademicYear(res.data?.academicYear?.label ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les examens.');
    } finally {
      setLoading(false);
    }
  }, []);

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
  CANCELLED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export const EXAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  REGISTRATION_OPEN: 'Inscriptions ouvertes',
  REGISTRATION_CLOSED: 'Inscriptions closes',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  ARCHIVED: 'Archivé',
};
