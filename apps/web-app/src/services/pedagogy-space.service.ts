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

  // ─── Director : Semainiers (cahier du semainier) ───────────────────────────
  //    Le backend GET /pedagogy-space/seminar-config?academicYearId=X renvoie
  //    TOUTES les configs de l'année (PENDING + SIGNED + SUBMITTED + VALIDATED + REJECTED).
  //    On filtre côté client par statut pour les 3 sous-onglets (en attente / validés / rejetés).
  //    Note : "en attente" = SUBMITTED (envoyé au directeur, en attente de validation direction).
  async getPendingSemainiers(academicYearId: string, statusFilter?: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL') {
    const res = await apiClient.get('/pedagogy-space/seminar-config', {
      params: { academicYearId },
    });
    const all = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    if (!statusFilter || statusFilter === 'ALL') return all;
    return all.filter((c: any) => (c.status || '').toUpperCase() === statusFilter);
  },

  // ⭐ Valider / Rejeter un semainier (direction)
  //    POST /pedagogy-space/seminar-config/:id/validate
  //    Body: { action: 'VALIDATED' | 'REJECTED', directorSignature, validatedBy, rejectionReason? }
  async validateSemainier(id: string, body: {
    action: 'VALIDATED' | 'REJECTED';
    directorSignature?: string;
    validatedBy: string;
    rejectionReason?: string;
  }) {
    const res = await apiClient.post(`/pedagogy-space/seminar-config/${id}/validate`, body);
    return res.data;
  },

  // ⭐ Récupérer les rapports journaliers + hebdo d'un semainier
  //    La config (infos semaine, enseignant, classes, signatures) est déjà
  //    disponible depuis la liste — on n'a donc besoin de fetch QUE les rapports.
  //    Renvoie { dailyReports: [...5 ou moins], weeklyReport: {...} | null }
  async getSemainierReports(configId: string) {
    const dailyReports: any[] = [];
    // Les 5 rapports journaliers (Lun=1, ..., Ven=5) — fetch séquentiel
    // (le backend getOrCreate crée le rapport s'il n'existe pas encore)
    for (let day = 1; day <= 5; day++) {
      try {
        const r = await apiClient.get('/pedagogy-space/seminar-daily-report', {
          params: { configId, dayOfWeek: day },
        });
        if (r.data?.id) dailyReports.push({ dayOfWeek: day, ...r.data });
      } catch { /* rapport non créé — c'est normal */ }
    }

    let weeklyReport: any = null;
    try {
      const r = await apiClient.get('/pedagogy-space/seminar-weekly-report', { params: { configId } });
      if (r.data?.id) weeklyReport = r.data;
    } catch { /* rapport non créé */ }

    return { dailyReports, weeklyReport };
  },

  // ⭐ Export PDF d'un semainier (rapport complet PDF via backend Puppeteer)
  async exportSemainierPdf(id: string): Promise<Blob> {
    const res = await apiClient.get(`/pedagogy-space/seminar-config/${id}/export`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    });
    return res.data;
  },

  // ─── Director : Catalogue (anciennes années) ────────────────────────────────
  //    Le backend n'a pas d'endpoint catalogue spécifique pour les semainiers.
  //    On utilise le même endpoint /seminar-config?academicYearId=X avec un
  //    ancien academicYearId pour récupérer les configs passées.
  //    Le frontend DirectorPedagogyControl gère le sélecteur d'année.
  async getSemainierCatalogue(academicYearId: string) {
    const res = await apiClient.get('/pedagogy-space/seminar-config', {
      params: { academicYearId },
    });
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
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
