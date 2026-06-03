/**
 * ============================================================================
 * CNSS PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service de gestion CNSS, aligné sur le schéma Prisma réel.
 *
 * Modèles clés:
 *  - CNSSRate             : Taux CNSS par pays (countryCode, employeeRate, employerRate, salaryCeiling)
 *                          Pas de tenantId — global par pays
 *  - EmployeeCNSS         : Affiliation CNSS par agent (staffId unique, cnssNumber)
 *  - CNSSDeclaration      : Déclaration mensuelle (month, totalEmployeeShare, totalEmployerShare)
 *                          Statuts: DRAFT → SUBMITTED → PAID
 *  - CNSSDeclarationLine  : Ligne par agent affilié (employeeCNSSId, employeeShare, employerShare)
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
  // TAUX CNSS (CNSSRate — global par pays, pas par tenant)
  // ============================================================================

  /**
   * Récupère le taux CNSS actif pour un pays à une date donnée
   */
  async findActiveCNSSRate(countryCode: string, effectiveDate?: Date) {
    const date = effectiveDate ?? new Date();
    return this.prisma.cNSSRate.findFirst({
      where: {
        countryCode,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Crée ou met à jour un taux CNSS
   */
  async upsertCNSSRate(data: {
    countryCode: string;
    employeeRate: number;
    employerRate: number;
    salaryCeiling?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.cNSSRate.findFirst({
      where: {
        countryCode: data.countryCode,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.cNSSRate.update({
        where: { id: existing.id },
        data: {
          employeeRate: data.employeeRate,
          employerRate: data.employerRate,
          salaryCeiling: data.salaryCeiling ?? null,
          effectiveTo: data.effectiveTo ?? null,
        },
      });
    }

    return this.prisma.cNSSRate.create({
      data: {
        countryCode: data.countryCode,
        employeeRate: data.employeeRate,
        employerRate: data.employerRate,
        salaryCeiling: data.salaryCeiling ?? null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  // ============================================================================
  // EMPLOYEE CNSS (Affiliations)
  // ============================================================================

  /**
   * Récupère ou crée l'affiliation CNSS d'un agent
   */
  async findOrCreateEmployeeCNSS(
    staffId: string,
    tenantId: string,
    cnssNumber?: string,
  ) {
    const existing = await this.prisma.employeeCNSS.findUnique({
      where: { staffId },
    });

    if (existing) return existing;

    return this.prisma.employeeCNSS.create({
      data: {
        tenantId,
        staffId,
        cnssNumber: cnssNumber ?? null,
        affiliationDate: new Date(),
        isActive: true,
      },
    });
  }

  /**
   * Récupère toutes les affiliations CNSS d'un tenant
   */
  async findAllEmployeeCNSS(tenantId: string) {
    return this.prisma.employeeCNSS.findMany({
      where: { tenantId, isActive: true },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // ============================================================================
  // DÉCLARATIONS CNSS
  // ============================================================================

  /**
   * Crée une déclaration CNSS pour un mois donné
   * à partir des PayrollItems VALIDÉS/PAID du lot de paie correspondant.
   * Génère les lignes en utilisant la relation EmployeeCNSS.
   */
  async createCNSSDeclaration(data: {
    tenantId: string;
    academicYearId: string;
    month: string;
    notes?: string;
  }) {
    // Vérifier qu'il n'y a pas déjà une déclaration pour ce mois (unique constraint)
    const existing = await this.prisma.cNSSDeclaration.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        month: data.month,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Une déclaration CNSS existe déjà pour le mois ${data.month}.`,
      );
    }

    // Trouver le lot de paie correspondant au mois
    const payroll = await this.prisma.payroll.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        month: data.month,
        status: { in: ['VALIDATED', 'PAID'] },
      },
    });

    if (!payroll) {
      throw new BadRequestException(
        "Aucune paie validée pour ce mois. Validez d'abord la paie.",
      );
    }

    // Récupérer les lignes de paie avec affiliation CNSS via la relation EmployeeCNSS
    const payrollItems = await this.prisma.payrollItem.findMany({
      where: {
        payrollId: payroll.id,
        tenantId: data.tenantId,
      },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
          },
        },
      },
    });

    // Filtrer les agents avec affiliation CNSS active et numéro CNSS renseigné
    const itemsWithCNSS = payrollItems.filter(
      (item) =>
        item.staff.employeeCNSS?.isActive && item.staff.employeeCNSS?.cnssNumber,
    );

    if (itemsWithCNSS.length === 0) {
      throw new BadRequestException(
        'Aucun agent affilié CNSS dans ce lot de paie.',
      );
    }

    // Calculer les totaux
    let totalEmployeeShare = new Prisma.Decimal(0);
    let totalEmployerShare = new Prisma.Decimal(0);

    const linesToCreate: Array<{
      employeeCNSSId: string;
      grossSalary: Prisma.Decimal;
      employeeShare: Prisma.Decimal;
      employerShare: Prisma.Decimal;
    }> = [];

    for (const item of itemsWithCNSS) {
      const employeeShare = item.cnssEmployee;
      const employerShare = item.cnssEmployer;

      totalEmployeeShare = totalEmployeeShare.plus(employeeShare);
      totalEmployerShare = totalEmployerShare.plus(employerShare);

      linesToCreate.push({
        employeeCNSSId: item.staff.employeeCNSS!.id,
        grossSalary: item.grossSalary,
        employeeShare,
        employerShare,
      });
    }

    const totalAmount = totalEmployeeShare.plus(totalEmployerShare);

    // Créer la déclaration avec les lignes en transaction
    const declaration = await this.prisma.$transaction(async (tx) => {
      const decl = await tx.cNSSDeclaration.create({
        data: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          month: data.month,
          totalEmployeeShare,
          totalEmployerShare,
          totalAmount,
          status: 'DRAFT',
          notes: data.notes ?? null,
        },
      });

      // Créer les lignes de déclaration
      for (const line of linesToCreate) {
        await tx.cNSSDeclarationLine.create({
          data: {
            cnssDeclarationId: decl.id,
            employeeCNSSId: line.employeeCNSSId,
            grossSalary: line.grossSalary,
            employeeShare: line.employeeShare,
            employerShare: line.employerShare,
          },
        });
      }

      return decl;
    });

    // Retourner la déclaration complète avec ses lignes
    return this.prisma.cNSSDeclaration.findUnique({
      where: { id: declaration.id },
      include: {
        lines: {
          include: {
            employeeCNSS: {
              include: {
                staff: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Récupère toutes les déclarations d'un tenant avec le nombre de lignes
   */
  async findAllDeclarations(tenantId: string) {
    return this.prisma.cNSSDeclaration.findMany({
      where: { tenantId },
      include: {
        _count: { select: { lines: true } },
      },
      orderBy: { month: 'desc' },
    });
  }

  /**
   * Récupère une déclaration avec ses lignes incluant employeeCNSS.staff
   */
  async findDeclarationById(id: string, tenantId: string) {
    const decl = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
      include: {
        lines: {
          include: {
            employeeCNSS: {
              include: {
                staff: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!decl)
      throw new NotFoundException(`Déclaration CNSS ${id} introuvable.`);
    return decl;
  }

  /**
   * Finalise une déclaration (DRAFT → SUBMITTED → PAID)
   * Positionne declaredAt lors du passage à SUBMITTED
   * Positionne paidAt lors du passage à PAID
   */
  async finalizeDeclaration(
    id: string,
    tenantId: string,
    status: 'SUBMITTED' | 'PAID',
    paymentReference?: string,
    paymentProofPath?: string,
  ) {
    const declaration = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
    });

    if (!declaration) {
      throw new NotFoundException(`Déclaration CNSS ${id} introuvable.`);
    }

    // Valider la transition de statut
    if (
      status === 'SUBMITTED' &&
      declaration.status !== 'DRAFT'
    ) {
      throw new BadRequestException(
        'Seule une déclaration en brouillon peut être soumise.',
      );
    }

    if (
      status === 'PAID' &&
      declaration.status !== 'SUBMITTED'
    ) {
      throw new BadRequestException(
        'Seule une déclaration soumise peut être marquée comme payée.',
      );
    }

    const data: Prisma.CNSSDeclarationUpdateInput = { status };

    if (status === 'SUBMITTED') {
      data.declaredAt = new Date();
    }

    if (status === 'PAID') {
      data.paidAt = new Date();
      data.paymentReference = paymentReference ?? null;
      data.paymentProofPath = paymentProofPath ?? null;
    }

    return this.prisma.cNSSDeclaration.update({
      where: { id },
      data,
    });
  }
}
