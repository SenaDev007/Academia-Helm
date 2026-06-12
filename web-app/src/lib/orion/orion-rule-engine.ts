/**
 * ORION Rule Engine
 * 
 * Moteur de règles déterministes pour ORION
 * 
 * CONTRAINTES ABSOLUES :
 * - Règles explicites uniquement
 * - Aucun calcul probabiliste
 * - Aucune prédiction non justifiée
 * - Règles chargées depuis JSON versionné
 * 
 * ARCHITECTURE :
 * - Règles externalisées en JSON (traçables, auditables, évolutives)
 * - Indépendantes du code
 * - Versionnées
 */

import type {
  OrionAlert,
  OrionAlertLevel,
  OrionRule,
  OrionRulesVersion,
  RuleOperator,
  KpiFinancialMonthly,
  KpiHrMonthly,
  KpiPedagogyTerm,
  KpiSystemHealth,
  DirectionKpiSummary,
} from '@/types';

/**
 * Charge les règles ORION depuis le fichier JSON versionné
 */
export async function loadOrionRules(version = '1.0'): Promise<OrionRulesVersion> {
  try {
    const response = await fetch(`/orion-rules/orion_rules_v${version.replace('.', '_')}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load rules version ${version}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error loading ORION rules, using default:', error);
    // Fallback : règles par défaut
    return {
      version: '1.0',
      rules: [],
    };
  }
}

/**
 * Évalue une condition de règle
 */
function evaluateCondition(
  value: number,
  operator: RuleOperator,
  threshold: number
): boolean {
  switch (operator) {
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '==':
      return value === threshold;
    case '!=':
      return value !== threshold;
    default:
      return false;
  }
}

/**
 * Mappe la sévérité de règle vers le niveau d'alerte ORION
 */
function mapSeverityToAlertLevel(severity: string): OrionAlertLevel {
  switch (severity) {
    case 'CRITICAL':
      return 'CRITIQUE';
    case 'WARNING':
      return 'ATTENTION';
    case 'ALERT':
      return 'ATTENTION';
    case 'INFO':
      return 'INFO';
    default:
      return 'INFO';
  }
}

/**
 * Mappe la catégorie de règle vers la catégorie d'alerte ORION
 */
function mapCategoryToAlertCategory(category: string): 'FINANCIAL' | 'ACADEMIC' | 'OPERATIONAL' | 'COMPLIANCE' {
  switch (category) {
    case 'FINANCE':
      return 'FINANCIAL';
    case 'RH':
      return 'OPERATIONAL';
    case 'PEDAGOGY':
      return 'ACADEMIC';
    case 'SYSTEM':
      return 'OPERATIONAL';
    default:
      return 'OPERATIONAL';
  }
}

/**
 * Exécute une règle sur les données KPI financières
 */
function executeFinancialRule(
  rule: OrionRule,
  financialKpi: KpiFinancialMonthly
): OrionAlert | null {
  if (!rule.enabled || rule.category !== 'FINANCE') return null;

  const metricValue = (financialKpi as any)[rule.condition.metric];
  if (metricValue === undefined || metricValue === null) return null;

  const conditionMet = evaluateCondition(
    metricValue,
    rule.condition.operator,
    rule.condition.value
  );

  if (!conditionMet) return null;

  const level = mapSeverityToAlertLevel(rule.severity);
  const category = mapCategoryToAlertCategory(rule.category);

  return {
    id: `alert_${rule.id}_${Date.now()}`,
    level,
    category,
    title: rule.message,
    facts: [
      `Métrique : ${rule.condition.metric} = ${metricValue}`,
      `Seuil : ${rule.condition.operator} ${rule.condition.value}`,
    ],
    interpretation: rule.description || rule.message,
    vigilance: level === 'CRITIQUE'
      ? 'Situation critique nécessitant une analyse immédiate.'
      : level === 'ATTENTION'
      ? 'Point d\'attention nécessitant une surveillance.'
      : 'Information à prendre en compte.',
    dataSources: [
      {
        kpi: rule.condition.metric,
        value: metricValue,
        period: financialKpi.period,
        comparison: financialKpi.variationPercent !== undefined ? {
          previousValue: financialKpi.revenueExpected || 0,
          change: financialKpi.variationPercent,
          changePercent: financialKpi.variationPercent,
        } : undefined,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Exécute une règle sur les données KPI RH
 */
function executeHrRule(
  rule: OrionRule,
  hrKpi: KpiHrMonthly
): OrionAlert | null {
  if (!rule.enabled || rule.category !== 'RH') return null;

  const metricValue = (hrKpi as any)[rule.condition.metric];
  if (metricValue === undefined || metricValue === null) return null;

  const conditionMet = evaluateCondition(
    metricValue,
    rule.condition.operator,
    rule.condition.value
  );

  if (!conditionMet) return null;

  const level = mapSeverityToAlertLevel(rule.severity);
  const category = mapCategoryToAlertCategory(rule.category);

  return {
    id: `alert_${rule.id}_${Date.now()}`,
    level,
    category,
    title: rule.message,
    facts: [
      `Métrique : ${rule.condition.metric} = ${metricValue}%`,
      `Seuil : ${rule.condition.operator} ${rule.condition.value}%`,
      `Enseignants absents : ${hrKpi.teachersAbsent} / ${hrKpi.teachersTotal}`,
    ],
    interpretation: rule.description || rule.message,
    vigilance: level === 'CRITIQUE'
      ? 'Situation critique nécessitant une analyse immédiate des causes d\'absence.'
      : 'Surveiller l\'évolution du taux d\'absence et identifier les causes.',
    dataSources: [
      {
        kpi: rule.condition.metric,
        value: metricValue,
        period: hrKpi.period,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Exécute une règle sur les données KPI pédagogiques
 */
function executePedagogyRule(
  rule: OrionRule,
  pedagogyKpi: KpiPedagogyTerm
): OrionAlert | null {
  if (!rule.enabled || rule.category !== 'PEDAGOGY') return null;

  const metricValue = (pedagogyKpi as any)[rule.condition.metric];
  if (metricValue === undefined || metricValue === null) return null;

  const conditionMet = evaluateCondition(
    metricValue,
    rule.condition.operator,
    rule.condition.value
  );

  if (!conditionMet) return null;

  const level = mapSeverityToAlertLevel(rule.severity);
  const category = mapCategoryToAlertCategory(rule.category);

  return {
    id: `alert_${rule.id}_${Date.now()}`,
    level,
    category,
    title: rule.message,
    facts: [
      `Métrique : ${rule.condition.metric} = ${metricValue}%`,
      `Seuil : ${rule.condition.operator} ${rule.condition.value}%`,
      `Trimestre : ${pedagogyKpi.term}`,
      `Note moyenne : ${pedagogyKpi.averageScore}`,
    ],
    interpretation: rule.description || rule.message,
    vigilance: level === 'CRITIQUE'
      ? 'Situation critique nécessitant une analyse pédagogique approfondie.'
      : 'Analyser les causes du faible taux de réussite et mettre en place des mesures correctives.',
    dataSources: [
      {
        kpi: rule.condition.metric,
        value: metricValue,
        period: pedagogyKpi.term,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Exécute une règle sur les données KPI système
 */
function executeSystemRule(
  rule: OrionRule,
  systemHealthKpi: KpiSystemHealth
): OrionAlert | null {
  if (!rule.enabled || rule.category !== 'SYSTEM') return null;

  const metricValue = (systemHealthKpi as any)[rule.condition.metric];
  if (metricValue === undefined || metricValue === null) return null;

  const conditionMet = evaluateCondition(
    metricValue,
    rule.condition.operator,
    rule.condition.value
  );

  if (!conditionMet) return null;

  const level = mapSeverityToAlertLevel(rule.severity);
  const category = mapCategoryToAlertCategory(rule.category);

  return {
    id: `alert_${rule.id}_${Date.now()}`,
    level,
    category,
    title: rule.message,
    facts: [
      `Métrique : ${rule.condition.metric} = ${metricValue}`,
      `Seuil : ${rule.condition.operator} ${rule.condition.value}`,
    ],
    interpretation: rule.description || rule.message,
    vigilance: 'Vérifier la complétude des données KPI pour garantir la qualité des analyses.',
    dataSources: [
      {
        kpi: rule.condition.metric,
        value: metricValue,
        period: systemHealthKpi.period,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Exécute toutes les règles ORION sur les données KPI
 * 
 * @param rulesVersion Version des règles à utiliser
 * @param financialKpi KPI financier (optionnel)
 * @param hrKpi KPI RH (optionnel)
 * @param pedagogyKpis KPI pédagogiques (optionnel)
 * @param systemHealthKpi KPI santé système (optionnel)
 */
export async function executeOrionRules(
  rulesVersion: string | OrionRulesVersion = '1.0',
  financialKpi?: KpiFinancialMonthly | null,
  hrKpi?: KpiHrMonthly | null,
  pedagogyKpis?: KpiPedagogyTerm[],
  systemHealthKpi?: KpiSystemHealth | null
): Promise<OrionAlert[]> {
  // Charger les règles si nécessaire
  const rulesVersionData: OrionRulesVersion = typeof rulesVersion === 'string'
    ? await loadOrionRules(rulesVersion)
    : rulesVersion;

  const alerts: OrionAlert[] = [];

  // Exécuter les règles financières
  if (financialKpi) {
    for (const rule of rulesVersionData.rules) {
      if (rule.category === 'FINANCE') {
        const alert = executeFinancialRule(rule, financialKpi);
        if (alert) alerts.push(alert);
      }
    }
  }

  // Exécuter les règles RH
  if (hrKpi) {
    for (const rule of rulesVersionData.rules) {
      if (rule.category === 'RH') {
        const alert = executeHrRule(rule, hrKpi);
        if (alert) alerts.push(alert);
      }
    }
  }

  // Exécuter les règles pédagogiques
  if (pedagogyKpis && pedagogyKpis.length > 0) {
    for (const pedagogyKpi of pedagogyKpis) {
      for (const rule of rulesVersionData.rules) {
        if (rule.category === 'PEDAGOGY') {
          const alert = executePedagogyRule(rule, pedagogyKpi);
          if (alert) alerts.push(alert);
        }
      }
    }
  }

  // Exécuter les règles système
  if (systemHealthKpi) {
    for (const rule of rulesVersionData.rules) {
      if (rule.category === 'SYSTEM') {
        const alert = executeSystemRule(rule, systemHealthKpi);
        if (alert) alerts.push(alert);
      }
    }
  }

  return alerts;
}

/**
 * Fonctions de compatibilité (anciennes règles hardcodées)
 * Conservées pour rétrocompatibilité
 * 
 * Note: Les fonctions deprecated ont été supprimées car elles étaient redondantes
 * avec les implémentations actives ci-dessous.
 */

/**
 * Configuration des seuils d'alerte (explicites) - DEPRECATED
 * Utiliser les règles JSON versionnées
 */
export const ORION_ALERT_THRESHOLDS = {
  REVENUE_DROP_PERCENT: 10,
  LOW_RECOVERY_RATE: 85,
  HIGH_ABSENCE_RATE: 20,
  LOW_TEACHER_PRESENCE: 90,
  PAYMENT_DELAY_DAYS: 30,
  ENROLLMENT_DROP_PERCENT: 15,
} as const;

/**
 * Règle : Détecter une baisse de recettes
 */
export function detectRevenueDrop(
  current: DirectionKpiSummary,
  previous: DirectionKpiSummary | null
): OrionAlert | null {
  if (!previous) return null;

  const dropPercent = ((previous.totalRevenue - current.totalRevenue) / previous.totalRevenue) * 100;

  if (dropPercent >= ORION_ALERT_THRESHOLDS.REVENUE_DROP_PERCENT) {
    const level: OrionAlertLevel = dropPercent >= 20 ? 'CRITIQUE' : dropPercent >= 15 ? 'ATTENTION' : 'INFO';

    return {
      id: `alert_revenue_${Date.now()}`,
      level,
      category: 'FINANCIAL',
      title: `Baisse des recettes de ${dropPercent.toFixed(1)}%`,
      facts: [
        `Recettes actuelles : ${current.totalRevenue.toLocaleString()} ${current.currency}`,
        `Recettes précédentes : ${previous.totalRevenue.toLocaleString()} ${previous.currency}`,
        `Baisse : ${dropPercent.toFixed(1)}%`,
      ],
      interpretation: `Les recettes ont diminué de ${dropPercent.toFixed(1)}% par rapport à la période précédente. Cette baisse représente ${(previous.totalRevenue - current.totalRevenue).toLocaleString()} ${current.currency}.`,
      vigilance: level === 'CRITIQUE' 
        ? 'Situation critique nécessitant une analyse immédiate des causes de cette baisse significative.'
        : 'Surveiller l\'évolution des recettes et analyser les causes de cette diminution.',
      dataSources: [
        {
          kpi: 'totalRevenue',
          value: current.totalRevenue,
          period: current.periodLabel,
          comparison: {
            previousValue: previous.totalRevenue,
            change: -dropPercent,
            changePercent: -dropPercent,
          },
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Règle : Détecter un taux de recouvrement faible
 */
export function detectLowRecoveryRate(current: DirectionKpiSummary): OrionAlert | null {
  if (current.recoveryRate < ORION_ALERT_THRESHOLDS.LOW_RECOVERY_RATE) {
    const level: OrionAlertLevel = current.recoveryRate < 75 ? 'CRITIQUE' : current.recoveryRate < 80 ? 'ATTENTION' : 'INFO';

    return {
      id: `alert_recovery_${Date.now()}`,
      level,
      category: 'FINANCIAL',
      title: `Taux de recouvrement faible : ${current.recoveryRate}%`,
      facts: [
        `Taux de recouvrement actuel : ${current.recoveryRate}%`,
        `Seuil d'alerte : ${ORION_ALERT_THRESHOLDS.LOW_RECOVERY_RATE}%`,
      ],
      interpretation: `Le taux de recouvrement est de ${current.recoveryRate}%, inférieur au seuil de ${ORION_ALERT_THRESHOLDS.LOW_RECOVERY_RATE}%. Cela indique que ${100 - current.recoveryRate}% des paiements attendus ne sont pas encore encaissés.`,
      vigilance: level === 'CRITIQUE'
        ? 'Situation critique. Analyser les causes des retards de paiement et mettre en place un suivi renforcé.'
        : 'Surveiller l\'évolution du taux de recouvrement et contacter les familles en retard.',
      dataSources: [
        {
          kpi: 'recoveryRate',
          value: current.recoveryRate,
          period: current.periodLabel,
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Règle : Détecter une présence enseignants faible
 */
export function detectLowTeacherPresence(current: DirectionKpiSummary): OrionAlert | null {
  if (current.teacherPresenceRate < ORION_ALERT_THRESHOLDS.LOW_TEACHER_PRESENCE) {
    const level: OrionAlertLevel = current.teacherPresenceRate < 85 ? 'CRITIQUE' : 'ATTENTION';

    return {
      id: `alert_teacher_${Date.now()}`,
      level,
      category: 'OPERATIONAL',
      title: `Présence enseignants faible : ${current.teacherPresenceRate}%`,
      facts: [
        `Taux de présence actuel : ${current.teacherPresenceRate}%`,
        `Seuil d'alerte : ${ORION_ALERT_THRESHOLDS.LOW_TEACHER_PRESENCE}%`,
      ],
      interpretation: `Le taux de présence des enseignants est de ${current.teacherPresenceRate}%, inférieur au seuil de ${ORION_ALERT_THRESHOLDS.LOW_TEACHER_PRESENCE}%. Cela représente ${100 - current.teacherPresenceRate}% d'absences.`,
      vigilance: level === 'CRITIQUE'
        ? 'Situation critique. Analyser les causes des absences et mettre en place des mesures correctives.'
        : 'Surveiller l\'évolution de la présence et identifier les causes des absences.',
      dataSources: [
        {
          kpi: 'teacherPresenceRate',
          value: current.teacherPresenceRate,
          period: current.periodLabel,
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Exécute toutes les règles et génère les alertes (version legacy)
 * @deprecated Utiliser la version async executeOrionRules avec les règles JSON
 */
export function executeOrionRulesLegacy(
  current: DirectionKpiSummary,
  previous: DirectionKpiSummary | null
): OrionAlert[] {
  const alerts: OrionAlert[] = [];

  // Règle 1 : Baisse de recettes
  const revenueAlert = detectRevenueDrop(current, previous);
  if (revenueAlert) alerts.push(revenueAlert);

  // Règle 2 : Taux de recouvrement faible
  const recoveryAlert = detectLowRecoveryRate(current);
  if (recoveryAlert) alerts.push(recoveryAlert);

  // Règle 3 : Présence enseignants faible
  const teacherAlert = detectLowTeacherPresence(current);
  if (teacherAlert) alerts.push(teacherAlert);

  return alerts;
}

