/**
 * ============================================================================
 * USE RISK SCORE — Hook React Query pour le score de risque
 * ============================================================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface StudentRiskScore {
  id: string;
  tenantId: string;
  academicYearId: string;
  quarterId: string;
  studentId: string;
  studentName: string;
  studentMatricule: string;
  className: string;
  classId?: string;
  conductScore: number;
  pedagogyScore: number;
  attendanceScore: number;
  totalScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  dropoutRiskFlag: boolean;
  sourceData?: any;
  previousQuarterScore?: number;
  scoreDelta?: number;
  calculatedAt: string;
}

export interface RiskScoreDashboard {
  total: number;
  byLevel: {
    LOW: number;
    MODERATE: number;
    HIGH: number;
    CRITICAL: number;
  };
  dropoutCount: number;
  averages: {
    total: number;
    conduct: number;
    pedagogy: number;
    attendance: number;
  };
  calculatedAt: string;
}

export interface RiskScoreSettings {
  conductWeight: number;
  pedagogyWeight: number;
  attendanceWeight: number;
  lowThreshold: number;
  moderateThreshold: number;
  highThreshold: number;
  dropoutScoreDeltaThreshold: number;
  dropoutAbsenceRateThreshold: number;
  dropoutConductDropThreshold: number;
  pedagogyReferenceAverage: number;
  isEnabled: boolean;
}

interface UseRiskScoreStudentsOptions {
  tenantId?: string;
  academicYearId?: string;
  quarterId?: string;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  classId?: string;
  dropoutOnly?: boolean;
  enabled?: boolean;
}

export function useRiskScoreStudents(options: UseRiskScoreStudentsOptions = {}) {
  const {
    tenantId, academicYearId, quarterId, riskLevel, classId, dropoutOnly, enabled = true,
  } = options;

  const query = useQuery<StudentRiskScore[]>({
    queryKey: ['risk-score-students', tenantId, academicYearId, quarterId, riskLevel, classId, dropoutOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (quarterId) params.set('quarterId', quarterId);
      if (riskLevel) params.set('riskLevel', riskLevel);
      if (classId) params.set('classId', classId);
      if (dropoutOnly) params.set('dropoutOnly', 'true');

      const res = await fetch(`/api/risk-score/students?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    enabled: !!tenantId && !!academicYearId && !!quarterId && enabled,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });

  return {
    scores: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRiskScoreDashboard(options: { tenantId?: string; academicYearId?: string; quarterId?: string; enabled?: boolean } = {}) {
  const { tenantId, academicYearId, quarterId, enabled = true } = options;

  const query = useQuery<RiskScoreDashboard>({
    queryKey: ['risk-score-dashboard', tenantId, academicYearId, quarterId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (quarterId) params.set('quarterId', quarterId);

      const res = await fetch(`/api/risk-score/dashboard?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!tenantId && !!academicYearId && !!quarterId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    dashboard: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRiskScoreSettings(tenantId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery<RiskScoreSettings>({
    queryKey: ['risk-score-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('tenantId required');
      const res = await fetch(`/api/risk-score/settings?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<RiskScoreSettings>) => {
      const res = await fetch(`/api/risk-score/settings?tenantId=${encodeURIComponent(tenantId!)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-score-settings', tenantId] });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export function useRecalculateRiskScores() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: { tenantId: string; academicYearId: string; quarterId: string }) => {
      const { tenantId, ...body } = params;
      const res = await fetch(`/api/risk-score/recalculate?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-score-students'] });
      queryClient.invalidateQueries({ queryKey: ['risk-score-dashboard'] });
    },
  });

  return {
    recalculate: mutation.mutateAsync,
    isRecalculating: mutation.isPending,
    result: mutation.data,
  };
}

// ─── DROPOUT INDICATOR ──────────────────────────────────────────────────

export interface DropoutStudent {
  id: string;
  studentId: string;
  studentName: string;
  studentMatricule: string;
  className: string;
  classId?: string;
  totalScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  scoreDelta?: number;
  previousQuarterScore?: number;
  sourceData?: any;
  dropoutReasons: string[];
  calculatedAt: string;
}

export interface DropoutStats {
  totalStudents: number;
  dropoutCount: number;
  dropoutRate: number;
  bySeverity: { HIGH: number; CRITICAL: number };
  avgScoreDelta: number;
  worstScoreDelta: number;
}

export interface DropoutTrend {
  quarterId: string;
  quarterName: string;
  quarterNumber: number;
  totalStudents: number;
  dropoutCount: number;
  dropoutRate: number;
  averages: { total: number; conduct: number; pedagogy: number; attendance: number };
}

export function useDropoutStudents(options: {
  tenantId?: string;
  academicYearId?: string;
  quarterId?: string;
  classId?: string;
  enabled?: boolean;
}) {
  const { tenantId, academicYearId, quarterId, classId, enabled = true } = options;

  const query = useQuery<DropoutStudent[]>({
    queryKey: ['dropout-students', tenantId, academicYearId, quarterId, classId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (quarterId) params.set('quarterId', quarterId);
      if (classId) params.set('classId', classId);

      const res = await fetch(`/api/risk-score/dropout/students?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    enabled: !!tenantId && !!academicYearId && !!quarterId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    students: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDropoutStats(options: {
  tenantId?: string;
  academicYearId?: string;
  quarterId?: string;
  enabled?: boolean;
}) {
  const { tenantId, academicYearId, quarterId, enabled = true } = options;

  const query = useQuery<DropoutStats>({
    queryKey: ['dropout-stats', tenantId, academicYearId, quarterId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (quarterId) params.set('quarterId', quarterId);

      const res = await fetch(`/api/risk-score/dropout/stats?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!tenantId && !!academicYearId && !!quarterId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDropoutTrends(options: { tenantId?: string; academicYearId?: string; enabled?: boolean }) {
  const { tenantId, academicYearId, enabled = true } = options;

  const query = useQuery<DropoutTrend[]>({
    queryKey: ['dropout-trends', tenantId, academicYearId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);

      const res = await fetch(`/api/risk-score/dropout/trends?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!tenantId && !!academicYearId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    trends: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useRiskScoreStudents;
