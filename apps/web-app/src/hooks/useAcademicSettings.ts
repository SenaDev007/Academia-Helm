/**
 * ============================================================================
 * useAcademicSettings — Hook React pour accéder à la configuration académique
 * ============================================================================
 *
 * Fournit la configuration active pour l'année scolaire courante.
 * Expose les helpers dérivés (getAppreciation, isPassingGrade, getScoreColor)
 * pour que les autres onglets du module n'aient pas à coder de règles en dur.
 *
 * Usage :
 *   const { config, loading, getAppreciation, isPassingGrade } = useAcademicSettings();
 *
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { academicSettingsService } from '@/services/academic-settings.service';
import { useModuleContext } from '@/hooks/useModuleContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GradingScale {
  min: number;
  max: number;
  label: string;
  color: string;
  appreciation?: string;
}

export interface AssessmentType {
  code: string;
  label: string;
  maxScore: number;
  weight: number;
  required: boolean;
  includedInAverage: boolean;
  visibleOnReportCard: boolean;
}

export interface AcademicConfig {
  country: string;
  educationSystem: string;
  gradingMode: string;
  periodType: string;
  scoreMin: number;
  scoreMax: number;
  scoreDecimals: number;
  assessmentTypes: AssessmentType[];
  mentions: GradingScale[];
  gradingScale: GradingScale[];
  subjectAverageFormula: string;
  generalAverageFormula: string;
  rankingScope: string;
  promotionThreshold: number;
}

export interface UseAcademicSettingsReturn {
  config: AcademicConfig | null;
  loading: boolean;
  error: string | null;
  /** Retourne la mention pour une moyenne donnée, ou '' si non trouvée */
  getAppreciation: (average: number) => string;
  /** Retourne la couleur Tailwind pour une moyenne donnée */
  getScoreColor: (average: number) => string;
  /** Retourne true si la moyenne est >= au seuil de passage */
  isPassingGrade: (average: number) => boolean;
  /** Note maximale (défaut: 20) */
  maxScore: number;
  /** Note de passage (défaut: 10) */
  passingScore: number;
  /** Décimales (défaut: 2) */
  decimals: number;
  reload: () => void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AcademicConfig = {
  country: 'Bénin',
  educationSystem: 'National',
  gradingMode: 'Numérique',
  periodType: 'Trimestre',
  scoreMin: 0,
  scoreMax: 20,
  scoreDecimals: 2,
  assessmentTypes: [],
  mentions: [
    { min: 16, max: 20, label: 'Très Bien', color: 'purple', appreciation: 'Félicitations du jury' },
    { min: 14, max: 15.99, label: 'Bien', color: 'blue', appreciation: 'Encouragements' },
    { min: 12, max: 13.99, label: 'Assez Bien', color: 'cyan', appreciation: "Tableau d'honneur" },
    { min: 10, max: 11.99, label: 'Passable', color: 'green', appreciation: '' },
    { min: 0, max: 9.99, label: 'Insuffisant', color: 'red', appreciation: 'Avertissement' },
  ],
  gradingScale: [],
  subjectAverageFormula: '',
  generalAverageFormula: '',
  rankingScope: 'CLASS',
  promotionThreshold: 10,
};

// ─── Color map ────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  purple: 'text-purple-700',
  blue: 'text-blue-700',
  cyan: 'text-cyan-700',
  indigo: 'text-indigo-700',
  green: 'text-green-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  orange: 'text-orange-700',
  red: 'text-red-700',
  rose: 'text-rose-700',
};

const BG_MAP: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  green: 'bg-green-100 text-green-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  rose: 'bg-rose-100 text-rose-700',
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAcademicSettings(): UseAcademicSettingsReturn {
  const { academicYear } = useModuleContext();
  const [config, setConfig] = useState<AcademicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!academicYear?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const active = await academicSettingsService.getActive(academicYear.id);

      if (active && active.config) {
        const cfg = typeof active.config === 'string'
          ? JSON.parse(active.config)
          : active.config;

        setConfig({
          country: cfg.country ?? DEFAULT_CONFIG.country,
          educationSystem: cfg.educationSystem ?? DEFAULT_CONFIG.educationSystem,
          gradingMode: cfg.gradingMode ?? DEFAULT_CONFIG.gradingMode,
          periodType: cfg.periodType ?? DEFAULT_CONFIG.periodType,
          scoreMin: cfg.scoreMin ?? DEFAULT_CONFIG.scoreMin,
          scoreMax: cfg.scoreMax ?? DEFAULT_CONFIG.scoreMax,
          scoreDecimals: cfg.scoreDecimals ?? DEFAULT_CONFIG.scoreDecimals,
          assessmentTypes: cfg.assessmentTypes ?? [],
          mentions: cfg.mentions?.length ? cfg.mentions : DEFAULT_CONFIG.mentions,
          gradingScale: cfg.gradingScale ?? cfg.mentions ?? DEFAULT_CONFIG.mentions,
          subjectAverageFormula: cfg.subjectAverageFormula ?? '',
          generalAverageFormula: cfg.generalAverageFormula ?? '',
          rankingScope: cfg.rankingRules?.[0]?.scope ?? 'CLASS',
          promotionThreshold: cfg.calculationRules?.promotionRules?.[0]?.threshold ?? 10,
        });
      } else {
        // Pas de config active — utiliser les valeurs par défaut
        setConfig(DEFAULT_CONFIG);
      }
    } catch {
      // Fail silently — on utilise les defaults pour ne pas bloquer l'UI
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived helpers ────────────────────────────────────────────────────────

  const effectiveConfig = config ?? DEFAULT_CONFIG;
  const scale = effectiveConfig.mentions;

  const getAppreciation = useCallback(
    (average: number): string => {
      const entry = scale.find((s) => average >= s.min && average <= s.max);
      return entry?.label ?? '';
    },
    [scale],
  );

  const getScoreColor = useCallback(
    (average: number): string => {
      const entry = scale.find((s) => average >= s.min && average <= s.max);
      if (!entry) return 'text-gray-700';
      return BG_MAP[entry.color] ?? 'bg-gray-100 text-gray-700';
    },
    [scale],
  );

  const isPassingGrade = useCallback(
    (average: number): boolean => {
      return average >= effectiveConfig.promotionThreshold;
    },
    [effectiveConfig.promotionThreshold],
  );

  return {
    config: effectiveConfig,
    loading,
    error,
    getAppreciation,
    getScoreColor,
    isPassingGrade,
    maxScore: effectiveConfig.scoreMax,
    passingScore: effectiveConfig.promotionThreshold,
    decimals: effectiveConfig.scoreDecimals,
    reload: load,
  };
}

export { BG_MAP, COLOR_MAP };
