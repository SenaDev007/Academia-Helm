/**
 * ============================================================================
 * INSTITUTIONAL EXAMS SERVICE - FRONTEND
 * ============================================================================
 */

import apiClient from '@/lib/api/client';

export const institutionalExamsService = {
  /**
   * Dashboard KPI
   */
  async getDashboardKpi(schoolLevelId: string, academicYearId: string) {
    const response = await apiClient.get(`/api/institutional-exams/dashboard/kpi`, {
      params: { schoolLevelId, academicYearId }
    });
    return response.data;
  },

  /**
   * Completion by class
   */
  async getCompletionByClass(schoolLevelId: string, academicYearId: string) {
    const response = await apiClient.get(`/api/institutional-exams/dashboard/completion-by-class`, {
      params: { schoolLevelId, academicYearId }
    });
    return response.data;
  },

  /**
   * Delay alerts
   */
  async getAlerts(schoolLevelId: string, academicYearId: string) {
    const response = await apiClient.get(`/api/institutional-exams/dashboard/alerts`, {
      params: { schoolLevelId, academicYearId }
    });
    return response.data;
  },

  /**
   * EVALUATIONS
   */
  async getEvaluations(params: any) {
    const response = await apiClient.get(`/api/institutional-exams/evaluations`, { params });
    return response.data;
  },

  async createEvaluation(data: any) {
    const response = await apiClient.post(`/api/institutional-exams/evaluations`, data);
    return response.data;
  },

  async submitEvaluation(id: string) {
    const response = await apiClient.patch(`/api/institutional-exams/evaluations/${id}/submit`);
    return response.data;
  },

  /**
   * GRADES
   */
  async getGradingSheet(evaluationId: string) {
    const response = await apiClient.get(`/api/institutional-exams/grades/evaluation/${evaluationId}`);
    return response.data;
  },

  async saveGrades(evaluationId: string, grades: any[]) {
    const response = await apiClient.post(`/api/institutional-exams/grades/evaluation/${evaluationId}/bulk`, grades);
    return response.data;
  },

  /**
   * VALIDATIONS
   */
  async getPendingValidations(schoolLevelId: string, academicYearId: string) {
    const response = await apiClient.get(`/api/institutional-exams/validation/pending`, {
      params: { schoolLevelId, academicYearId }
    });
    return response.data;
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
   * BULLETINS
   */
  async getClassBulletins(classId: string, periodId: string) {
    const response = await apiClient.get(`/api/institutional-exams/bulletins/class/${classId}`, {
      params: { periodId }
    });
    return response.data;
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
   * CONFIGURATION
   */
  async getEvaluationTypes() {
    const response = await apiClient.get(`/api/institutional-exams/config/evaluation-types`);
    return response.data;
  },

  async createEvaluationType(data: any) {
    const response = await apiClient.post(`/api/institutional-exams/config/evaluation-types`, data);
    return response.data;
  },

  async getGradeScales() {
    const response = await apiClient.get(`/api/institutional-exams/config/grade-scales`);
    return response.data;
  },

  async createGradeScale(data: any) {
    const response = await apiClient.post(`/api/institutional-exams/config/grade-scales`, data);
    return response.data;
  },

  /**
   * CONSEILS DE CLASSE
   */
  async getCouncils(periodId: string) {
    const response = await apiClient.get(`/api/institutional-exams/councils`, { params: { periodId } });
    return response.data;
  },

  async createCouncil(data: any) {
    const response = await apiClient.post(`/api/institutional-exams/councils`, data);
    return response.data;
  },

  async saveCouncilDecision(councilId: string, studentId: string, data: any) {
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
   * AUDIT ACADÉMIQUE
   */
  async getAuditLogs(filters: any) {
    const response = await apiClient.get(`/api/institutional-exams/audit/logs`, { params: filters });
    return response.data;
  },

  async getOrionInsights(schoolLevelId: string, academicYearId: string) {
    const response = await apiClient.get(`/api/institutional-exams/dashboard/orion-insights?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`);
    return response.data;
  }
};
