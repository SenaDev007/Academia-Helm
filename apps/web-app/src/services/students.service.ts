/**
 * ============================================================================
 * STUDENTS SERVICE - API Client pour le module Scolarité (Élèves)
 * ============================================================================
 */

import { apiFetch } from "@/lib/api/client";
import { createEntityOffline, updateEntityOffline } from "@/lib/offline/offline-business.service";
import { networkDetectionService } from "@/lib/offline/network-detection.service";
import { LocalSearchService } from "@/lib/offline/local-search.service";

const BASE_URL = "/students";

function getTenantId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : "";
}

class StudentsService {
  /**
   * Récupère la liste des étudiants
   */
  async getAll(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : "";
    
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("students", { tenantId: getTenantId() });
    }

    try {
      return await apiFetch(`${BASE_URL}${qs ? `?${qs}` : ""}`);
    } catch (error) {
      return LocalSearchService.search("students", { tenantId: getTenantId() });
    }
  }

  /**
   * Admissions — avec fallback offline
   */
  async getAdmissions(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : "";
    
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("students", { tenantId: getTenantId(), filters: { type: 'admission' } });
    }

    try {
      return await apiFetch(`${BASE_URL}/admissions${qs ? `?${qs}` : ""}`);
    } catch (error) {
      return LocalSearchService.search("students", { tenantId: getTenantId(), filters: { type: 'admission' } });
    }
  }

  async getAdmissionById(id: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      const results = await LocalSearchService.search("students", { tenantId: getTenantId() });
      return results.find((s: any) => s.id === id) || null;
    }
    try {
      return await apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}`);
    } catch (error) {
      const results = await LocalSearchService.search("students", { tenantId: getTenantId() });
      return results.find((s: any) => s.id === id) || null;
    }
  }

  async createAdmission(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, "STUDENT", { ...data, admissionStatus: 'PENDING' });
    }
    return apiFetch(`${BASE_URL}/admissions`, {
      method: "POST",
      body: data,
    });
  }

  async updateAdmission(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, "STUDENT", id, data);
    }
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    });
  }

  async submitAdmission(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/submit`, {
      method: "POST",
    });
  }

  async decideAdmission(
    id: string,
    data: { decision: "ACCEPTED" | "REJECTED"; comment: string },
  ): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/decide`, {
      method: "POST",
      body: data,
    });
  }

  async convertAdmission(id: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/admissions/${encodeURIComponent(id)}/convert`,
      {
        method: "POST",
      },
    );
  }

  /**
   * Crée un nouvel étudiant
   */
  async create(data: any): Promise<any> {
    // Mode Offline-First complet pour les opérations CRUD basiques
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, "STUDENT", data);
    }
    
    // Fallback si tenantId non trouvé
    return apiFetch(BASE_URL, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Met à jour un étudiant
   */
  async update(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, "STUDENT", id, data);
    }
    
    // Fallback si tenantId non trouvé
    return apiFetch(`${BASE_URL}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    });
  }

  /**
   * Récupère les inscriptions — avec fallback offline
   */
  async getEnrollments(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : "";
    
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("students", { tenantId: getTenantId(), filters: { enrollmentStatus: 'ENROLLED' } });
    }
    
    try {
      return await apiFetch(`${BASE_URL}/enrollments${qs ? `?${qs}` : ""}`);
    } catch (error) {
      return LocalSearchService.search("students", { tenantId: getTenantId(), filters: { enrollmentStatus: 'ENROLLED' } });
    }
  }

  /**
   * Crée une inscription / admission — offline-first
   */
  async createEnrollment(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, "STUDENT", { ...data, type: 'enrollment' });
    }
    return apiFetch(`${BASE_URL}/enrollments`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Pré-inscription
   */
  async preRegister(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/pre-register`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Ajouter des tuteurs
   */
  async addGuardians(
    studentId: string,
    data: { guardians: any[] },
  ): Promise<any> {
    return apiFetch(`${BASE_URL}/${encodeURIComponent(studentId)}/guardians`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Finaliser l'inscription (enroll)
   */
  async enrollStudent(studentId: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/${encodeURIComponent(studentId)}/enroll`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Statistiques des cartes d'identité
   */
  async getIdCardStats(academicYearId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/id-cards/stats?academicYearId=${academicYearId}`,
    );
  }

  /**
   * Génération par lot de cartes d'identité
   */
  async generateBulkIdCards(data: {
    academicYearId: string;
    schoolLevelId: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/id-cards/generate-bulk`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Statistiques des matricules
   */
  async getMatriculeStats(): Promise<any> {
    return apiFetch(`${BASE_URL}/identifiers/stats`);
  }

  /**
   * Génération par lot de matricules
   */
  async generateBulkMatricules(data: {
    academicYearId: string;
    schoolLevelId: string;
    status?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/identifiers/generate-bulk?countryCode=BJ`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Générer un matricule individuel
   */
  async generateMatricule(studentId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/identifiers/${encodeURIComponent(studentId)}/generate?countryCode=BJ`,
      {
        method: "POST",
      },
    );
  }

  /**
   * Rechercher par matricule
   */
  async searchByMatricule(matricule: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/identifiers/search/${encodeURIComponent(matricule)}`,
    );
  }

  /**
   * Statistiques Générales
   */
  async getStatistics(
    academicYearId: string,
    schoolLevelId: string,
  ): Promise<any> {
    const params = new URLSearchParams({ academicYearId, schoolLevelId });
    return apiFetch(`${BASE_URL}/statistics?${params}`);
  }

  /**
   * KPIs ORION
   */
  async getOrionKpis(academicYearId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/orion/kpis?academicYearId=${encodeURIComponent(academicYearId)}`,
    );
  }

  /**
   * Alertes ORION
   */
  async getOrionAlerts(academicYearId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/orion/alerts?academicYearId=${encodeURIComponent(academicYearId)}`,
    );
  }

  /**
   * Révoquer une carte d'identité
   */
  async revokeIdCard(id: string, reason: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/id-cards/card/${encodeURIComponent(id)}/revoke`,
      {
        method: "PUT",
        body: { reason },
      },
    );
  }

  /**
   * Dossier et historique
   */
  async getDossier(id: string, academicYearId?: string): Promise<any> {
    const url = `/api/students/${id}/dossier${academicYearId ? `?academicYearId=${academicYearId}` : ""}`;
    return apiFetch(url);
  }

  async getHistory(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/${encodeURIComponent(id)}/history`);
  }

  async getVerificationQR(id: string, academicYearId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/${encodeURIComponent(id)}/verification-qr?academicYearId=${encodeURIComponent(academicYearId)}`,
    );
  }

  async regenerateVerificationQR(
    id: string,
    academicYearId: string,
  ): Promise<any> {
    return apiFetch(
      `${BASE_URL}/${encodeURIComponent(id)}/verification-token/regenerate`,
      {
        method: "POST",
        body: { academicYearId },
      },
    );
  }

  /**
   * Télécharge le dossier académique PDF
   */
  async downloadAcademicDossier(
    id: string,
    academicYearId: string,
  ): Promise<void> {
    const res = await fetch(
      `/api/students/${encodeURIComponent(id)}/academic-dossier?academicYearId=${encodeURIComponent(academicYearId)}`,
      {
        headers: {
          // Need to add auth headers manually if not using apiClient for blob
          "x-tenant-id": localStorage.getItem("tenantId") || "",
        },
      },
    );
    if (!res.ok) throw new Error("Erreur lors du téléchargement");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DOSSIER_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  /**
   * Export Educmaster Excel
   */
  async exportEducmasterExcel(
    academicYearId: string,
    schoolLevelId: string,
  ): Promise<void> {
    const res = await fetch(
      `/api/students/export/educmaster-excel?academicYearId=${encodeURIComponent(academicYearId)}&schoolLevelId=${encodeURIComponent(schoolLevelId)}`,
      {
        headers: {
          "x-tenant-id": localStorage.getItem("tenantId") || "",
        },
      },
    );
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ message: "Erreur lors de l'export" }));
      throw new Error(err.message || "Erreur lors de l'export");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EDUCMASTER_EXPORT_${schoolLevelId}_${academicYearId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }
}

export const studentsService = new StudentsService();
