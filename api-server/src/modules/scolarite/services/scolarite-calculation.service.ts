/**
 * ============================================================================
 * SCOLARITE CALCULATION SERVICE - CALCULS PAR MODULE SCOLARITE
 * ============================================================================
 * 
 * Service de calcul pour le module SCOLARITE.
 * Tous les calculs sont scoped à un tenant et un niveau scolaire.
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CalculationService, CalculationContext, CalculationResult } from '../../../common/services/calculation.service';

export interface ScolariteStatistics {
  totalStudents: number;
  activeStudents: number;
  totalClasses: number;
  totalAbsences: number;
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  absenceRate: number;
}

@Injectable()
export class ScolariteCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: CalculationService,
  ) {}

  /**
   * Calcule les statistiques du module SCOLARITE pour un niveau
   */
  async calculateStatistics(
    context: CalculationContext,
  ): Promise<CalculationResult<ScolariteStatistics>> {
    this.calculationService.validateCalculationContext(context);

    // Tous les calculs sont scoped à tenant + school_level
    const { tenantId, schoolLevelId } = context;

    // Compter les élèves
    const totalStudents = await this.prisma.student.count({
      where: { tenantId, schoolLevelId },
    });

    // Note: enrollmentStatus est dans StudentEnrollment, pas dans Student
    // Pour l'instant, on compte tous les étudiants comme actifs
    const activeStudents = await this.prisma.student.count({
      where: { tenantId, schoolLevelId },
    });

    // Compter les classes
    const totalClasses = await this.prisma.class.count({
      where: { tenantId, schoolLevelId },
    });

    // Compter les absences
    const totalAbsences = await this.prisma.absence.count({
      where: { tenantId, schoolLevelId },
    });

    const justifiedAbsences = await this.prisma.absence.count({
      where: { tenantId, schoolLevelId, isJustified: true },
    });

    const unjustifiedAbsences = totalAbsences - justifiedAbsences;

    // Calculer le taux d'absence
    const absenceRate = activeStudents > 0 
      ? (totalAbsences / activeStudents) * 100 
      : 0;

    const statistics: ScolariteStatistics = {
      totalStudents,
      activeStudents,
      totalClasses,
      totalAbsences,
      justifiedAbsences,
      unjustifiedAbsences,
      absenceRate: Math.round(absenceRate * 100) / 100,
    };

    // Log pour traçabilité
    this.calculationService.logCalculation(
      context,
      'scolarite_statistics',
      statistics,
      {
        calculationScope: 'school_level',
        timestamp: new Date().toISOString(),
      },
    );

    return this.calculationService.createCalculationResult(
      statistics,
      context,
      {
        calculationType: 'scolarite_statistics',
      },
    );
  }

  /**
   * Calcule les statistiques par classe
   */
  async calculateStatisticsByClass(
    context: CalculationContext,
    classId: string,
  ): Promise<CalculationResult<Partial<ScolariteStatistics>>> {
    this.calculationService.validateCalculationContext(context);

    const { tenantId, schoolLevelId } = context;

    // Vérifier que la classe appartient au tenant et au niveau
    const classEntity = await this.prisma.class.findFirst({
      where: { id: classId, tenantId, schoolLevelId },
    });

    if (!classEntity) {
      throw new Error(`Class ${classId} not found or does not belong to tenant/school level`);
    }

    // Note: classId et enrollmentStatus sont dans StudentEnrollment, pas dans Student
    // Pour l'instant, on compte tous les étudiants du niveau
    const totalStudents = await this.prisma.student.count({
      where: { tenantId, schoolLevelId },
    });

    const activeStudents = await this.prisma.student.count({
      where: { tenantId, schoolLevelId },
    });

    const totalAbsences = await this.prisma.absence.count({
      where: { tenantId, schoolLevelId, classId },
    });

    const statistics = {
      totalStudents,
      activeStudents,
      totalAbsences,
      absenceRate: activeStudents > 0 
        ? Math.round((totalAbsences / activeStudents) * 100 * 100) / 100 
        : 0,
    };

    this.calculationService.logCalculation(
      context,
      'scolarite_statistics_by_class',
      statistics,
      { classId },
    );

    return this.calculationService.createCalculationResult(
      statistics,
      context,
      { classId, calculationType: 'scolarite_statistics_by_class' },
    );
  }
}

