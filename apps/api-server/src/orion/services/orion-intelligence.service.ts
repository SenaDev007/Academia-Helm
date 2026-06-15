/**
 * ============================================================================
 * ORION INTELLIGENCE ENGINES — Academic / Finance / HR / Compliance / Security
 * ============================================================================
 * Moteurs d'intelligence pour ORION, le cerveau analytique de la plateforme.
 * Chaque engine produit des analyses, alertes et recommandations.
 *
 * Conforme à la spécification v2.0 Tome 2
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenRouterService } from '../common/services/openrouter.service';
import { AIGateway } from '../ai/gateway/ai-gateway';
import {
  OrionDomain,
  ORIONScore,
  ORIONAlertItem,
  ORIONRecommendation,
  RiskLevel,
} from '../ai/types/ai.types';

@Injectable()
export class OrionIntelligenceService {
  private readonly logger = new Logger(OrionIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
    private readonly aiGateway: AIGateway,
  ) {}

  // ─── ORION SCORE ────────────────────────────────────────────────────────

  /**
   * Calcule le score ORION de l'établissement (0-100)
   * Pondération : Academic 35%, Finance 30%, HR 15%, Compliance 10%, Security 10%
   */
  async calculateOrionScore(tenantId: string): Promise<ORIONScore> {
    const [academicScore, financeScore, hrScore, complianceScore, securityScore] = await Promise.all([
      this.calculateAcademicScore(tenantId),
      this.calculateFinanceScore(tenantId),
      this.calculateHRScore(tenantId),
      this.calculateComplianceScore(tenantId),
      this.calculateSecurityScore(tenantId),
    ]);

    const globalScore = Math.round(
      academicScore * 0.35 +
      financeScore * 0.30 +
      hrScore * 0.15 +
      complianceScore * 0.10 +
      securityScore * 0.10,
    );

    const trend = await this.calculateTrend(tenantId, globalScore);
    const grade = this.scoreToGrade(globalScore);

    // Récupérer les alertes et recommandations prioritaires
    const topAlerts = await this.getTopAlerts(tenantId, 5);
    const topRecommendations = await this.getTopRecommendations(tenantId, 5);

    return {
      schoolId: tenantId,
      calculatedAt: new Date(),
      globalScore,
      subScores: {
        academic: academicScore,
        finance: financeScore,
        hr: hrScore,
        compliance: complianceScore,
        security: securityScore,
      },
      trend,
      grade,
      topAlerts,
      topRecommendations,
    };
  }

  // ─── ACADEMIC ENGINE ────────────────────────────────────────────────────

  /**
   * Score académique basé sur les résultats, assiduité, risques
   */
  private async calculateAcademicScore(tenantId: string): Promise<number> {
    try {
      // Taux de réussite
      const totalStudents = await this.prisma.student.count({
        where: { tenantId, status: 'ACTIVE' },
      });

      if (totalStudents === 0) return 50; // Score neutre si pas de données

      // Élèves à risque (basé sur les risk flags)
      const atRiskCount = await this.prisma.orionRiskFlag.count({
        where: { tenantId, entityType: 'STUDENT', riskLevel: { in: ['HIGH', 'CRITICAL'] } },
      });

      // KPI pédagogiques
      const pedagogyKpi = await this.prisma.kpiSnapshot.findFirst({
        where: { tenantId, definition: { category: 'PEDAGOGY' } },
        orderBy: { calculatedAt: 'desc' },
      });

      // Calcul du score
      const riskPenalty = Math.min((atRiskCount / totalStudents) * 100, 50);
      const baseKpiScore = pedagogyKpi?.numericValue ? Math.min(pedagogyKpi.numericValue, 100) : 60;

      return Math.max(0, Math.min(100, baseKpiScore - riskPenalty));
    } catch {
      return 50;
    }
  }

  // ─── FINANCE ENGINE ─────────────────────────────────────────────────────

  /**
   * Score financier basé sur le recouvrement, la trésorerie, les impayés
   */
  private async calculateFinanceScore(tenantId: string): Promise<number> {
    try {
      // KPI financier
      const financeKpi = await this.prisma.kpiSnapshot.findFirst({
        where: { tenantId, definition: { category: 'FINANCIAL' } },
        orderBy: { calculatedAt: 'desc' },
      });

      if (financeKpi?.numericValue) {
        return Math.min(Math.max(financeKpi.numericValue, 0), 100);
      }

      // Fallback : calcul basé sur les paiements
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalPayments, totalExpected] = await Promise.all([
        this.prisma.payment.aggregate({
          where: { tenantId, createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        this.prisma.feeConfiguration.aggregate({
          where: { tenantId },
          _sum: { amount: true },
        }),
      ]);

      const collectionRate = (totalExpected._sum.amount || 0) > 0
        ? ((totalPayments._sum.amount || 0) / totalExpected._sum.amount) * 100
        : 50;

      return Math.min(Math.max(Math.round(collectionRate), 0), 100);
    } catch {
      return 50;
    }
  }

  // ─── HR ENGINE ───────────────────────────────────────────────────────────

  /**
   * Score RH basé sur l'absentéisme, la charge de travail, le sous-effectif
   */
  private async calculateHRScore(tenantId: string): Promise<number> {
    try {
      const hrKpi = await this.prisma.kpiSnapshot.findFirst({
        where: { tenantId, definition: { category: 'HR' } },
        orderBy: { calculatedAt: 'desc' },
      });

      if (hrKpi?.numericValue) {
        return Math.min(Math.max(hrKpi.numericValue, 0), 100);
      }

      // Fallback : calcul basé sur les enseignants
      const activeTeachers = await this.prisma.teacher.count({
        where: { tenantId, status: 'ACTIVE' },
      });

      // Score basique basé sur le nombre d'enseignants
      if (activeTeachers >= 10) return 80;
      if (activeTeachers >= 5) return 65;
      if (activeTeachers >= 2) return 50;
      return 30;
    } catch {
      return 50;
    }
  }

  // ─── COMPLIANCE ENGINE ──────────────────────────────────────────────────

  /**
   * Score de conformité basé sur les dossiers, EDUCMASTER, réglementation
   */
  private async calculateComplianceScore(tenantId: string): Promise<number> {
    try {
      // Vérifier les dossiers incomplets
      const totalStudents = await this.prisma.student.count({
        where: { tenantId, status: 'ACTIVE' },
      });

      if (totalStudents === 0) return 70;

      // Dossiers avec documents manquants
      const incompleteDossiers = await this.prisma.studentDocument.groupBy({
        by: ['studentId'],
        where: { tenantId, status: 'MISSING' },
        _count: true,
      });

      const incompleteRatio = incompleteDossiers.length / totalStudents;
      return Math.max(0, Math.min(100, Math.round((1 - incompleteRatio) * 100)));
    } catch {
      return 50;
    }
  }

  // ─── SECURITY ENGINE ────────────────────────────────────────────────────

  /**
   * Score de sécurité basé sur les accès suspects, violations RBAC, audit
   */
  private async calculateSecurityScore(tenantId: string): Promise<number> {
    try {
      // Compter les accès refusés récents
      const recentDenied = await this.prisma.accessDeniedLog.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      // Score de base dégradé par les accès refusés
      const baseScore = 90;
      const penalty = Math.min(recentDenied * 2, 50);
      return Math.max(baseScore - penalty, 20);
    } catch {
      return 70;
    }
  }

  // ─── PREDICTION ENGINE ──────────────────────────────────────────────────

  /**
   * Analyse prédictive via l'AI Gateway
   */
  async predict(tenantId: string, userId: string, type: string): Promise<unknown> {
    return this.aiGateway.processRequest({
      agent: 'ORION',
      userId,
      tenantId,
      message: `Génère une prédiction de type ${type} pour l'établissement. 
Analyse les tendances historiques et produis une prédiction structurée avec :
- Prédiction chiffrée
- Niveau de confiance (0-100%)
- Facteurs contributeurs
- Facteurs de risque
- Recommandations d'action`,
    });
  }

  /**
   * Analyse complète d'un domaine via l'AI Gateway
   */
  async analyze(tenantId: string, userId: string, domain: OrionDomain): Promise<unknown> {
    return this.aiGateway.processRequest({
      agent: 'ORION',
      userId,
      tenantId,
      message: `Produis une analyse complète du domaine ${domain} de l'établissement.
Structure ta réponse en JSON avec :
- globalStats : statistiques globales
- alerts : alertes détectées (avec priorité CRITICAL/HIGH/MEDIUM/LOW)
- trends : tendances identifiées
- recommendations : recommandations actionnables
- riskAssessment : évaluation des risques`,
    });
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────

  private async calculateTrend(tenantId: string, currentScore: number): Promise<'IMPROVING' | 'STABLE' | 'DECLINING'> {
    try {
      const previousReport = await this.prisma.orionReport.findFirst({
        where: { tenantId, type: 'ORION_SCORE' },
        orderBy: { createdAt: 'desc' },
      });

      if (!previousReport) return 'STABLE';

      const previousScore = (previousReport.content as any)?.globalScore || currentScore;
      const diff = currentScore - previousScore;

      if (diff > 3) return 'IMPROVING';
      if (diff < -3) return 'DECLINING';
      return 'STABLE';
    } catch {
      return 'STABLE';
    }
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private async getTopAlerts(tenantId: string, limit: number): Promise<ORIONAlertItem[]> {
    try {
      const alerts = await this.prisma.orionAlert.findMany({
        where: { tenantId, acknowledged: false },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });

      return alerts.map((a: any) => ({
        id: a.id,
        domain: (a.alertType || 'OPERATIONAL') as OrionDomain,
        priority: (a.severity || 'MEDIUM') as any,
        title: a.title || 'Alerte',
        description: a.description || '',
        impact: a.description || '',
        suggestedAction: a.recommendedAction || '',
        canAtlasExecute: false,
        createdAt: a.createdAt,
      }));
    } catch {
      return [];
    }
  }

  private async getTopRecommendations(tenantId: string, limit: number): Promise<ORIONRecommendation[]> {
    try {
      const insights = await this.prisma.orionInsight.findMany({
        where: { tenantId, read: false },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });

      return insights.map((i: any) => ({
        id: i.id,
        domain: (i.category || 'ACADEMIC') as OrionDomain,
        priority: (i.priority || 'MEDIUM') as any,
        title: i.title || 'Recommandation',
        description: i.content || '',
        impact: i.content || '',
        suggestedAction: i.content || '',
        canAtlasExecute: false,
        status: 'PENDING' as const,
      }));
    } catch {
      return [];
    }
  }
}
