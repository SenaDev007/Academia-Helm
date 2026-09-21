/**
 * ============================================================================
 * ACADEMIC SETTINGS SERVICE — Module Examen
 * ============================================================================
 *
 * Service frontend pour la gestion du paramétrage académique.
 * Utilise apiClient (Axios) qui ajoute automatiquement le token JWT.
 *
 * Règle d'or : aucune règle académique n'est codée en dur ici.
 * La configuration vient TOUJOURS de la base de données.
 * ============================================================================
 */

import apiClient from '@/lib/api/client';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { cachedGet } from '@/lib/api/get-cache';

const BASE_URL = getApiBaseUrl();

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
    // ⭐ V10c — CORRECTIF : le store IndexedDB créé par local-db.service.ts
    // s'appelle « schoolacademicsettings » (camelCase, miroir de la table
    // Prisma SchoolAcademicSettings). L'ancien nom « school_academic_settings »
    // n'existait PAS → NotFoundError à chaque écriture/lecture de cache.
    await db.executeBulk('schoolacademicsettings', 'put', settings);
  } catch (e) {
    console.warn('[AcademicSettings] Failed to cache settings locally:', e);
  }
}

async function cacheOneSetting(setting: any) {
  if (!setting) return;
  await cacheSettings([setting]);
}

async function getCachedSettings(): Promise<any[]> {
  const db = await getLocalDb();
  if (!db) return [];
  try {
    // ⭐ V10c — même correctif que cacheSettings : nom réel du store
    return await db.query('schoolacademicsettings', 'getAll');
  } catch {
    return [];
  }
}

async function getCachedActiveSetting(): Promise<any | null> {
  const all = await getCachedSettings();
  return all.find((s: any) => s.status === 'ACTIVE') || all[0] || null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const academicSettingsService = {
  /**
   * Récupère tous les paramétrages pour une année scolaire.
   */
  async getAll(schoolYearId?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (schoolYearId) params.schoolYearId = schoolYearId;
      const response = await apiClient.get('/exams/settings', { params });
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) await cacheSettings(data);
      return Array.isArray(data) ? data : [];
    } catch {
      console.warn('[AcademicSettings] Network unavailable, using local cache');
      return getCachedSettings();
    }
  },

  /**
   * Récupère le paramétrage ACTIF pour une année scolaire (avec scope optionnel).
   */
  async getActive(schoolYearId: string, scope?: {
    levelCode?: string;
    language?: string;
    secondaryCycle?: string;
    classId?: string;
  }): Promise<any> {
    // ⭐ FIX PERF (2026-09-21 — module Examen lent) : cache client 45 s +
    //    dédup des requêtes en vol. Ce paramétrage est demandé par TOUTES
    //    les pages du module (évaluations, notes, validation, bulletins…)
    //    à chaque montage — il ne change quasiment jamais pendant une
    //    session. Toute mutation via apiClient (sauvegarde du paramétrage)
    //    invalide le cache → fraîcheur garantie après écriture.
    const params: any = { schoolYearId };
    if (scope?.levelCode) params.levelCode = scope.levelCode;
    if (scope?.language) params.language = scope.language;
    if (scope?.secondaryCycle) params.secondaryCycle = scope.secondaryCycle;
    if (scope?.classId) params.classId = scope.classId;
    const qs = new URLSearchParams(Object.entries(params)).toString();
    return cachedGet(`GET:/exams/settings/active?${qs}`, async () => {
      try {
        const response = await apiClient.get('/exams/settings/active', { params });
        const data = response.data;
        if (data?.id) await cacheOneSetting(data);
        return data;
      } catch {
        console.warn('[AcademicSettings] Network unavailable, using cached active setting');
        return getCachedActiveSetting();
      }
    });
  },

  /**
   * Récupère un paramétrage par son identifiant.
   */
  async getById(id: string): Promise<any> {
    try {
      const response = await apiClient.get(`/exams/settings/${id}`);
      if (response.data?.id) await cacheOneSetting(response.data);
      return response.data;
    } catch {
      const all = await getCachedSettings();
      return all.find((s: any) => s.id === id) ?? null;
    }
  },

  /**
   * Schéma dynamique de saisie des notes.
   */
  async getScoreEntrySchema(params: {
    schoolYearId: string;
    cycleCode?: string;
    levelCode?: string;
    classId?: string;
    subjectId?: string;
    periodId?: string;
    language?: string;
    secondaryCycle?: string;
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
      qualitativeOptions?: string[];
    }>;
    formula: string;
    generalAverageFormula: string;
    scoreMax: number;
    scoreDecimals: number;
    promotionThreshold: number;
    rankingScope: string;
  }> {
    const response = await apiClient.get('/exams/settings/score-entry-schema', { params });
    return response.data;
  },

  /**
   * Crée un nouveau paramétrage (statut DRAFT).
   */
  async create(data: any): Promise<any> {
    const response = await apiClient.post('/exams/settings', data);
    if (response.data?.id) await cacheOneSetting(response.data);
    return response.data;
  },

  /**
   * Met à jour un paramétrage existant.
   */
  async update(id: string, data: any): Promise<any> {
    const response = await apiClient.patch(`/exams/settings/${id}`, data);
    if (response.data?.id) await cacheOneSetting(response.data);
    return response.data;
  },

  /**
   * Active un paramétrage (désactive les autres du même scope).
   */
  async activate(id: string): Promise<any> {
    const response = await apiClient.post(`/exams/settings/${id}/activate`);
    return response.data;
  },

  /**
   * Verrouille un paramétrage.
   */
  async lock(id: string): Promise<any> {
    const response = await apiClient.post(`/exams/settings/${id}/lock`);
    return response.data;
  },

  /**
   * Archive un paramétrage.
   */
  async archive(id: string): Promise<any> {
    const response = await apiClient.post(`/exams/settings/${id}/archive`);
    return response.data;
  },

  /**
   * Duplique un paramétrage.
   */
  async duplicate(id: string): Promise<any> {
    const response = await apiClient.post(`/exams/settings/${id}/duplicate`);
    return response.data;
  },

  /**
   * Valide une configuration (sans la persister).
   */
  async validate(config: any): Promise<{ valid: boolean; errors: string[] }> {
    const response = await apiClient.post('/exams/settings/validate', { config });
    return response.data;
  },

  /**
   * Simule une configuration avec 3 élèves fictifs.
   */
  async simulate(config: any): Promise<any> {
    const response = await apiClient.post('/exams/settings/simulate', { config });
    return response.data;
  },

  /**
   * Calcule une moyenne à partir d'une formule (local, pas d'API).
   */
  computeAverage(scores: Record<string, number>, formula: string): number {
    if (!formula || Object.keys(scores).length === 0) return 0;
    try {
      let expr = formula;
      for (const [key, value] of Object.entries(scores)) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value || 0));
      }
      const result = new Function(`return (${expr})`)() as number;
      return typeof result === 'number' && !isNaN(result) ? Math.round(result * 100) / 100 : 0;
    } catch {
      const values = Object.values(scores).filter(v => v != null);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
  },

  /**
   * Calcule la moyenne générale à partir des moyennes par matière.
   */
  computeGeneralAverage(subjects: Array<{ average: number; coefficient: number }>): number {
    if (!subjects || subjects.length === 0) return 0;
    let totalWeighted = 0;
    let totalCoef = 0;
    for (const s of subjects) {
      totalWeighted += s.average * (s.coefficient || 1);
      totalCoef += s.coefficient || 1;
    }
    return totalCoef > 0 ? Math.round((totalWeighted / totalCoef) * 100) / 100 : 0;
  },
};
