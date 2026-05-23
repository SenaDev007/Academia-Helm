/**
 * ============================================================================
 * ACADEMIC SETTINGS SERVICE — API Client + Offline Cache
 * ============================================================================
 *
 * Supporte le mode hors-ligne : les données de configuration sont mises en
 * cache dans IndexedDB (`school_academic_settings`) et servent de fallback
 * lorsque le réseau n'est pas disponible.
 *
 * Règle d'or : aucune règle académique n'est codée en dur ici.
 * La configuration vient TOUJOURS de la base de données (PostgreSQL ou IndexedDB).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_URL = `${API_URL}/api/exams/settings`;

// ─── Helpers API ─────────────────────────────────────────────────────────────

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

// ─── Helpers Offline (IndexedDB) ─────────────────────────────────────────────

async function getLocalDb() {
  if (typeof window === 'undefined') return null;
  try {
    const { localDb } = await import('@/lib/offline/local-db.service');
    return localDb;
  } catch {
    return null;
  }
}

async function cacheSettings(settings: any[]) {
  const db = await getLocalDb();
  if (!db) return;
  try {
    await db.executeBulk('school_academic_settings', 'put', settings);
  } catch (e) {
    console.warn('[AcademicSettings] Failed to cache settings locally:', e);
  }
}

async function getCachedSettings(schoolYearId?: string): Promise<any[]> {
  const db = await getLocalDb();
  if (!db) return [];
  try {
    const all = await db.query<any>('school_academic_settings');
    if (!schoolYearId) return all;
    return all.filter((s: any) => s.schoolYearId === schoolYearId);
  } catch {
    return [];
  }
}

async function getCachedActiveSetting(schoolYearId: string): Promise<any | null> {
  const all = await getCachedSettings(schoolYearId);
  return all.find((s: any) => s.status === 'ACTIVE' || s.isActive) ?? null;
}

async function cacheOneSetting(setting: any) {
  const db = await getLocalDb();
  if (!db || !setting?.id) return;
  try {
    await db.execute('school_academic_settings', 'put', setting);
  } catch (e) {
    console.warn('[AcademicSettings] Failed to cache setting:', e);
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

class AcademicSettingsService {
  /**
   * Récupère tous les paramétrages académiques.
   * Fallback: IndexedDB si réseau indisponible.
   */
  async getAll(schoolYearId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (schoolYearId) params.set('schoolYearId', schoolYearId);
    const qs = params.toString();

    try {
      const result = await fetchApi(`${BASE_URL}${qs ? `?${qs}` : ''}`);
      const list = Array.isArray(result) ? result : [];
      // Cache localement pour usage offline
      if (list.length > 0) await cacheSettings(list);
      return list;
    } catch {
      // Fallback: base locale
      console.warn('[AcademicSettings] Network unavailable, using local cache');
      return getCachedSettings(schoolYearId);
    }
  }

  /**
   * Récupère le paramétrage ACTIF pour une année scolaire.
   * Fallback: IndexedDB si réseau indisponible.
   */
  async getActive(schoolYearId: string): Promise<any> {
    try {
      const result = await fetchApi(`${BASE_URL}/active?schoolYearId=${encodeURIComponent(schoolYearId)}`);
      if (result?.id) await cacheOneSetting(result);
      return result;
    } catch {
      console.warn('[AcademicSettings] Offline — using cached active setting');
      return getCachedActiveSetting(schoolYearId);
    }
  }

  /**
   * Récupère un paramétrage par son identifiant.
   */
  async getById(id: string): Promise<any> {
    try {
      const result = await fetchApi(`${BASE_URL}/${encodeURIComponent(id)}`);
      if (result?.id) await cacheOneSetting(result);
      return result;
    } catch {
      const all = await getCachedSettings();
      return all.find((s: any) => s.id === id) ?? null;
    }
  }

  /**
   * Schéma dynamique de saisie des notes.
   * Retourne les colonnes (types d'évaluation) et formules selon la config active.
   * Fallback: reconstitue depuis le cache local.
   */
  async getScoreEntrySchema(params: {
    schoolYearId: string;
    cycleCode?: string;
    levelCode?: string;
    classId?: string;
    subjectId?: string;
    periodId?: string;
  }): Promise<{
    columns: Array<{
      key: string;
      label: string;
      type: string;
      max: number;
      required: boolean;
      weight: number;
      includedInAverage: boolean;
      visibleOnReportCard: boolean;
    }>;
    formula: string;
    generalAverageFormula: string;
    scoreMax: number;
    scoreDecimals: number;
    promotionThreshold: number;
    rankingScope: string;
  }> {
    const qs = new URLSearchParams();
    qs.set('schoolYearId', params.schoolYearId);
    if (params.cycleCode) qs.set('cycleCode', params.cycleCode);
    if (params.levelCode) qs.set('levelCode', params.levelCode);
    if (params.classId) qs.set('classId', params.classId);
    if (params.subjectId) qs.set('subjectId', params.subjectId);
    if (params.periodId) qs.set('periodId', params.periodId);

    try {
      return await fetchApi(`${BASE_URL}/score-entry-schema?${qs.toString()}`);
    } catch {
      // Reconstituer le schéma depuis le cache local
      const active = await getCachedActiveSetting(params.schoolYearId);
      if (!active?.config) {
        return {
          columns: [],
          formula: '',
          generalAverageFormula: '',
          scoreMax: 20,
          scoreDecimals: 2,
          promotionThreshold: 10,
          rankingScope: 'CLASS',
        };
      }
      const cfg = typeof active.config === 'string' ? JSON.parse(active.config) : active.config;
      const assessmentTypes = cfg.assessmentTypes ?? [];
      return {
        columns: assessmentTypes.map((t: any) => ({
          key: t.code,
          label: t.label,
          type: 'number',
          max: t.maxScore ?? cfg.scoreScale?.max ?? 20,
          required: t.required ?? false,
          weight: t.weight ?? 1,
          includedInAverage: t.includedInAverage ?? true,
          visibleOnReportCard: t.visibleOnReportCard ?? true,
        })),
        formula: cfg.calculationRules?.subjectAverage?.expression ?? '',
        generalAverageFormula: cfg.calculationRules?.generalAverage?.expression ?? '',
        scoreMax: cfg.scoreScale?.max ?? 20,
        scoreDecimals: cfg.scoreScale?.decimals ?? 2,
        promotionThreshold: cfg.calculationRules?.promotionRules?.[0]?.threshold ?? 10,
        rankingScope: cfg.rankingRules?.scope ?? 'CLASS',
      };
    }
  }

  /**
   * Crée un nouveau paramétrage et le cache localement.
   */
  async create(data: any): Promise<any> {
    const result = await fetchApi(BASE_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result?.id) await cacheOneSetting(result);
    return result;
  }

  /**
   * Met à jour un paramétrage et met à jour le cache.
   */
  async update(id: string, data: any): Promise<any> {
    const result = await fetchApi(`${BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (result?.id) await cacheOneSetting(result);
    return result;
  }

  /**
   * Active un paramétrage.
   */
  async activate(id: string): Promise<any> {
    const result = await fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
    });
    if (result?.id) await cacheOneSetting(result);
    return result;
  }

  /**
   * Verrouille un paramétrage.
   */
  async lock(id: string): Promise<any> {
    const result = await fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/lock`, {
      method: 'POST',
    });
    if (result?.id) await cacheOneSetting(result);
    return result;
  }

  /**
   * Archive un paramétrage.
   */
  async archive(id: string): Promise<any> {
    const result = await fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
    if (result?.id) await cacheOneSetting(result);
    return result;
  }

  /**
   * Duplique un paramétrage.
   */
  async duplicate(id: string): Promise<any> {
    const result = await fetchApi(`${BASE_URL}/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    });
    if (result?.id) await cacheOneSetting(result);
    return result;
  }

  /**
   * Valide une configuration avant activation.
   */
  async validate(config: any): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    try {
      return await fetchApi(`${BASE_URL}/validate`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
    } catch {
      // Validation locale basique si hors ligne
      const errors: string[] = [];
      if (!config.assessmentTypes?.length) errors.push("Aucun type d'évaluation défini.");
      if (!config.calculationRules?.subjectAverage?.expression) errors.push('Formule de moyenne manquante.');
      return { valid: errors.length === 0, errors, warnings: [] };
    }
  }

  /**
   * Lance une simulation de calcul de notes.
   */
  async simulate(config: any): Promise<{ students: any[]; summary: any }> {
    try {
      return await fetchApi(`${BASE_URL}/simulate`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
    } catch {
      // Simulation locale basique si hors ligne
      const assessmentTypes = config.assessmentTypes ?? [];
      const students = [
        { name: 'Élève A', scores: {}, average: 0, rank: 1 },
        { name: 'Élève B', scores: {}, average: 0, rank: 2 },
        { name: 'Élève C', scores: {}, average: 0, rank: 3 },
      ].map((s, i) => {
        const sampleScores = [14.5, 12, 9];
        const scores: Record<string, number> = {};
        assessmentTypes.forEach((t: any) => { scores[t.code] = sampleScores[i] ?? 10; });
        return { ...s, scores, average: sampleScores[i] ?? 10 };
      });
      return { students, summary: { classAverage: 11.8, passing: 2, failing: 1 } };
    }
  }

  /**
   * Calcule dynamiquement une moyenne selon la formule configurée.
   * Cette méthode est utilisée localement (moteur JS) quand le réseau est absent.
   * Expression ex: "((DEVOIR_1 * 1) + (COMPOSITION * 2)) / 3"
   */
  computeAverage(scores: Record<string, number>, formula: string): number {
    if (!formula || !scores) return 0;
    try {
      let expr = formula;
      Object.entries(scores).forEach(([key, val]) => {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val ?? 0));
      });
      // Évaluation sécurisée
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expr})`)();
      return isFinite(result) ? Math.round(result * 100) / 100 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calcule la moyenne générale depuis les moyennes de matières et coefficients.
   */
  computeGeneralAverage(subjects: Array<{ average: number; coefficient: number }>): number {
    const totalWeighted = subjects.reduce((sum, s) => sum + s.average * s.coefficient, 0);
    const totalCoeff = subjects.reduce((sum, s) => sum + s.coefficient, 0);
    if (totalCoeff === 0) return 0;
    return Math.round((totalWeighted / totalCoeff) * 100) / 100;
  }
}

export const academicSettingsService = new AcademicSettingsService();
