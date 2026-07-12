/**
 * ============================================================================
 * STUDENTS SERVICE - API Client pour le module Scolarité (Élèves)
 * ============================================================================
 */

import { apiFetch, apiClient } from "@/lib/api/client";
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
   * Récupère la liste des étudiants (paginée).
   *
   * ⚠️ Le backend retourne maintenant un objet paginé :
   *   { data: Student[], total: number, page: number, limit: number, totalPages: number }
   *
   * Pour préserver la rétro-compatibilité avec les callers qui attendent un
   * array, on :
   *   - retourne l'array si la réponse est un array (ancien format)
   *   - sinon retourne l'objet { data, total, page, limit, totalPages }
   *
   * Les callers peuvent utiliser :
   *   const result = await studentsService.getAll({ academicYearId, page: 1, limit: 50 });
   *   const students = Array.isArray(result) ? result : result.data;
   *   const total = Array.isArray(result) ? result.length : result.total;
   *
   * Si l'appelant ne spécifie pas de page/limit, on utilise limit=50 par défaut
   * (page gérable avec boutons de navigation) au lieu de 200 qui masquait la
   * pagination.
   */
  async getAll(params?: Record<string, string>): Promise<any> {
    const finalParams: Record<string, string> = { ...(params || {}) };
    // ⭐ Par défaut limit=50 (page gérable avec pagination UI).
    // Si l'appelant veut tous les élèves d'un coup, il doit passer limit=200.
    if (!finalParams.limit && !finalParams.page) {
      finalParams.limit = '50';
    }
    const qs = new URLSearchParams(finalParams).toString();

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
    // ⚠️ Utiliser fetch direct avec getApiBaseUrl() pour construire l'URL
    // correcte (incluant le /api prefix).
    const { getApiBaseUrl } = await import('@/lib/utils/urls');
    const apiUrl = getApiBaseUrl();
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

  // ─── Batch / Bulk admission operations ───

  async batchSubmitAdmissions(admissionIds: string[]): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/batch/submit`, {
      method: "POST",
      body: { admissionIds },
    });
  }

  async batchAcceptAdmissions(admissionIds: string[], comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/batch/accept`, {
      method: "POST",
      body: { admissionIds, comment },
    });
  }

  async batchConvertAdmissions(admissionIds: string[]): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/batch/convert`, {
      method: "POST",
      body: { admissionIds },
    });
  }

  /**
   * Batch accept-and-enroll : pour chaque candidature, accepte + convertit
   * en élève inscrit (crée Student + matricule + compte financier + guardian).
   *
   * Backend: POST /students/admissions/batch/accept-and-enroll
   * Body: { admissionIds: string[], comment?: string }
   * Response: { total, succeeded, failed, results: [{ id, success, studentId?, matricule?, error? }] }
   */
  async batchAcceptAndEnrollAdmissions(admissionIds: string[], comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/batch/accept-and-enroll`, {
      method: "POST",
      body: { admissionIds, comment },
    });
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

  /**
   * Accept-and-enroll single : accepte la candidature ET convertit directement
   * en élève inscrit (crée Student + matricule + compte financier + guardian).
   * Évite de passer par les étapes ACCEPTED → CONVERT manuelles.
   *
   * Backend: POST /students/admissions/:id/accept-and-enroll
   * Body: { comment?: string }
   * Response: l'objet Student créé (avec matricule, classe, etc.)
   */
  async acceptAndEnrollAdmission(id: string, comment?: string): Promise<any> {
    return apiFetch(`${BASE_URL}/admissions/${encodeURIComponent(id)}/accept-and-enroll`, {
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
   *
   * ✅ Backend UpdateStudentPrismaDto accepte maintenant (aligné sur le pattern RH) :
   *    - firstName, lastName, dateOfBirth, gender (M|F), nationality, primaryLanguage,
   *    - npi, photoUrl, placeOfBirth, status, tenantId
   *    - academicYearId, schoolLevelId, currentAcademicYearId (UUID)
   *
   * Tout enregistrement élève est lié à une année académique + un niveau scolaire
   * (convention projet — voir module RH `allowedFields` qui inclut ces deux champs).
   *
   * On garde quand même :
   *  - la conversion dateOfBirth string → ISO (le backend accepte les deux,
   *    mais on normalise côté client pour éviter toute ambiguïté)
   *  - la normalisation gender (M/F uniquement)
   *  - le logging + la capture du message backend pour faciliter le debug
   */
  async update(id: string, data: any): Promise<any> {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (v !== undefined) {
        cleaned[k] = v;
      }
    }
    // Normaliser gender : le DTO impose @IsIn(['M', 'F']).
    // Si la valeur n'est ni 'M' ni 'F' (ex: 'Masculin', 'Féminin', ''), on l'omet.
    if (cleaned.gender !== undefined && cleaned.gender !== 'M' && cleaned.gender !== 'F') {
      delete cleaned.gender;
    }
    // ⚠️ Convertir dateOfBirth en ISO complet si c'est une string courte (YYYY-MM-DD).
    // Le backend accepte maintenant les deux formats, mais on normalise côté client.
    // Input <input type="date"> retourne "2023-08-20" → on envoie "2023-08-20T00:00:00.000Z".
    if (cleaned.dateOfBirth && typeof cleaned.dateOfBirth === 'string') {
      const d = cleaned.dateOfBirth;
      // Si c'est déjà un ISO complet (contient 'T'), garder tel quel
      if (!d.includes('T')) {
        cleaned.dateOfBirth = new Date(d + 'T00:00:00.000Z').toISOString();
      }
    }
    console.log('[studentsService.update] PUT /students/' + id, cleaned);
    try {
      return await apiFetch(`${BASE_URL}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: cleaned,
      });
    } catch (err: any) {
      // Axios range les détails du backend dans err.response.data
      const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
      console.error('[studentsService.update] Erreur backend:', err?.response?.status, backendMsg, err?.response?.data);
      // Re-lancer avec un message explicite pour l'UI
      if (Array.isArray(backendMsg)) {
        throw new Error(backendMsg.join(' • '));
      }
      if (backendMsg) {
        throw new Error(typeof backendMsg === 'string' ? backendMsg : JSON.stringify(backendMsg));
      }
      throw err;
    }
  }

  /**
   * Change la classe d'un élève (POST /students/change-class)
   * Backend : StudentsLifecycleController.changeClass
   * Body: { studentId, academicYearId, classId }
   */
  async changeClass(studentId: string, academicYearId: string, classId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/change-class`, {
      method: "POST",
      body: { studentId, academicYearId, classId },
    });
  }

  /**
   * ⭐ Affecte un élève vers une classe PHYSIQUE (POST /students/assign-physical-class)
   * Utilisé par le sous-onglet "Affectation vers classe physique".
   * Body: { studentId, academicYearId, physicalClassId, reason? }
   */
  async assignPhysicalClass(data: {
    studentId: string;
    academicYearId: string;
    physicalClassId: string;
    reason?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/assign-physical-class`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * ⭐ Change la série officielle d'un élève (POST /students/change-series)
   * Utilisé par le sous-onglet "Changement de série".
   * Body: { studentId, academicYearId, newSeriesId, reason? }
   */
  async changeSeries(data: {
    studentId: string;
    academicYearId: string;
    newSeriesId: string;
    reason?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/change-series`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * ⭐ Liste les élèves admis/inscrits SANS classe physique (classId NULL).
   * Utilisé par le sous-onglet "Affectation vers classe physique".
   */
  async getStudentsWithoutPhysicalClass(academicYearId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/students-without-physical-class?academicYearId=${encodeURIComponent(academicYearId)}`,
    );
  }

  /**
   * ⭐ Liste l'historique des transferts/affectations (ClassTransfer).
   * Utilisé par le sous-onglet "Historique".
   */
  async getClassTransfersHistory(academicYearId?: string): Promise<any> {
    const qs = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return apiFetch(`${BASE_URL}/class-transfers-history${qs}`);
  }

  /**
   * ⭐ Réinitialise toutes les affectations de classes physiques pour l'année.
   * Passe classId = NULL sur toutes les inscriptions actives, afin que
   * l'administrateur puisse refaire l'affectation manuellement.
   *
   * ⚠️ L'academicClassId (classe officielle) est PRÉSERVÉ.
   */
  async resetPhysicalAssignments(academicYearId: string): Promise<{ reset: number; academicYearId: string }> {
    return apiFetch(`${BASE_URL}/reset-physical-assignments`, {
      method: "POST",
      body: { academicYearId },
    });
  }

  /**
   * Upload photo d'élève via data URL (base64) — pattern identique au RH.
   * Backend : POST /students/:id/upload-photo
   * Body: { photoDataUrl: string }
   */
  async uploadPhoto(studentId: string, photoDataUrl: string): Promise<any> {
    return apiFetch(`${BASE_URL}/${encodeURIComponent(studentId)}/upload-photo`, {
      method: "POST",
      body: { photoDataUrl },
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
   * Admission formelle : génère le matricule institutionnel,
   * change le statut d'enrollment PRE_REGISTERED → ADMITTED,
   * assigne la classe (si fournie) et crée le dossier académique.
   * Backend : POST /students/admit
   */
  async admit(data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId?: string | null;
    validateDocuments?: boolean;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/admit`, {
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
   * Réinscription d'un élève existant pour une nouvelle année scolaire.
   * Backend : POST /students/re-enroll
   */
  async reEnroll(data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId: string;
    previousArrears?: number;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/re-enroll`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Promotion manuelle d'un élève vers l'année suivante.
   * Backend : POST /students/promote
   */
  async promoteStudent(data: {
    studentId: string;
    fromAcademicYearId: string;
    toAcademicYearId: string;
    schoolLevelId: string;
    toClassId?: string;
    previousArrears?: number;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/promote`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Redoublement d'un élève.
   * Backend : POST /students/repeat
   */
  async repeatStudent(data: {
    studentId: string;
    fromAcademicYearId: string;
    toAcademicYearId: string;
    schoolLevelId: string;
    classId: string;
    previousArrears?: number;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/repeat`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Promotion en lot (réinscription massive).
   * Backend : POST /students/batch-promote
   */
  async batchPromote(data: {
    studentIds: string[];
    fromAcademicYearId: string;
    toAcademicYearId: string;
    schoolLevelId: string;
    toClassId?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/batch-promote`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Mise à jour de statut en lot.
   * Backend : POST /students/batch-update-status
   */
  async batchUpdateStatus(data: {
    studentIds: string[];
    status: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/batch-update-status`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Transfert / sortie d'un élève.
   * Backend : POST /students/transfer
   */
  async transferStudent(data: {
    studentId: string;
    academicYearId: string;
    exitReason?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/transfer`, {
      method: "POST",
      body: data,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⭐ TRANSFERTS INTER-ÉCOLES (StudentTransferRequest)
  // Backend : /students/transfers/*
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * ⭐ Liste les transferts sortants (depuis cette école vers d'autres).
   */
  async getOutgoingTransfers(): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/outgoing`);
  }

  /**
   * ⭐ Liste les transferts entrants (depuis d'autres écoles vers celle-ci).
   */
  async getIncomingTransfers(): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/incoming`);
  }

  /**
   * ⭐ Crée une demande de transfert inter-écoles.
   */
  async createTransferRequest(data: {
    studentId: string;
    targetSchoolId: string;
    academicYearId: string;
    motif?: string;
    message?: string;
    requestedLevelId?: string;
    requestedClassId?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * ⭐ Recherche d'écoles destinataires (pour transfert inter-écoles).
   */
  async searchSchoolsForTransfer(query: string): Promise<any> {
    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    return apiFetch(`${BASE_URL}/transfers/search-schools${qs}`);
  }

  /**
   * ⭐ Approuve un transfert entrant (côté école destination).
   */
  async approveTransfer(transferId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/approve`, {
      method: "POST",
    });
  }

  /**
   * ⭐ Rejette un transfert entrant (côté école destination).
   */
  async rejectTransfer(transferId: string, reason: string): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/reject`, {
      method: "POST",
      body: { reason },
    });
  }

  /**
   * ⭐ Demande un complément d'information pour un transfert entrant.
   */
  async requestTransferComplement(transferId: string, message: string): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/request-complement`, {
      method: "POST",
      body: { message },
    });
  }

  /**
   * ⭐ Confirme la sortie de l'élève de l'école source.
   */
  async confirmTransferExit(transferId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/confirm-exit`, {
      method: "POST",
    });
  }

  /**
   * ⭐ Exécute un transfert (finalisation côté école destination).
   */
  async executeTransfer(transferId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/execute`, {
      method: "POST",
    });
  }

  /**
   * ⭐ Récupère le dossier complet d'un transfert (élève + documents + historique).
   */
  async getTransferDossier(transferId: string, level: 'FULL' | 'MASKED' = 'MASKED'): Promise<any> {
    return apiFetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/dossier?level=${level}`);
  }

  /**
   * Abandon / sortie définitive d'un élève.
   * Backend : POST /students/withdraw
   */
  async withdrawStudent(data: {
    studentId: string;
    academicYearId: string;
    exitReason?: string;
    exitDate?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/withdraw`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * Réintégration d'un élève ayant abandonné.
   * Backend : POST /students/reintegrate
   */
  async reintegrateStudent(data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/reintegrate`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * ⭐ Exclusion administrative (renvoi disciplinaire)
   */
  async excludeStudent(data: {
    studentId: string;
    academicYearId: string;
    reason: string;
    exitDate?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/exclude`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * ⭐ Sortie fin d'année (sortie naturelle)
   */
  async exitStudent(data: {
    studentId: string;
    academicYearId: string;
    exitReason?: string;
    exitDate?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/exit`, {
      method: "POST",
      body: data,
    });
  }

  /**
   * ⭐ Historique global des mouvements
   */
  async getMovementHistory(params?: {
    academicYearId?: string;
    action?: string;
    studentId?: string;
    limit?: number;
  }): Promise<any> {
    const qs = params ? new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiFetch(`${BASE_URL}/movement-history${qs ? `?${qs}` : ''}`);
  }

  /**
   * Export des inscriptions en CSV.
   */
  async exportEnrollmentsCSV(params: {
    academicYearId: string;
    schoolLevelId?: string;
  }): Promise<void> {
    const qs = new URLSearchParams(params as any).toString();
    const token = typeof window !== 'undefined'
      ? (document.cookie.split('; ').find(r => r.startsWith('academia_token='))?.split('=')[1] || '')
      : '';
    const res = await fetch(`${BASE_URL}/enrollments?${qs}&format=csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Export échoué');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscriptions_${params.academicYearId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Génère le PDF de la liste d'élèves d'une classe et retourne une blob URL
   * + le nom du fichier pour affichage dans un DocumentPreviewModal.
   *
   * BFF : GET /api/students/class-list/:classId/pdf?academicYearId=...&mode=...
   * (proxy vers backend NestJS)
   *
   * En-tête adapté au niveau (Maternelle/Primaire vs Secondaire).
   *
   * @param mode 'physical' (défaut, sections CE1-A/CE1-B...) ou 'official' (classes officielles CE1/CP/6ème...)
   * @returns { url: string; fileName: string } — blob URL à passer à l'iframe/img
   *          + nom du fichier pour le bouton Télécharger du modal
   *          ⚠️ L'appelant DOIT faire URL.revokeObjectURL(url) à la fermeture du modal
   */
  async generateClassListPdf(
    classId: string,
    academicYearId: string,
    mode: 'physical' | 'official' = 'physical',
  ): Promise<{ url: string; fileName: string }> {
    const res = await fetch(
      `/api/students/class-list/${encodeURIComponent(classId)}/pdf?academicYearId=${encodeURIComponent(academicYearId)}&mode=${mode}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Génération PDF échouée (${res.status}): ${errText}`);
    }
    const blob = await res.blob();

    let filename = 'liste_classe.pdf';
    const cd = res.headers.get('Content-Disposition');
    if (cd) {
      const match = cd.match(/filename="?([^";]+)"?/);
      if (match) filename = decodeURIComponent(match[1]);
    }

    const url = URL.createObjectURL(blob);
    return { url, fileName: filename };
  }

  /**
   * Génère le PDF et le STOCKE en DB (GeneratedDocument).
   * Pattern Generate + Visualiser (comme RH contrats) : générer une fois,
   * visualiser ensuite instantanément sans regénérer.
   *
   * BFF : POST /api/students/class-list/:classId/pdf/generate
   *
   * @param mode 'physical' (défaut) ou 'official'
   */
  async generateAndStoreClassListPdf(
    classId: string,
    academicYearId: string,
    mode: 'physical' | 'official' = 'physical',
  ): Promise<{ success: boolean; documentId: string; fileName: string; fileSize: number; generatedAt: string }> {
    const res = await fetch(
      `/api/students/class-list/${encodeURIComponent(classId)}/pdf/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId, mode }),
        credentials: 'include',
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Génération PDF échouée (${res.status}): ${errText}`);
    }
    return res.json();
  }

  /**
   * Récupère le PDF stocké en DB (sans regénérer). Retourne une blob URL.
   * Lance une erreur si aucun PDF n'a été généré.
   *
   * BFF : GET /api/students/class-list/:classId/pdf/stored
   *
   * @param mode 'physical' (défaut) ou 'official'
   */
  async getStoredClassListPdf(
    classId: string,
    academicYearId: string,
    mode: 'physical' | 'official' = 'physical',
  ): Promise<{ url: string; fileName: string }> {
    const res = await fetch(
      `/api/students/class-list/${encodeURIComponent(classId)}/pdf/stored?academicYearId=${encodeURIComponent(academicYearId)}&mode=${mode}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      throw new Error('Aucun PDF généré pour cette classe. Générez d\'abord le document.');
    }
    const blob = await res.blob();
    let filename = 'liste_classe.pdf';
    const cd = res.headers.get('Content-Disposition');
    if (cd) {
      const match = cd.match(/filename="?([^";]+)"?/);
      if (match) filename = decodeURIComponent(match[1]);
    }
    const url = URL.createObjectURL(blob);
    return { url, fileName: filename };
  }

  /**
   * Vérifie si un PDF a déjà été généré pour cette classe.
   *
   * BFF : GET /api/students/class-list/:classId/pdf/exists
   *
   * @param mode 'physical' (défaut) ou 'official'
   */
  async checkClassListPdfExists(
    classId: string,
    academicYearId: string,
    mode: 'physical' | 'official' = 'physical',
  ): Promise<{ exists: boolean; documentId?: string; generatedAt?: string; fileName?: string }> {
    const res = await fetch(
      `/api/students/class-list/${encodeURIComponent(classId)}/pdf/exists?academicYearId=${encodeURIComponent(academicYearId)}&mode=${mode}`,
      { credentials: 'include' },
    );
    if (!res.ok) return { exists: false };
    return res.json();
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
   *
   * ⭐ Si schoolLevelId n'est pas fourni, génère pour TOUS les élèves actifs
   * du tenant pour l'année, tous niveaux confondus.
   *
   * ⚠️ Timeout étendu à 5 minutes (300000ms) car la génération de cartes
   * via Puppeteer est lente (~2-5s par carte × N élèves).
   */
  async generateBulkIdCards(data: {
    academicYearId: string;
    schoolLevelId?: string;
    classId?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/id-cards/generate-bulk`, {
      method: "POST",
      body: data,
      timeout: 300000, // 5 minutes (génération PDF via Puppeteer)
    });
  }

  /**
   * ⭐ Supprime TOUTES les cartes du tenant (optionnellement filtrées par année).
   * Utilisé pour régénérer les cartes avec un nouveau template.
   */
  async deleteAllCards(academicYearId?: string): Promise<{ deleted: number; academicYearFilter?: string }> {
    const qs = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return apiFetch(`${BASE_URL}/id-cards/all${qs}`, {
      method: "DELETE",
      timeout: 60000,
    });
  }

  /**
   * ⭐ Supprime toutes les cartes d'une classe physique spécifique.
   */
  async deleteCardsByClass(classId: string, academicYearId?: string): Promise<{ deleted: number; classId: string }> {
    const qs = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return apiFetch(`${BASE_URL}/id-cards/by-class/${encodeURIComponent(classId)}${qs}`, {
      method: "DELETE",
      timeout: 60000,
    });
  }

  /**
   * ⭐ Supprime toutes les cartes d'un niveau scolaire.
   */
  async deleteCardsByLevel(levelId: string, academicYearId?: string): Promise<{ deleted: number; levelId: string }> {
    const qs = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return apiFetch(`${BASE_URL}/id-cards/by-level/${encodeURIComponent(levelId)}${qs}`, {
      method: "DELETE",
      timeout: 60000,
    });
  }

  /**
   * ⭐ Liste les cartes groupées par niveau scolaire puis par classe.
   */
  async getCardsGroupedByClass(academicYearId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/id-cards/grouped-by-class?academicYearId=${encodeURIComponent(academicYearId)}`,
    );
  }

  /**
   * ⭐ Télécharge un PDF groupé par classe (toutes les cartes de la classe dans un seul PDF).
   * Retourne un Blob pour déclencher le téléchargement côté navigateur.
   * ⚠️ Timeout 5 min (génération PDF via Puppeteer pour N élèves).
   */
  async downloadClassBundlePdf(classId: string, academicYearId: string): Promise<Blob> {
    const url = `${BASE_URL}/id-cards/class/${encodeURIComponent(classId)}/bundle-pdf?academicYearId=${encodeURIComponent(academicYearId)}`;
    const response = await apiClient.get(url, {
      responseType: 'blob',
      timeout: 300000, // 5 minutes
    });
    return response.data;
  }

  /**
   * ⭐ Télécharge le PDF d'une carte individuelle.
   * ⚠️ Timeout 60s (1 carte = 1 PDF Puppeteer).
   */
  async downloadIdCardPdf(cardId: string): Promise<Blob> {
    const url = `${BASE_URL}/id-cards/${encodeURIComponent(cardId)}/download`;
    const response = await apiClient.get(url, {
      responseType: 'blob',
      timeout: 60000, // 1 minute
    });
    return response.data;
  }

  /**
   * ⭐ Génère une carte pour un élève spécifique.
   */
  async generateIdCard(studentId: string, academicYearId: string, schoolLevelId: string): Promise<any> {
    return apiFetch(
      `${BASE_URL}/id-cards/${encodeURIComponent(studentId)}/generate?academicYearId=${encodeURIComponent(academicYearId)}&schoolLevelId=${encodeURIComponent(schoolLevelId)}`,
      { method: "POST" },
    );
  }

  /**
   * ⭐ Récupère l'URL de prévisualisation HTML d'une carte (pour iframe).
   * Retourne l'URL BFF qui proxie vers le backend.
   */
  getCardPreviewUrl(cardId: string): string {
    return `/api/students/id-cards/${encodeURIComponent(cardId)}/preview-html`;
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
    // ⚠️ Fix bug : l'endpoint est /students/id-cards/{cardId}/revoke (sans /card/)
    // Ancien code : ${BASE_URL}/id-cards/card/${id}/revoke → 404
    return apiFetch(
      `${BASE_URL}/id-cards/${encodeURIComponent(id)}/revoke`,
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
   * @param academicYearId UUID de l'année scolaire
   * @param levelCode Code du niveau scolaire (MATERNELLE / PRIMAIRE / SECONDAIRE)
   *                  — envoyé tel quel au backend qui résout le SchoolLevel par code+tenantId
   *                  (méthode fiable, élimine l'ambiguïté entre education_levels.id et school_levels.id).
   */
  async exportEducmasterExcel(
    academicYearId: string,
    levelCode: string,
  ): Promise<void> {
    const res = await fetch(
      `/api/students/export/educmaster-excel?academicYearId=${encodeURIComponent(academicYearId)}&code=${encodeURIComponent(levelCode)}`,
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
    a.download = `Educmaster_${levelCode}_${academicYearId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }
}

export const studentsService = new StudentsService();
