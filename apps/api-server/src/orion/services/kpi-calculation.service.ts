/**
 * ============================================================================
 * KPI CALCULATION SERVICE - MODULE 8
 * ============================================================================
 * Service pour calculer et stocker les KPIs ORION
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class KPICalculationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule tous les KPIs système pour un tenant
   */
  async calculateSystemKPIs(tenantId: string, academicYearId?: string, schoolLevelId?: string) {
    const kpis: any[] = [];

    // 1. KPI Pédagogiques
    if (academicYearId && schoolLevelId) {
      // Taux d'absence
      const totalStudents = await this.prisma.student.count({
        where: { tenantId, academicYearId, schoolLevelId, status: 'ACTIVE' },
      });

      // Récupérer les absences via les classes du niveau
      const classes = await this.prisma.class.findMany({
        where: { tenantId, academicYearId, schoolLevelId },
        select: { id: true },
      });
      const classIds = classes.map(c => c.id);

      // Absence n'a pas academicYearId directement
      const totalAbsences = await this.prisma.absence.count({
        where: {
          tenantId,
          classId: { in: classIds },
          isJustified: false,
          date: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // 30 derniers jours
          },
        },
      });

      const absenceRate = totalStudents > 0 ? (totalAbsences / (totalStudents * 30)) * 100 : 0;
      kpis.push({
        code: 'TAUX_ABSENCE',
        name: 'Taux d\'absence',
        category: 'PEDAGOGICAL',
        scope: 'LEVEL',
        value: absenceRate,
        unit: '%',
      });

      // Taux d'échec - Grade n'a pas classId directement, filtrer via student -> studentEnrollment
      const totalGrades = await this.prisma.grade.count({
        where: {
          tenantId,
          academicYearId,
          score: { lt: 10 }, // Moins de 10/20
          student: {
            studentEnrollments: {
              some: {
                classId: { in: classIds },
                academicYearId,
              },
            },
          },
        },
      });

      const totalEvaluations = await this.prisma.grade.count({
        where: {
          tenantId,
          academicYearId,
          student: {
            studentEnrollments: {
              some: {
                classId: { in: classIds },
                academicYearId,
              },
            },
          },
        },
      });

      const failureRate = totalEvaluations > 0 ? (totalGrades / totalEvaluations) * 100 : 0;
      kpis.push({
        code: 'TAUX_ECHEC',
        name: 'Taux d\'échec',
        category: 'PEDAGOGICAL',
        scope: 'LEVEL',
        value: failureRate,
        unit: '%',
      });
    }

    // 2. KPI Financiers
    if (academicYearId) {
      // Taux d'impayé
      const totalFees = await this.prisma.studentFee.aggregate({
        where: { tenantId, academicYearId },
        _sum: { totalAmount: true },
      });

      const paidFees = await this.prisma.payment.aggregate({
        where: {
          tenantId,
          academicYearId,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      });

      const totalAmount = Number(totalFees._sum.totalAmount || 0);
      const paidAmount = Number(paidFees._sum.amount || 0);
      const unpaidRate = totalAmount > 0 ? ((totalAmount - paidAmount) / totalAmount) * 100 : 0;

      kpis.push({
        code: 'TAUX_IMPAYE',
        name: 'Taux d\'impayé',
        category: 'FINANCIAL',
        scope: 'TENANT',
        value: unpaidRate,
        unit: '%',
      });

      // Trésorerie
      const latestClosure = await this.prisma.dailyClosure.findFirst({
        where: {
          tenantId,
          academicYearId,
          validated: true,
        },
        orderBy: { date: 'desc' },
      });

      kpis.push({
        code: 'TRESORERIE',
        name: 'Trésorerie actuelle',
        category: 'FINANCIAL',
        scope: 'TENANT',
        value: Number(latestClosure?.closingBalance || 0),
        unit: 'XOF',
      });
    }

    // 3. KPI RH
    if (academicYearId) {
      // Taux de présence du personnel
      const totalStaff = await this.prisma.staff.count({
        where: { tenantId, status: 'ACTIVE' },
      });

      // Compter les jours de présence (approximation - compter toutes les présences)
      const presentDays = await this.prisma.staffAttendance.count({
        where: {
          tenantId,
          academicYearId,
          status: 'PRESENT',
          date: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          },
        },
      });
      
      // Pour un taux plus précis, il faudrait utiliser groupBy pour compter les staffId distincts
      // Pour l'instant, on utilise une approximation
      const presentStaff = Math.min(presentDays, totalStaff); // Approximation

      const attendanceRate = totalStaff > 0 ? (presentStaff / totalStaff) * 100 : 0;
      kpis.push({
        code: 'TAUX_PRESENCE_PERSONNEL',
        name: 'Taux de présence du personnel',
        category: 'RH',
        scope: 'TENANT',
        value: attendanceRate,
        unit: '%',
      });

      // Masse salariale
      const payrollTotal = await this.prisma.payroll.aggregate({
        where: {
          tenantId,
          academicYearId,
          status: 'VALIDATED',
          month: new Date().toISOString().slice(0, 7),
        },
        _sum: { totalAmount: true },
      });

      kpis.push({
        code: 'MASSE_SALARIALE',
        name: 'Masse salariale mensuelle',
        category: 'RH',
        scope: 'TENANT',
        value: Number(payrollTotal._sum.totalAmount || 0),
        unit: 'XOF',
      });
    }

    // 4. KPI QHSE
    if (academicYearId) {
      // Nombre d'incidents critiques
      const criticalIncidents = await this.prisma.incident.count({
        where: {
          tenantId,
          academicYearId,
          severity: 'CRITICAL',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      });

      kpis.push({
        code: 'INCIDENTS_CRITIQUES',
        name: 'Incidents critiques en cours',
        category: 'QHSE',
        scope: 'TENANT',
        value: criticalIncidents,
        unit: 'nombre',
      });
    }

    return kpis;
  }

  /**
   * Enregistre une valeur KPI
   */
  async saveKPISnapshot(tenantId: string, data: {
    kpiId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    value: number;
    period?: string;
    metadata?: any;
  }) {
    return this.prisma.kpiSnapshot.create({
      data: {
        tenantId,
        ...data,
        computedAt: new Date(),
      },
    });
  }

  /**
   * Récupère toutes les définitions de KPI
   */
  async findAllKpiDefinitions(tenantId?: string) {
    return this.prisma.kpiDefinition.findMany({
      where: {
        ...(tenantId ? { tenantId } : { isSystem: true, tenantId: null }),
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Récupère les valeurs KPI pour un tenant
   */
  async findKPISnapshots(tenantId: string, filters?: {
    academicYearId?: string;
    schoolLevelId?: string;
    kpiId?: string;
    category?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: any = { tenantId };
    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }
    if (filters?.kpiId) {
      where.kpiId = filters.kpiId;
    }
    if (filters?.fromDate || filters?.toDate) {
      where.computedAt = {};
      if (filters.fromDate) {
        where.computedAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.computedAt.lte = filters.toDate;
      }
    }

    return this.prisma.kpiSnapshot.findMany({
      where,
      include: {
        kpi: true,
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
      orderBy: { computedAt: 'desc' },
    });
  }

  /**
   * Crée ou met à jour une définition de KPI
   */
  async upsertKpiDefinition(tenantId: string, data: {
    code: string;
    name: string;
    description?: string;
    scope: string;
    category?: string;
    unit?: string;
    formula?: string;
    isSystem?: boolean;
  }) {
    return this.prisma.kpiDefinition.upsert({
      where: {
        tenantId_code: { tenantId: data.isSystem ? null : tenantId, code: data.code },
      },
      update: data,
      create: {
        tenantId: data.isSystem ? null : tenantId,
        ...data,
      },
    });
  }
}

