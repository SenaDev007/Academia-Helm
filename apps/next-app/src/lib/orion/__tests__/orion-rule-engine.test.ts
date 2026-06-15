/**
 * Tests Unitaires - ORION Rule Engine
 * 
 * Tests du moteur de règles déterministes
 */

import { describe, it, expect } from '@jest/globals';
import {
  detectRevenueDrop,
  detectLowRecoveryRate,
  detectLowTeacherPresence,
  executeOrionRulesLegacy,
  ORION_ALERT_THRESHOLDS,
} from '../orion-rule-engine';
import type { DirectionKpiSummary } from '@/types';

describe('ORION Rule Engine', () => {
  const createMockKpi = (overrides: Partial<DirectionKpiSummary> = {}): DirectionKpiSummary => ({
    totalStudents: 450,
    totalTeachers: 25,
    periodLabel: 'Janvier 2025',
    totalRevenue: 6750000,
    currency: 'XOF',
    recoveryRate: 92,
    teacherPresenceRate: 98,
    examsActivityIndex: 85,
    ...overrides,
  });

  describe('detectRevenueDrop', () => {
    it('ne doit pas générer d\'alerte si pas de données précédentes', () => {
      const current = createMockKpi();
      const alert = detectRevenueDrop(current, null);
      expect(alert).toBeNull();
    });

    it('ne doit pas générer d\'alerte si baisse < 10%', () => {
      const current = createMockKpi({ totalRevenue: 9000000 });
      const previous = createMockKpi({ totalRevenue: 10000000 });
      const alert = detectRevenueDrop(current, previous);
      expect(alert).toBeNull();
    });

    it('doit générer une alerte INFO si baisse entre 10% et 15%', () => {
      const current = createMockKpi({ totalRevenue: 8500000 });
      const previous = createMockKpi({ totalRevenue: 10000000 });
      const alert = detectRevenueDrop(current, previous);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('INFO');
      expect(alert?.category).toBe('FINANCIAL');
      expect(alert?.facts.length).toBeGreaterThan(0);
    });

    it('doit générer une alerte ATTENTION si baisse entre 15% et 20%', () => {
      const current = createMockKpi({ totalRevenue: 8000000 });
      const previous = createMockKpi({ totalRevenue: 10000000 });
      const alert = detectRevenueDrop(current, previous);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('ATTENTION');
    });

    it('doit générer une alerte CRITIQUE si baisse >= 20%', () => {
      const current = createMockKpi({ totalRevenue: 7500000 });
      const previous = createMockKpi({ totalRevenue: 10000000 });
      const alert = detectRevenueDrop(current, previous);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('CRITIQUE');
    });
  });

  describe('detectLowRecoveryRate', () => {
    it('ne doit pas générer d\'alerte si taux >= 85%', () => {
      const current = createMockKpi({ recoveryRate: 85 });
      const alert = detectLowRecoveryRate(current);
      expect(alert).toBeNull();
    });

    it('doit générer une alerte INFO si taux entre 80% et 85%', () => {
      const current = createMockKpi({ recoveryRate: 82 });
      const alert = detectLowRecoveryRate(current);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('INFO');
      expect(alert?.category).toBe('FINANCIAL');
    });

    it('doit générer une alerte ATTENTION si taux entre 75% et 80%', () => {
      const current = createMockKpi({ recoveryRate: 78 });
      const alert = detectLowRecoveryRate(current);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('ATTENTION');
    });

    it('doit générer une alerte CRITIQUE si taux < 75%', () => {
      const current = createMockKpi({ recoveryRate: 70 });
      const alert = detectLowRecoveryRate(current);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('CRITIQUE');
    });
  });

  describe('detectLowTeacherPresence', () => {
    it('ne doit pas générer d\'alerte si présence >= 90%', () => {
      const current = createMockKpi({ teacherPresenceRate: 90 });
      const alert = detectLowTeacherPresence(current);
      expect(alert).toBeNull();
    });

    it('doit générer une alerte ATTENTION si présence entre 85% et 90%', () => {
      const current = createMockKpi({ teacherPresenceRate: 88 });
      const alert = detectLowTeacherPresence(current);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('ATTENTION');
      expect(alert?.category).toBe('OPERATIONAL');
    });

    it('doit générer une alerte CRITIQUE si présence < 85%', () => {
      const current = createMockKpi({ teacherPresenceRate: 80 });
      const alert = detectLowTeacherPresence(current);
      
      expect(alert).not.toBeNull();
      expect(alert?.level).toBe('CRITIQUE');
    });
  });

  describe('executeOrionRules', () => {
    it('doit exécuter toutes les règles et retourner toutes les alertes', () => {
      const current = createMockKpi({
        totalRevenue: 7500000,
        recoveryRate: 70,
        teacherPresenceRate: 80,
      });
      const previous = createMockKpi({ totalRevenue: 10000000 });

      const alerts = executeOrionRulesLegacy(current, previous);

      expect(alerts.length).toBeGreaterThan(0);
      // Devrait détecter : baisse recettes, taux recouvrement faible, présence enseignants faible
    });

    it('ne doit pas générer d\'alerte si toutes les métriques sont normales', () => {
      const current = createMockKpi({
        totalRevenue: 10000000,
        recoveryRate: 95,
        teacherPresenceRate: 98,
      });
      const previous = createMockKpi({ totalRevenue: 10000000 });

      const alerts = executeOrionRulesLegacy(current, previous);

      expect(alerts.length).toBe(0);
    });
  });

  describe('ORION_ALERT_THRESHOLDS', () => {
    it('doit avoir des seuils définis explicitement', () => {
      expect(ORION_ALERT_THRESHOLDS.REVENUE_DROP_PERCENT).toBe(10);
      expect(ORION_ALERT_THRESHOLDS.LOW_RECOVERY_RATE).toBe(85);
      expect(ORION_ALERT_THRESHOLDS.HIGH_ABSENCE_RATE).toBe(20);
      expect(ORION_ALERT_THRESHOLDS.LOW_TEACHER_PRESENCE).toBe(90);
    });
  });
});

