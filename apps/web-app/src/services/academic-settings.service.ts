/**
 * ============================================================================
 * ACADEMIC SETTINGS SERVICE - API Client pour le module Paramétrage académique
 * ============================================================================
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_URL = `${API_URL}/api/exams/settings`;

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Une erreur est survenue' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

function fetchApi(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  }).then(handleResponse);
}

class AcademicSettingsService {
  /**
   * Récupère tous les paramétrages académiques (optionnellement filtrés par année scolaire)
   */
  async getAll(schoolYearId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (schoolYearId) params.set('schoolYearId', schoolYearId);
    const qs = params.toString();
    return fetchApi(`${BASE_URL}${qs ? `?${qs}` : ''}`);
  }

  /**
   * Récupère le paramétrage actif pour une année scolaire donnée
   */
  async getActive(schoolYearId: string): Promise<any> {
    return fetchApi(`${BASE_URL}/active?schoolYearId=${encodeURIComponent(schoolYearId)}`);
  }

  /**
   * Récupère un paramétrage par son identifiant
   */
  async getById(id: string): Promise<any> {
    return fetchApi(`${BASE_URL}/${encodeURIComponent(id)}`);
  }

  /**
   * Récupère le schéma de saisie des notes selon les filtres pédagogiques fournis
   */
  async getScoreEntrySchema(params: {
    schoolYearId: string;
    cycleCode?: string;
    levelCode?: string;
    classId?: string;
    subjectId?: string;
    periodId?: string;
  }): Promise<any> {
    const qs = new URLSearchParams();
    qs.set('schoolYearId', params.schoolYearId);
    if (params.cycleCode) qs.set('cycleCode', params.cycleCode);
    if (params.levelCode) qs.set('levelCode', params.levelCode);
    if (params.classId) qs.set('classId', params.classId);
    if (params.subjectId) qs.set('subjectId', params.subjectId);
    if (params.periodId) qs.set('periodId', params.periodId);
    return fetchApi(`${BASE_URL}/score-entry-schema?${qs.toString()}`);
  }

  /**
   * Crée un nouveau paramétrage académique
   */
  async create(data: any): Promise<any> {
    return fetchApi(BASE_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Met à jour un paramétrage académique existant
   */
  async update(id: string, data: any): Promise<any> {
    return fetchApi(`${BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Active un paramétrage académique (passe au statut ACTIVE)
   */
  async activate(id: string): Promise<any> {
    return fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
    });
  }

  /**
   * Verrouille un paramétrage académique (passe au statut LOCKED)
   */
  async lock(id: string): Promise<any> {
    return fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/lock`, {
      method: 'POST',
    });
  }

  /**
   * Archive un paramétrage académique (passe au statut ARCHIVED)
   */
  async archive(id: string): Promise<any> {
    return fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
  }

  /**
   * Duplique un paramétrage académique existant
   */
  async duplicate(id: string): Promise<any> {
    return fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    });
  }

  /**
   * Valide une configuration avant activation
   */
  async validate(config: any): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    return fetchApi(`${BASE_URL}/validate`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  /**
   * Lance une simulation de calcul de notes sur la configuration donnée
   */
  async simulate(config: any): Promise<{ students: any[]; summary: any }> {
    return fetchApi(`${BASE_URL}/simulate`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

export const academicSettingsService = new AcademicSettingsService();
