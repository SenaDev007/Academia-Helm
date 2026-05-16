/**
 * ============================================================================
 * CNSS PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 *
 * Service de gestion CNSS, aligné sur le schéma Prisma v2.
 *
 * Modèles clés:
 *  - PayrollRate      : Taux CNSS (cnssEmployeeRate / cnssEmployerRate) par tenant
 *  - CNSSDeclaration  : Déclaration par période (periodStart / periodEnd)
 *  - CNSSDeclarationLine : Ligne par agent
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CNSSPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // TAUX CNSS (PayrollRate)
  // ============================================================================

  /**
   * Récupère le taux CNSS actif pour un tenant à une date donnée
   */
  async findActiveCNSSRate(tenantId: string, effectiveDate?: Date) {
    const date = effectiveDate ?? new Date();
    return this.prisma.payrollRate.findFirst({
      where: {
        tenantId,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ============================================================================
  // DÉCLARATIONS CNSS
  // ============================================================================

  /**
   * Crée une déclaration CNSS pour une période donnée
   * à partir des lignes de paie VALIDÉES sur cette période
   */
  async createCNSSDeclaration(data: {
    tenantId: string;
    academicYearId?: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    // Vérifier qu'il n'y a pas déjà une déclaration qui chevauche
    const existing = await this.prisma.cNSSDeclaration.findFirst({
      where: {
        tenantId: data.tenantId,
        periodStart: { lte: data.periodEnd },
        periodEnd: { gte: data.periodStart },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Une déclaration CNSS existe déjà pour cette période.`,
      );
    }

    // Récupérer les lignes de paie validées sur la période
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        tenantId: data.tenantId,
        status: { in: ['VALIDATED', 'PAID'] },
        payrollPeriod: {
          startDate: { gte: data.periodStart },
          endDate: { lte: data.periodEnd },
        },
      },
      include: {
        staff: { select: { cnssNumber: true } },
      },
    });

    if (payrolls.length === 0) {
      throw new BadRequestException(
        'Aucune paie validée sur cette période. Validez d\'abord la paie.',
      );
    }

    // Totaux
    let totalGross = new Prisma.Decimal(0);
    let totalEmployee = new Prisma.Decimal(0);
    let totalEmployer = new Prisma.Decimal(0);

    const linesToCreate: Array<{
      staffId: string;
      grossSalary: Prisma.Decimal;
      employeeCNSS: Prisma.Decimal;
      employerCNSS: Prisma.Decimal;
    }> = [];

    for (const p of payrolls) {
      // Ne comptabiliser que les agents avec un numéro CNSS
      if (p.staff.cnssNumber) {
        totalGross = totalGross.plus(p.grossSalary);
        totalEmployee = totalEmployee.plus(p.employeeCNSS);
        totalEmployer = totalEmployer.plus(p.employerCNSS);

        linesToCreate.push({
          staffId: p.staffId,
          grossSalary: p.grossSalary,
          employeeCNSS: p.employeeCNSS,
          employerCNSS: p.employerCNSS,
        });
      }
    }

    // Créer la déclaration
    const declaration = await this.prisma.cNSSDeclaration.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        totalGross,
        totalEmployee,
        totalEmployer,
        status: 'DRAFT',
      },
    });

    // Créer les lignes
    for (const line of linesToCreate) {
      await this.prisma.cNSSDeclarationLine.create({
        data: {
          declarationId: declaration.id,
          staffId: line.staffId,
          grossSalary: line.grossSalary,
          employeeCNSS: line.employeeCNSS,
          employerCNSS: line.employerCNSS,
        },
      });
    }

    return this.prisma.cNSSDeclaration.findUnique({
      where: { id: declaration.id },
      include: {
        lines: true,
      },
    });
  }

  /**
   * Récupère toutes les déclarations d'un tenant
   */
  async findAllDeclarations(tenantId: string) {
    return this.prisma.cNSSDeclaration.findMany({
      where: { tenantId },
      include: {
        _count: { select: { lines: true } },
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  /**
   * Récupère une déclaration avec ses lignes
   */
  async findDeclarationById(id: string, tenantId: string) {
    const decl = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
      include: {
        lines: true,
      },
    });
    if (!decl) throw new NotFoundException(`Déclaration CNSS ${id} introuvable.`);
    return decl;
  }

  /**
   * Finalise une déclaration (GENERATED → SUBMITTED → PAID)
   */
  async finalizeDeclaration(
    id: string,
    tenantId: string,
    status: 'GENERATED' | 'SUBMITTED' | 'PAID',
  ) {
    const declaration = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
    });

    if (!declaration) {
      throw new NotFoundException(`Déclaration CNSS ${id} introuvable.`);
    }

    return this.prisma.cNSSDeclaration.update({
      where: { id },
      data: {
        status,
        generatedAt: status === 'GENERATED' ? new Date() : undefined,
        submittedAt: status === 'SUBMITTED' ? new Date() : undefined,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
    });
  }
}
