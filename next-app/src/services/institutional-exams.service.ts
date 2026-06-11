/**
 * ============================================================================
 * INSTITUTIONAL EXAMS SERVICE - FRONTEND (Offline-First)
 * ============================================================================
 */

import apiClient from '@/lib/api/client';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { LocalSearchService } from '@/lib/offline/local-search.service';
import { createEntityOffline, updateEntityOffline } from '@/lib/offline/offline-business.service';

function getTenantId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : "";
}

export const institutionalExamsService = {
  /**
   * Dashboard KPI — avec fallback offline
   */
  async getDashboardKpi(schoolLevelId: string, academicYearId: string) {
    if (!networkDetectionService.isConnected()) {
      // Retourner un objet vide plutôt que de crasher
      return { totalEvaluations: 0, completed: 0, pending: 0, averageScore: 0 };
    }
    try {
      const response = await apiClient.get(`/api/institutional-exams/dashboard/kpi`, {
        params: { schoolLevelId, academicYearId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return { totalEvaluations: 0, completed: 0, pending: 0, averageScore: 0 };
      throw error;
    }
  },

  /**
   * Completion by class — avec fallback offline
   */
  async getCompletionByClass(schoolLevelId: string, academicYearId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/dashboard/completion-by-class`, {
        params: { schoolLevelId, academicYearId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  /**
   * Delay alerts — avec fallback offline
   */
  async getAlerts(schoolLevelId: string, academicYearId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/dashboard/alerts`, {
        params: { schoolLevelId, academicYearId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  /**
   * EVALUATIONS — avec fallback offline
   */
  async getEvaluations(params: any) {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("exams", { tenantId: getTenantId(), filters: params });
    }
    try {
      const response = await apiClient.get(`/api/institutional-exams/evaluations`, { params });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return LocalSearchService.search("exams", { tenantId: getTenantId(), filters: params });
      throw error;
    }
  },

  async createEvaluation(data: any) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return createEntityOffline(tenantId, 'EXAM', data);
    }
    const response = await apiClient.post(`/api/institutional-exams/evaluations`, data);
    return response.data;
  },

  async submitEvaluation(id: string) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return updateEntityOffline(tenantId, 'EXAM', id, { status: 'SUBMITTED' });
    }
    const response = await apiClient.patch(`/api/institutional-exams/evaluations/${id}/submit`);
    return response.data;
  },

  /**
   * GRADES — avec fallback offline
   */
  async getGradingSheet(evaluationId: string) {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("grades", { tenantId: getTenantId(), filters: { evaluationId } });
    }
    try {
      const response = await apiClient.get(`/api/institutional-exams/grades/evaluation/${evaluationId}`);
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return LocalSearchService.search("grades", { tenantId: getTenantId(), filters: { evaluationId } });
      throw error;
    }
  },

  async saveGrades(evaluationId: string, grades: any[]) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      // Sauvegarder chaque note localement
      for (const grade of grades) {
        await createEntityOffline(tenantId, 'GRADE', { ...grade, evaluationId });
      }
      return { saved: grades.length };
    }
    const response = await apiClient.post(`/api/institutional-exams/grades/evaluation/${evaluationId}/bulk`, grades);
    return response.data;
  },

  /**
   * VALIDATIONS — nécessite le serveur (actions officielles)
   */
  async getPendingValidations(schoolLevelId: string, academicYearId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/validation/pending`, {
        params: { schoolLevelId, academicYearId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async approveBatch(batchId: string, comment?: string) {
    const response = await apiClient.patch(`/api/institutional-exams/validation/batch/${batchId}/approve`, { comment });
    return response.data;
  },

  async rejectBatch(batchId: string, comment: string) {
    const response = await apiClient.patch(`/api/institutional-exams/validation/batch/${batchId}/reject`, { comment });
    return response.data;
  },

  /**
   * BULLETINS — nécessite le serveur (documents officiels)
   */
  async getClassBulletins(classId: string, periodId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/bulletins/class/${classId}`, {
        params: { periodId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async generateBulletins(classId: string, periodId: string) {
    const response = await apiClient.post(`/api/institutional-exams/bulletins/class/${classId}/generate`, { periodId });
    return response.data;
  },

  async publishBulletins(classId: string, periodId: string) {
    const response = await apiClient.patch(`/api/institutional-exams/bulletins/class/${classId}/publish`, { periodId });
    return response.data;
  },

  /**
   * CONFIGURATION — avec fallback offline
   */
  async getEvaluationTypes() {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/config/evaluation-types`);
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async createEvaluationType(data: any) {
    const response = await apiClient.post(`/api/institutional-exams/config/evaluation-types`, data);
    return response.data;
  },

  async getGradeScales() {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/config/grade-scales`);
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async createGradeScale(data: any) {
    const response = await apiClient.post(`/api/institutional-exams/config/grade-scales`, data);
    return response.data;
  },

  /**
   * CONSEILS DE CLASSE — avec fallback offline
   */
  async getCouncils(periodId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/councils`, { params: { periodId } });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async createCouncil(data: any) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return createEntityOffline(tenantId, 'EXAM', { ...data, type: 'COUNCIL' });
    }
    const response = await apiClient.post(`/api/institutional-exams/councils`, data);
    return response.data;
  },

  async saveCouncilDecision(councilId: string, studentId: string, data: any) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return createEntityOffline(tenantId, 'EXAM_RESULT', { ...data, councilId, studentId });
    }
    const response = await apiClient.post(`/api/institutional-exams/councils/${councilId}/decisions/${studentId}`, data);
    return response.data;
  },

  async downloadBulletin(studentId: string, periodId: string) {
    const response = await apiClient.get(`/api/institutional-exams/bulletins/download/${studentId}`, {
      params: { periodId },
      responseType: 'blob'
    });
    
    // Créer un lien pour télécharger le fichier
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bulletin_${studentId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  /**
   * AUDIT ACADÉMIQUE — nécessite le serveur
   */
  async getAuditLogs(filters: any) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/api/institutional-exams/audit/logs`, { params: filters });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async getOrionInsights(schoolLevelId: string, academicYearId: string) {
    if (!networkDetectionService.isConnected()) return null;
    try {
      const response = await apiClient.get(`/api/institutional-exams/dashboard/orion-insights?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`);
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return null;
      throw error;
    }
  }
};
