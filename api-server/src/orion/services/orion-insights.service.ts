/**
 * ============================================================================
 * ORION INSIGHTS SERVICE - MODULE 8
 * ============================================================================
 * Service pour générer et gérer les insights ORION
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrionInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère des insights basés sur les données du tenant
   */
  async generateInsights(tenantId: string, academicYearId?: string, schoolLevelId?: string): Promise<any[]> {
    const insights: any[] = [];
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    // 1. Insight Finance : Tendances d'impayés
    const unpaidFees = await this.prisma.feeArrear.aggregate({
      where: {
        ...where,
        balanceDue: { gt: 0 },
      },
      _sum: { balanceDue: true },
      _count: true,
    });

    const totalUnpaid = Number(unpaidFees._sum.balanceDue || 0);
    if (unpaidFees._count > 0 && totalUnpaid > 1000000) {
      insights.push({
        category: 'FINANCE',
        title: 'Impayés significatifs détectés',
        content: `${unpaidFees._count} élève(s) ont des impayés totaux de ${(totalUnpaid / 1000000).toFixed(1)}M XOF. Il est recommandé de mettre en place un plan de recouvrement actif.`,
        priority: totalUnpaid > 5000000 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 2. Insight Pédagogie : Taux d'échec élevé
    if (academicYearId && schoolLevelId) {
      // Récupérer les classes du niveau
      const classes = await this.prisma.class.findMany({
        where: { tenantId, academicYearId, schoolLevelId },
        select: { id: true },
      });
      const classIds = classes.map(c => c.id);

      if (classIds.length > 0) {
        // Grade n'a pas classId directement, filtrer via student -> studentEnrollment
        // Note: groupBy avec having cause des erreurs TypeScript circulaires
        // Utiliser une approche alternative : récupérer les données puis filtrer
        const failingGrades = await this.prisma.grade.findMany({
          where: {
            tenantId,
            academicYearId,
            score: { lt: 10 },
            student: {
              studentEnrollments: {
                some: {
                  classId: { in: classIds },
                  academicYearId,
                },
              },
            },
          },
          select: {
            studentId: true,
          },
        });
        
        // Compter les étudiants avec plus de 2 notes < 10
        const studentCounts = failingGrades.reduce((acc, grade) => {
          acc[grade.studentId] = (acc[grade.studentId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const failingStudents = Object.entries(studentCounts)
          .filter(([_, count]) => count > 2)
          .map(([studentId]) => ({ studentId }));

        if (failingStudents.length > 0) {
          insights.push({
            category: 'PEDAGOGIE',
            title: `${failingStudents.length} élève(s) en difficulté`,
            content: `${failingStudents.length} élève(s) ont plus de 2 notes en dessous de 10/20. Il est recommandé de mettre en place un accompagnement personnalisé.`,
            priority: 'MEDIUM',
          });
        }
      }
    }

    // 3. Insight RH : Absences répétées
    const recentAbsences = await this.prisma.staffAttendance.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        ...(schoolLevelId && { schoolLevelId }),
        status: 'ABSENT',
        date: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
    });

    // Grouper par staffId manuellement
    const absenceCounts = recentAbsences.reduce((acc, absence) => {
      const staffId = absence.staffId;
      acc[staffId] = (acc[staffId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const highAbsenceStaff = Object.entries(absenceCounts)
      .filter(([_, count]) => count > 5)
      .map(([staffId]) => ({ staffId, count: absenceCounts[staffId] }));

    if (highAbsenceStaff.length > 0) {
      insights.push({
        category: 'RH',
        title: `${highAbsenceStaff.length} membre(s) du personnel avec absences répétées`,
        content: `${highAbsenceStaff.length} membre(s) du personnel ont plus de 5 absences sur les 30 derniers jours. Il est recommandé d'analyser les causes et de prendre les mesures appropriées.`,
        priority: 'MEDIUM',
      });
    }

    // 4. Insight QHSE : Incidents critiques non traités
    const criticalIncidents = await this.prisma.incident.count({
      where: {
        ...where,
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    if (criticalIncidents > 0) {
      insights.push({
        category: 'RISQUE',
        title: `${criticalIncidents} incident(s) critique(s) en attente`,
        content: `${criticalIncidents} incident(s) critique(s) nécessitent une attention immédiate. Il est recommandé de traiter ces incidents dans les plus brefs délais.`,
        priority: 'HIGH',
      });
    }

    return insights;
  }

  /**
   * Crée un insight
   */
  async createInsight(tenantId: string, data: {
    academicYearId?: string;
    schoolLevelId?: string;
    category: string;
    title: string;
    content: string;
    priority?: string;
    sourceData?: any;
  }) {
    return this.prisma.orionInsight.create({
      data: {
        tenantId,
        ...data,
        priority: data.priority || 'LOW',
      },
      include: {
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
    });
  }

  /**
   * Récupère tous les insights d'un tenant
   */
  async findAllInsights(tenantId: string, filters?: {
    academicYearId?: string;
    schoolLevelId?: string;
    category?: string;
    priority?: string;
    isRead?: boolean;
  }) {
    return this.prisma.orionInsight.findMany({
      where: {
        tenantId,
        ...filters,
      },
      include: {
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Marque un insight comme lu
   */
  async markInsightAsRead(tenantId: string, id: string) {
    return this.prisma.orionInsight.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Supprime un insight (seulement les anciens)
   */
  async deleteOldInsights(tenantId: string, olderThanDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.prisma.orionInsight.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });
  }
}

