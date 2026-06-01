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

@Injectable()
export class ContractsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un contrat de travail
   */
  async createContract(data: {
    tenantId: string;
    academicYearId?: string;
    staffId: string;
    contractType: string;
    startDate: Date;
    endDate?: Date;
    baseSalary?: number;
    paymentMode?: string;
    status?: string;
    terms?: any;
    templateId?: string;
  }) {
    // Désactiver l'éventuel contrat actif existant
    const activeContract = await this.prisma.contract.findFirst({
      where: { staffId: data.staffId, status: 'ACTIVE' },
    });
    if (activeContract) {
      await this.prisma.contract.update({
        where: { id: activeContract.id },
        data: { status: 'EXPIRED' },
      });
    }

    return this.prisma.contract.create({
      data: {
        tenantId: data.tenantId,
        staffId: data.staffId,
        contractType: data.contractType,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        baseSalary: data.baseSalary ?? 0,
        paymentMode: data.paymentMode ?? 'BANK',
        status: data.status ?? 'ACTIVE',
        terms: data.terms ?? null,
        templateId: data.templateId ?? null,
        academicYearId: data.academicYearId ?? null,
      },
      include: { staff: true },
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

    return this.prisma.contract.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffCode: true,
            position: true,
            category: true,
          },
        },
        template: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Récupère un contrat par ID
   */
  async findContractById(id: string, tenantId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, tenantId },
      include: {
        staff: true,
        amendments: {
          orderBy: { effectiveDate: 'desc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return contract;
  }

  /**
   * Met à jour un contrat
   */
  async updateContract(id: string, tenantId: string, data: any) {
    const contract = await this.findContractById(id, tenantId);

    return this.prisma.contract.update({
      where: { id },
      data,
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
    return this.prisma.contractAmendment.create({
      data,
    });
  }

  /**
   * Termine un contrat
   */
  async terminateContract(id: string, tenantId: string) {
    const contract = await this.findContractById(id, tenantId);

    return this.prisma.contract.update({
      where: { id },
      data: {
        status: 'TERMINATED',
      },
    });
  }

  /**
   * Récupère le contrat actif d'un membre du personnel
   */
  async findActiveContract(staffId: string, tenantId: string) {
    return this.prisma.contract.findFirst({
      where: {
        staffId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        amendments: true,
      },
    });
  }
}

