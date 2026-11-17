/**
 * ============================================================================
 * INSTITUTIONAL EXAMS SERVICE - FRONTEND (Offline-First)
 * ============================================================================
 */

import apiClient from '@/lib/api/client';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { LocalSearchService } from '@/lib/offline/local-search.service';
import { createEntityOffline, updateEntityOffline } from '@/lib/offline/offline-business.service';
import { cachedGet } from '@/lib/api/get-cache';

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
      const response = await apiClient.get(`/institutional-exams/dashboard/kpi`, {
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
      const response = await apiClient.get(`/institutional-exams/dashboard/completion-by-class`, {
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
      const response = await apiClient.get(`/institutional-exams/dashboard/alerts`, {
        params: { schoolLevelId, academicYearId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  /**
   * ⭐ V1 audit — Statistiques de performance par niveau scolaire
   * (moyenne, taux de réussite, élèves à risque) — onglet Statistiques
   * du module Examens. Remplace l'appel historique /api/exams/dashboard
   * (route BFF inexistante + tables legacy jamais alimentées).
   */
  async getPerformanceByLevel(academicYearId: string, language?: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/institutional-exams/dashboard/performance-by-level`, {
        params: { academicYearId, ...(language ? { language } : {}) },
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  /**
   * EVALUATIONS — avec fallback offline
   * ⭐ FIX PERF (2026-09-21 — « les évaluations mettent plus d'une minute à
   *    charger ») : cache client 45 s + DÉDUPLICATION des requêtes en vol.
   *    Le module Examen recharge la liste à CHAQUE changement d'onglet et au
   *    double montage initial (résolution de availableLevels) → plusieurs
   *    requêtes réseau IDENTIQUES de plusieurs Mo se juxtaposaient sur un
   *    réseau lent (Bénin 300-600 ms RTT), d'où les toasts « délai dépassé ».
   *    Désormais : 1 seule requête en vol, les autres appelants partagent la
   *    même promesse. Toute mutation (création/suppression/validation) via
   *    apiClient invalide automatiquement le cache → fraîcheur garantie
   *    après écriture.
   */
  async getEvaluations(params: any) {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("exams", { tenantId: getTenantId(), filters: params });
    }
    const qs = new URLSearchParams(
      Object.entries(params || {})
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return cachedGet(`GET:/institutional-exams/evaluations?${qs}`, async () => {
      try {
        const response = await apiClient.get(`/institutional-exams/evaluations`, { params });
        return response.data;
      } catch (error: any) {
        if (error.isOffline) return LocalSearchService.search("exams", { tenantId: getTenantId(), filters: params });
        throw error;
      }
    });
  },

  async createEvaluation(data: any) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return createEntityOffline(tenantId, 'EXAM', data);
    }
    const response = await apiClient.post(`/institutional-exams/evaluations`, data);
    return response.data;
  },

  // ⭐ Bulk create : plusieurs évaluations en une fois (1 par classe × matière)
  async createBulkEvaluations(data: {
    classIds: string[];
    subjectIds: string[];
    periodId: string;
    evaluationTypeId: string;
    title?: string;
    description?: string;
    evaluationDate: string;
    maxScore?: number;
    coefficient?: number;
    /**
     * ⭐ FIX 2026-11-17 (« gymnastique » module Examens) : reprendre
     * automatiquement le coefficient de CHAQUE matière défini dans
     * Pédagogie > Matières & Programmes (affectation classe × matière).
     */
    respectSubjectCoefficients?: boolean;
    language?: string;
  }) {
    const response = await apiClient.post(`/institutional-exams/evaluations/bulk`, data);
    return response.data;
  },

  async submitEvaluation(id: string) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return updateEntityOffline(tenantId, 'EXAM', id, { status: 'SUBMITTED' });
    }
    const response = await apiClient.patch(`/institutional-exams/evaluations/${id}/submit`);
    return response.data;
  },

  // ─── Méthodes CRUD complètes (Module Examen — Onglet Évaluations) ───────
  async getEvaluation(id: string) {
    const response = await apiClient.get(`/institutional-exams/evaluations/${id}`);
    return response.data;
  },

  async updateEvaluation(id: string, data: any) {
    const response = await apiClient.patch(`/institutional-exams/evaluations/${id}`, data);
    return response.data;
  },

  async deleteEvaluation(id: string) {
    const response = await apiClient.delete(`/institutional-exams/evaluations/${id}`);
    return response.data;
  },

  async openEvaluation(id: string) {
    const response = await apiClient.post(`/institutional-exams/evaluations/${id}/open`);
    return response.data;
  },

  async validateEvaluation(id: string) {
    const response = await apiClient.patch(`/institutional-exams/evaluations/${id}/validate`);
    return response.data;
  },

  async cancelEvaluation(id: string, reason?: string) {
    const response = await apiClient.post(`/institutional-exams/evaluations/${id}/cancel`, { reason });
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
      const response = await apiClient.get(`/institutional-exams/grades/evaluation/${evaluationId}`);
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return LocalSearchService.search("grades", { tenantId: getTenantId(), filters: { evaluationId } });
      throw error;
    }
  },

  // ⭐ FIX PERF (2026-09-21 — fan-out N+1 sur HTTP) : grilles de notes pour N
  //    évaluations en UN SEUL appel (onglets Validation, Registre des notes,
  //    Récapitulatif, Bulletins). Avant : chaque évaluation déclenchait sa
  //    propre requête HTTP (jusqu'à 30+ requêtes parallèles) → saturation du
  //    navigateur + du Service Worker sur réseau lent → > 1 min de chargement.
  //    Retourne { [evaluationId]: [ {studentId, studentName, score, cm, cp…} ] }.
  //    Chunké (40 ids max par appel) pour rester sous les limites d'URL, avec
  //    cache client 45 s + dédup en vol.
  async getGradingSheetsBatch(evaluationIds: string[]): Promise<Record<string, any[]>> {
    const ids = Array.from(new Set((evaluationIds || []).filter(Boolean)));
    if (ids.length === 0) return {};
    if (!networkDetectionService.isConnected()) {
      // Hors ligne : servir chaque évaluation depuis le cache local
      const out: Record<string, any[]> = {};
      for (const id of ids) {
        out[id] = LocalSearchService.search("grades", { tenantId: getTenantId(), filters: { evaluationId: id } }) as any[];
      }
      return out;
    }
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
    const results = await Promise.all(
      chunks.map((chunk) => {
        const sortedKey = chunk.slice().sort().join(',');
        return cachedGet<Record<string, any[]>>(
          `GET:/institutional-exams/grades/evaluations?${sortedKey}`,
          async () => {
            const response = await apiClient.get(`/institutional-exams/grades/evaluations`, {
              params: { ids: chunk.join(',') },
            });
            return (response.data && typeof response.data === 'object') ? response.data : {};
          },
        );
      }),
    );
    return Object.assign({}, ...results);
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
    const response = await apiClient.post(`/institutional-exams/grades/evaluation/${evaluationId}/bulk`, grades);
    return response.data;
  },

  /**
   * VALIDATIONS — nécessite le serveur (actions officielles)
   */
  async getPendingValidations(schoolLevelId: string, academicYearId: string, language?: 'FR' | 'EN') {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/institutional-exams/validation/pending`, {
        params: { schoolLevelId, academicYearId, ...(language ? { language } : {}) }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async approveBatch(batchId: string, comment?: string) {
    const response = await apiClient.patch(`/institutional-exams/validation/batch/${batchId}/approve`, { comment });
    return response.data;
  },

  async rejectBatch(batchId: string, comment: string) {
    const response = await apiClient.patch(`/institutional-exams/validation/batch/${batchId}/reject`, { comment });
    return response.data;
  },

  /**
   * BULLETINS — nécessite le serveur (documents officiels)
   */
  async getClassBulletins(classId: string, periodId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/institutional-exams/bulletins/class/${classId}`, {
        params: { periodId }
      });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async generateBulletins(classId: string, periodId: string) {
    const response = await apiClient.post(`/institutional-exams/bulletins/class/${classId}/generate`, { periodId });
    return response.data;
  },

  async publishBulletins(classId: string, periodId: string) {
    const response = await apiClient.patch(`/institutional-exams/bulletins/class/${classId}/publish`, { periodId });
    return response.data;
  },

  /**
   * CONFIGURATION — avec fallback offline
   */
  async getEvaluationTypes(schoolLevelId?: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const params = schoolLevelId ? { schoolLevelId } : {};
      const response = await apiClient.get(`/institutional-exams/config/evaluation-types`, { params });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async createEvaluationType(data: any) {
    const response = await apiClient.post(`/institutional-exams/config/evaluation-types`, data);
    return response.data;
  },

  async updateEvaluationType(id: string, data: any) {
    const response = await apiClient.patch(`/institutional-exams/config/evaluation-types/${id}`, data);
    return response.data;
  },

  async deleteEvaluationType(id: string) {
    const response = await apiClient.delete(`/institutional-exams/config/evaluation-types/${id}`);
    return response.data;
  },

  async getGradeScales() {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/institutional-exams/config/grade-scales`);
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async createGradeScale(data: any) {
    const response = await apiClient.post(`/institutional-exams/config/grade-scales`, data);
    return response.data;
  },

  /**
   * CONSEILS DE CLASSE — avec fallback offline
   */
  async getCouncils(periodId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/institutional-exams/councils`, { params: { periodId } });
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
    const response = await apiClient.post(`/institutional-exams/councils`, data);
    return response.data;
  },

  async saveCouncilDecision(councilId: string, studentId: string, data: any) {
    const tenantId = getTenantId();
    if (tenantId && !networkDetectionService.isConnected()) {
      return createEntityOffline(tenantId, 'EXAM_RESULT', { ...data, councilId, studentId });
    }
    const response = await apiClient.post(`/institutional-exams/councils/${councilId}/decisions/${studentId}`, data);
    return response.data;
  },

  async downloadBulletin(studentId: string, periodId: string) {
    const response = await apiClient.get(`/institutional-exams/bulletins/download/${studentId}`, {
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
      const response = await apiClient.get(`/institutional-exams/audit/logs`, { params: filters });
      return response.data;
    } catch (error: any) {
      if (error.isOffline) return [];
      throw error;
    }
  },

  async getOrionInsights(schoolLevelId: string, academicYearId: string) {
    if (!networkDetectionService.isConnected()) return [];
    try {
      const response = await apiClient.get(`/institutional-exams/dashboard/orion-insights?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      if (error.isOffline) return [];
      // Ne pas crasher si l'API orion-insights n'existe pas ou échoue
      console.warn('[getOrionInsights] Error:', error.message);
      return [];
    }
  }
};
