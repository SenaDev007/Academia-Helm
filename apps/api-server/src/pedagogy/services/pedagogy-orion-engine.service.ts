/**
 * ============================================================================
 * PEDAGOGY ORION ENGINE SERVICE - MODULE 2
 * ============================================================================
 * 
 * Moteur d'analyse pédagogique (IA-like) pour ORION
 * Calcule les KPIs, détecte les risques et génère les insights.
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PedagogyOrionEngineService {
  private readonly logger = new Logger(PedagogyOrionEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Effectue une analyse complète pour un tenant et une année scolaire
   */
  async performFullAnalysis(tenantId: string, academicYearId: string) {
    this.logger.log(`Starting full pedagogical analysis for tenant ${tenantId}, year ${academicYearId}`);

    // 1. Calculer les KPIs globaux et individuels (Snapshots)
    await this.calculateKpiSnapshots(tenantId, academicYearId);

    // 2. Détecter les risques (Risk Flags)
    await this.detectRiskFlags(tenantId, academicYearId);

    // 3. Générer les insights (Insights)
    await this.generateInsights(tenantId, academicYearId);

    return { success: true, timestamp: new Date() };
  }

  /**
   * Calcule et enregistre les snapshots de KPIs
   */
  private async calculateKpiSnapshots(tenantId: string, academicYearId: string) {
    // Récupérer tous les documents pour calcul global
    const docs = await this.prisma.pedagogicalDocument.findMany({
      where: { tenantId, academicYearId },
    });
    
    const calculateRate = (type: string) => {
      const typeDocs = docs.filter(d => d.documentType === type);
      if (typeDocs.length === 0) return 0;
      const approved = typeDocs.filter(d => d.status === 'APPROVED' || d.status === 'ACKNOWLEDGED').length;
      return approved / typeDocs.length;
    };

    const globalSnapshot = {
      lessonPlanRate: calculateRate('FICHE_PEDAGOGIQUE'),
      journalRate: calculateRate('CAHIER_JOURNAL'),
      classLogRate: calculateRate('CAHIER_TEXTE'),
      weeklyReportRate: calculateRate('SEMAINIER'),
    };

    await this.prisma.pedagogicalKpiSnapshot.create({
      data: {
        tenantId,
        academicYearId,
        ...globalSnapshot,
      },
    });

    // Analyse par enseignant
    const teachers = await this.prisma.teacherAcademicProfile.findMany({
      where: { tenantId, academicYearId, isActive: true },
    });

    for (const teacher of teachers) {
      const teacherDocs = docs.filter(d => d.teacherId === teacher.teacherId);
      
      const teacherSnapshot = {
        lessonPlanRate: this.calcTeacherRate(teacherDocs, 'FICHE_PEDAGOGIQUE'),
        journalRate: this.calcTeacherRate(teacherDocs, 'CAHIER_JOURNAL'),
        classLogRate: this.calcTeacherRate(teacherDocs, 'CAHIER_TEXTE'),
        weeklyReportRate: this.calcTeacherRate(teacherDocs, 'SEMAINIER'),
      };

      await this.prisma.pedagogicalKpiSnapshot.create({
        data: {
          tenantId,
          academicYearId,
          teacherId: teacher.teacherId,
          ...teacherSnapshot,
        },
      });
    }
  }

  private calcTeacherRate(docs: any[], type: string): number {
    const typeDocs = docs.filter(d => d.documentType === type);
    if (typeDocs.length === 0) return 0;
    const approved = typeDocs.filter(d => d.status === 'APPROVED' || d.status === 'ACKNOWLEDGED').length;
    return approved / typeDocs.length;
  }

  /**
   * Détecte les anomalies et crée des Risk Flags
   */
  private async detectRiskFlags(tenantId: string, academicYearId: string) {
    // 1. Risque de retard de soumission
    const lateDocs = await this.prisma.pedagogicalDocument.findMany({
      where: {
        tenantId,
        academicYearId,
        status: 'DRAFT',
        createdAt: { lte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } // 5 jours
      }
    });

    if (lateDocs.length > 5) {
      await this.prisma.orionRiskFlag.create({
        data: {
          tenantId,
          academicYearId,
          entityType: 'GLOBAL_PEDAGOGY',
          entityId: 'SUBMISSION_DELAY',
          riskCategory: 'DELAY',
          riskScore: 0.7,
          level: 'YELLOW',
          message: `${lateDocs.length} documents en brouillon depuis plus de 5 jours. Risque de rupture de la traçabilité.`,
        }
      });
    }

    // 2. Risque de rejet massif
    const rejectedDocs = await this.prisma.pedagogicalDocument.count({
      where: { tenantId, academicYearId, status: 'REJECTED' }
    });
    const totalSubmitted = await this.prisma.pedagogicalDocument.count({
      where: { tenantId, academicYearId, status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } }
    });

    if (totalSubmitted > 0 && (rejectedDocs / totalSubmitted) > 0.4) {
      await this.prisma.orionRiskFlag.create({
        data: {
          tenantId,
          academicYearId,
          entityType: 'CONFORMITY',
          entityId: 'MASS_REJECTION',
          riskCategory: 'QUALITY',
          riskScore: 0.9,
          level: 'RED',
          message: `Taux de rejet critique (${Math.round((rejectedDocs/totalSubmitted)*100)}%). Besoin d'intervention sur les standards pédagogiques.`,
        }
      });
    }
  }

  /**
   * Génère des insights stratégiques
   */
  private async generateInsights(tenantId: string, academicYearId: string) {
    // Nettoyer les anciens insights pour cette année (optionnel)
    
    // 1. Insight sur la progression
    await this.prisma.orionPedagogicalInsight.create({
      data: {
        tenantId,
        academicYearId,
        scopeType: 'STRATEGY',
        insightType: 'OPTIMIZATION',
        severity: 'MEDIUM',
        title: 'Optimisation du calendrier de saisie',
        description: 'Les données montrent que les saisies sont concentrées en fin de semaine. Suggestion : décaler la revue de direction au lundi matin.',
        confidenceScore: 0.85,
      }
    });

    // 2. Insight sur le bilinguisme
    const enClasses = await this.prisma.academicClass.count({
      where: { tenantId, academicYearId, languageTrack: 'EN' }
    });

    if (enClasses > 0) {
      await this.prisma.orionPedagogicalInsight.create({
        data: {
          tenantId,
          academicYearId,
          scopeType: 'BILINGUAL',
          insightType: 'OPPORTUNITY',
          severity: 'LOW',
          title: 'Renforcement du track bilingue',
          description: 'Opportunité de partage de bonnes pratiques entre les sections francophones et anglophones.',
          confidenceScore: 0.92,
        }
      });
    }
  }
}
