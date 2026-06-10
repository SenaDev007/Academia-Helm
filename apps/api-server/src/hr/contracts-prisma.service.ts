/**
 * ============================================================================
 * CONTRACTS PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des contrats de travail
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class ContractsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un contrat de travail
   */
  async createContract(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    contractType: string;
    startDate: Date;
    endDate?: Date;
    baseSalary?: number;
    paymentMode?: string;
    status?: string;
    terms?: any;
    templateId?: string;
    schoolLevelId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Désactiver l'éventuel contrat actif existant
      await tx.contract.updateMany({
        where: { staffId: data.staffId, tenantId: data.tenantId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      // Créer le nouveau contrat
      return tx.contract.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId: data.tenantId,
          staffId: data.staffId,
          contractType: data.contractType,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : null,
          baseSalary: new Prisma.Decimal(data.baseSalary ?? 0),
          paymentMode: data.paymentMode ?? 'BANK',
          status: data.status ?? 'ACTIVE',
          terms: data.terms ?? null,
          templateId: data.templateId ?? null,
          academicYearId: data.academicYearId ?? null,
          schoolLevelId: data.schoolLevelId ?? null,
        },
        include: { staff: true },
      });
    });
  }

  /**
   * Récupère tous les contrats
   */
  async findAllContracts(tenantId: string, filters?: {
    staffId?: string;
    type?: string;
    status?: string;
  }) {
    const where: any = { tenantId };
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.type) where.contractType = filters.type;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;

    const contracts = await this.prisma.contract.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            position: true,
            roleType: true,
          },
        },
        template: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    // Add staffCode alias so frontend can access contract.staff.staffCode
    return contracts.map(c => ({
      ...c,
      staff: c.staff ? { ...c.staff, staffCode: c.staff.employeeNumber } : c.staff,
    }));
  }

  /**
   * Récupère un contrat par ID
   */
  async findContractById(id: string, tenantId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
            email: true,
            phone: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            schools: { select: { address: true } },
            country: { select: { name: true, currencyCode: true } },
          },
        },
        academicYear: {
          select: { id: true, name: true },
        },
        template: { select: { id: true, name: true } },
        amendments: {
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    // Add staffCode alias so frontend can access contract.staff.staffCode
    return {
      ...contract,
      staff: contract.staff ? { ...contract.staff, staffCode: contract.staff.employeeNumber } : contract.staff,
    };
  }

  /**
   * Met à jour un contrat
   */
  async updateContract(id: string, tenantId: string, data: any) {
    await this.findContractById(id, tenantId);

    const updateData: any = {};
    const allowedFields = [
      'contractType', 'startDate', 'endDate', 'baseSalary', 'paymentMode',
      'status', 'terms', 'templateId', 'academicYearId', 'schoolLevelId',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Convert date fields
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    if (updateData.baseSalary !== undefined) updateData.baseSalary = new Prisma.Decimal(updateData.baseSalary);

    return this.prisma.contract.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), ...updateData },
    });
  }

  /**
   * Crée un avenant (Amendment) au contrat
   */
  async createAmendment(data: {
    tenantId: string;
    contractId: string;
    amendmentType: string;
    description: string;
    previousValue?: string;
    newValue?: string;
    effectiveDate: Date;
  }) {
    // Verify contract exists within tenant
    const contract = await this.prisma.contract.findFirst({
      where: { id: data.contractId, tenantId: data.tenantId },
    });
    if (!contract) {
      throw new NotFoundException(
        `Contract ${data.contractId} not found in tenant`,
      );
    }

    return this.prisma.contractAmendment.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        contractId: data.contractId,
        amendmentType: data.amendmentType,
        description: data.description,
        previousValue: data.previousValue ?? null,
        newValue: data.newValue ?? null,
        effectiveDate: data.effectiveDate,
        status: 'DRAFT',
      },
    });
  }

  /**
   * Termine un contrat — Résiliation professionnelle.
   *
   * Si updateStaffStatus est true (ou non spécifié et c'est le seul contrat actif du staff),
   * le statut du staff est également mis à jour en INACTIVE avec les détails de la résiliation.
   */
  async terminateContract(
    id: string,
    tenantId: string,
    terminationReason?: string,
    options?: {
      terminatedAt?: Date;
      terminationType?: string;
      updateStaffStatus?: boolean;
    },
  ) {
    const contract = await this.findContractById(id, tenantId);
    const terminatedAt = options?.terminatedAt || new Date();

    // Determine if we should update staff status
    const shouldUpdateStaff = options?.updateStaffStatus !== false; // default true

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Terminate the contract
      const terminated = await tx.contract.update({
        where: { id },
        data: {
          ...prismaUpdateDefaults(),
          status: 'TERMINATED',
          terminatedAt,
          terminationReason: terminationReason || null,
        },
      });

      // 2. Check if this was the only active contract for the staff
      const remainingActiveContracts = await tx.contract.count({
        where: {
          staffId: contract.staffId,
          tenantId,
          status: 'ACTIVE',
          id: { not: id },
        },
      });

      // 3. Update staff status if no more active contracts and updateStaffStatus is true
      if (shouldUpdateStaff && remainingActiveContracts === 0) {
        const staffUpdateData: any = {
          ...prismaUpdateDefaults(),
          status: 'INACTIVE',
          terminatedAt,
          terminationType: options?.terminationType || 'END_OF_CONTRACT',
          lastWorkingDate: terminatedAt,
        };

        // Build termination details
        const terminationDetails = {
          terminationType: options?.terminationType || 'END_OF_CONTRACT',
          terminationLabel: 'Résiliation de contrat',
          effectiveDate: terminatedAt.toISOString(),
          lastWorkingDate: terminatedAt.toISOString(),
          reason: terminationReason || null,
          contractTerminated: {
            id: contract.id,
            contractType: contract.contractType,
            startDate: contract.startDate,
            baseSalary: Number(contract.baseSalary),
          },
          automaticStaffUpdate: true,
        };
        staffUpdateData.terminationDetails = terminationDetails;

        await tx.staff.update({
          where: { id: contract.staffId },
          data: staffUpdateData,
        });
      }

      return terminated;
    });

    return result;
  }

  /**
   * Supprime un contrat (soft-delete : status → DELETED)
   */
  async deleteContract(id: string, tenantId: string) {
    const contract = await this.findContractById(id, tenantId);
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'DELETED',
      },
    });
  }

  /**
   * Récupère le contrat actif d'un membre du personnel
   */
  async findActiveContract(staffId: string, tenantId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        staffId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
          },
        },
        template: { select: { id: true, name: true } },
        amendments: {
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });

    // Add staffCode alias so frontend can access contract.staff.staffCode
    return contract ? {
      ...contract,
      staff: contract.staff ? { ...contract.staff, staffCode: contract.staff.employeeNumber } : contract.staff,
    } : null;
  }
}
