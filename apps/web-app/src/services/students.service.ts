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

    // ⚠️ NE PAS catcher silencieusement — si l'API retourne 500 (migrations
    // non appliquées, FK violation, etc.), l'utilisateur doit voir l'erreur
    // au lieu d'avoir une liste vide sans explication.
    return apiFetch(`${BASE_URL}/admissions${qs ? `?${qs}` : ""}`);
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
    // ⚠️ IMPORTANT : les admissions DOIVENT être sauvegardées dans la vraie DB
    // (pas en mode offline). Avant, le code vérifiait `if (tenantId)` et
    // redirigeait vers createEntityOffline — mais tenantId est TOUJOURS défini
    // en production → l'admission n'était jamais envoyée au backend.
    // Le toast disait "succès" mais la DB était vide.
    return apiFetch(`${BASE_URL}/admissions`, {
      method: "POST",
      body: data,
    });
  }

  async updateAdmission(id: string, data: any): Promise<any> {
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
    // ⚠️ Utiliser fetch direct au lieu de apiFetch pour éviter les problèmes
    // de sérialisation axios. Le backend attend { decision, comment } en JSON.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' && window.location.host.includes('academiahelm.com') ? 'https://api.academiahelm.com/api' : '');
    const url = `${apiUrl}/students/admissions/${encodeURIComponent(id)}/decide`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ decision: data.decision, comment: data.comment }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async convertAdmission(id: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/admissions/${encodeURIComponent(id)}/convert`,
      {
        method: "POST",
      },
    );
  }

  async deleteAdmission(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async acceptAdmission(id: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      body: { comment },
    });
  }

  async rejectAdmission(id: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: { comment },
    });
  }

  async waitlistAdmission(id: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/waitlist`, {
      method: "POST",
      body: { comment },
    });
  }

  async cancelAdmission(id: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: { comment },
    });
  }

  async requestDocuments(id: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/request-documents`, {
      method: "POST",
      body: { comment },
    });
  }

  // ─── Admission Documents ──────────────────────────────────────────────────
  async getAdmissionDocuments(admissionId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(admissionId)}/documents`);
  }

  async createAdmissionDocument(admissionId: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(admissionId)}/documents`, {
      method: "POST",
      body: data,
    });
  }

  async validateAdmissionDocument(documentId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/documents/${encodeURIComponent(documentId)}/validate`, {
      method: "POST",
    });
  }

  async rejectAdmissionDocument(documentId: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/documents/${encodeURIComponent(documentId)}/reject`, {
      method: "POST",
      body: { comment },
    });
  }

  async deleteAdmissionDocument(documentId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
    });
  }

  // ─── Admission Interviews ─────────────────────────────────────────────────
  async getAdmissionInterviews(admissionId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(admissionId)}/interviews`);
  }

  async createAdmissionInterview(admissionId: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(admissionId)}/interviews`, {
      method: "POST",
      body: data,
    });
  }

  async completeAdmissionInterview(interviewId: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/interviews/${encodeURIComponent(interviewId)}/complete`, {
      method: "POST",
      body: data,
    });
  }

  async deleteAdmissionInterview(interviewId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/interviews/${encodeURIComponent(interviewId)}`, {
      method: "DELETE",
    });
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
