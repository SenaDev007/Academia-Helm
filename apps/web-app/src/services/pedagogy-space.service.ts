/**
 * ============================================================================
 * PEDAGOGY SPACE SERVICE — Client frontend pour /api/pedagogy-space/*
 * ============================================================================
 *
 * Couche de transport pour les endpoints pedagogy-space du BFF.
 * Utilisé par les hooks React Query (lib/query/pedagogy-hooks.ts).
 * ============================================================================
 */

import apiClient from '@/lib/api/client';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export const pedagogySpaceService = {
  // ─── Director : Dashboard ────────────────────────────────────────────────
  async getDirectorPedagogyDashboard(academicYearId: string) {
    const res = await apiClient.get('/pedagogy-space/director/pedagogy-dashboard', {
      params: { academicYearId },
    });
    return res.data;
  },

  // ─── Director : Pending lists ────────────────────────────────────────────
  // statusFilter : 'SUBMITTED' (default) | 'VALIDATED' | 'REJECTED' | 'ALL'
  async getPendingCahierJournals(academicYearId: string, statusFilter?: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL') {
    const res = await apiClient.get('/pedagogy-space/director/pending-cahier-journals', {
      params: { academicYearId, status: statusFilter },
    });
    return res.data;
  },

  async getPendingPedagogicalFiches(academicYearId: string, statusFilter?: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL') {
    const res = await apiClient.get('/pedagogy-space/director/pending-fiches', {
      params: { academicYearId, status: statusFilter },
    });
    return res.data;
  },

  async getPendingAttendanceRegisters(academicYearId: string, statusFilter?: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL') {
    const res = await apiClient.get('/pedagogy-space/director/pending-registers', {
      params: { academicYearId, status: statusFilter },
    });
    return res.data;
  },

  async getPendingMonthlyEvaluations(academicYearId: string, statusFilter?: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL') {
    const res = await apiClient.get('/pedagogy-space/director/pending-evaluations', {
      params: { academicYearId, status: statusFilter },
    });
    return res.data;
  },

  async getPendingCahierTextes(academicYearId: string) {
    const res = await apiClient.get('/pedagogy-space/director/pending-cahier-textes', {
      params: { academicYearId },
    });
    return res.data;
  },

  // ─── Director : Validate mutations ───────────────────────────────────────
  async validateCahierJournal(id: string, body: { action: string; validatedBy: string; rejectionReason?: string }) {
    const res = await apiClient.post(`/pedagogy-space/director/validate-cahier-journal/${id}`, body);
    return res.data;
  },

  async validatePedagogicalFiche(id: string, body: { action: string; validatedBy: string; rejectionReason?: string }) {
    const res = await apiClient.post(`/pedagogy-space/director/validate-fiche/${id}`, body);
    return res.data;
  },

  async validateAttendanceRegister(id: string, body: { action: string; validatedBy: string; rejectionReason?: string }) {
    const res = await apiClient.post(`/pedagogy-space/director/validate-attendance-register/${id}`, body);
    return res.data;
  },

  async validateMonthlyEvaluation(id: string, body: { action: string; validatedBy: string; rejectionReason?: string }) {
    const res = await apiClient.post(`/pedagogy-space/director/validate-evaluation/${id}`, body);
    return res.data;
  },

  async validateCahierTexte(id: string, body: { action: string; validatedBy: string; rejectionReason?: string }) {
    const res = await apiClient.post(`/pedagogy-space/director/validate-cahier-texte/${id}`, body);
    return res.data;
  },

  // ─── Director : Detail views ─────────────────────────────────────────────
  async getCahierJournalDetail(id: string) {
    const res = await apiClient.get(`/pedagogy-space/director/cahier-journal/${id}`);
    return res.data;
  },

  async getPedagogicalFicheDetail(id: string) {
    const res = await apiClient.get(`/pedagogy-space/director/fiches/${id}`);
    return res.data;
  },

  async getAttendanceRegisterDetail(id: string) {
    const res = await apiClient.get(`/pedagogy-space/director/attendance-register/${id}`);
    return res.data;
  },

  async getMonthlyEvaluationDetail(id: string) {
    const res = await apiClient.get(`/pedagogy-space/director/evaluation/${id}`);
    return res.data;
  },

  async getCahierTexteDetail(id: string) {
    const res = await apiClient.get(`/pedagogy-space/director/cahier-texte/${id}`);
    return res.data;
  },

  // ─── Teacher : My classes ─────────────────────────────────────────────────
  async getMyClasses(teacherId: string, academicYearId: string) {
    const res = await apiClient.get('/pedagogy-space/my-classes', {
      params: { teacherId, academicYearId },
    });
    return res.data;
  },

  // ─── Teacher : Attendance register (create-or-load) ──────────────────────
  async upsertAttendanceRegister(body: {
    academicYearId: string;
    teacherId: string;
    classId: string;
    month: number;
    year: number;
  }) {
    const res = await apiClient.post('/pedagogy-space/attendance-registers', body);
    return res.data;
  },

  async updateAttendanceRegister(id: string, body: any) {
    const res = await apiClient.put(`/pedagogy-space/attendance-registers/${id}`, body);
    return res.data;
  },

  async submitAttendanceRegister(id: string) {
    const res = await apiClient.put(`/pedagogy-space/attendance-registers/${id}`, {
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    });
    return res.data;
  },

  async exportAttendanceRegister(id: string, format: 'pdf' | 'xlsx') {
    const res = await apiClient.get(`/pedagogy-space/attendance-registers/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return res.data;
  },

  // ─── Teacher : Monthly evaluation ─────────────────────────────────────────
  async upsertMonthlyEvaluation(body: {
    academicYearId: string;
    classId: string;
    attendanceRegisterId: string;
    month: number;
    year: number;
  }) {
    const res = await apiClient.post('/pedagogy-space/monthly-evaluations', body);
    return res.data;
  },

  async submitMonthlyEvaluation(id: string) {
    const res = await apiClient.post(`/pedagogy-space/monthly-evaluations/${id}/submit`);
    return res.data;
  },

  async updateMonthlyEvaluation(id: string, body: any) {
    const res = await apiClient.put(`/pedagogy-space/monthly-evaluations/${id}`, body);
    return res.data;
  },

  async saveEvaluationSubjects(id: string, body: any) {
    const res = await apiClient.put(`/pedagogy-space/monthly-evaluations/${id}/subjects`, body);
    return res.data;
  },

  // ─── Teacher : Monthly summary ────────────────────────────────────────────
  async getMonthlySummary(academicYearId: string, classId: string) {
    const res = await apiClient.get('/pedagogy-space/monthly-summaries', {
      params: { academicYearId, classId },
    });
    return res.data;
  },

  async refreshMonthlySummary(body: { academicYearId: string; classId: string }) {
    const res = await apiClient.post('/pedagogy-space/monthly-summaries/refresh', body);
    return res.data;
  },

  // ─── Teacher : Available subjects ─────────────────────────────────────────
  async getAvailableSubjects(academicYearId: string, classId: string, teacherId: string) {
    const res = await apiClient.get('/pedagogy-space/subjects/available', {
      params: { academicYearId, classId, teacherId },
    });
    return res.data;
  },
};
