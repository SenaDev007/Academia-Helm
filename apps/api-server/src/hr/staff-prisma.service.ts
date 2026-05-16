/**
 * ============================================================================
 * STAFF PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion du personnel
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StaffPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un membre du personnel
   */
  async createStaff(data: {
    tenantId: string;
    academicYearId?: string;
    staffCode: string;
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: Date;
    nationalId?: string;
    cnssNumber?: string;
    maritalStatus?: string;
    numberOfChildren?: number;
    phone?: string;
    email?: string;
    address?: string;
    position?: string;
    category?: string;
    levelAssigned?: string;
    hireDate?: Date;
    status?: string;
    cnssStatus?: string;
  }) {
    // Vérifier l'unicité du code staff
    const existing = await this.prisma.staff.findUnique({
      where: { staffCode: data.staffCode },
    });

    if (existing) {
      throw new BadRequestException(`Staff with code ${data.staffCode} already exists`);
    }

    return this.prisma.staff.create({
      data: {
        ...data,
        category: data.category || 'PEDAGOGICAL',
        status: data.status || 'ACTIVE',
        cnssStatus: data.cnssStatus || 'NOT_DECLARED',
      },
    });
  }

  /**
   * Récupère tous les membres du personnel
   */
  async findAllStaff(tenantId: string, filters?: {
    academicYearId?: string;
    category?: string;
    status?: string;
    levelAssigned?: string;
  }) {
    const where: any = { tenantId };
    
    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.levelAssigned) {
      where.levelAssigned = filters.levelAssigned;
    }

    return this.prisma.staff.findMany({
      where,
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  /**
   * Récupère un membre du personnel par ID
   */
  async findStaffById(id: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId },
      include: {
        contracts: {
          orderBy: { startDate: 'desc' },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        attendance: {
          take: 30,
          orderBy: { date: 'desc' },
        },
        evaluations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        trainings: {
          orderBy: { createdAt: 'desc' },
        },
        payrolls: {
          take: 12,
          orderBy: { createdAt: 'desc' },
          include: {
            payrollPeriod: true,
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    return staff;
  }

  /**
   * Met à jour un membre du personnel
   */
  async updateStaff(id: string, tenantId: string, data: any) {
    const staff = await this.findStaffById(id, tenantId);

    return this.prisma.staff.update({
      where: { id },
      data,
    });
  }

  /**
   * Archive un membre du personnel
   */
  async archiveStaff(id: string, tenantId: string) {
    const staff = await this.findStaffById(id, tenantId);

    return this.prisma.staff.update({
      where: { id },
      data: { status: 'INACTIVE' }, // Conformément aux enums probables
    });
  }

  // ============================================================================
  // STAFF DOCUMENTS
  // ============================================================================

  /**
   * Ajoute un document à un membre du personnel
   */
  async addStaffDocument(data: {
    tenantId: string;
    staffId: string;
    type: string;
    fileUrl: string;
    version?: number;
  }) {
    return this.prisma.staffDocument.create({
      data,
    });
  }

  /**
   * Récupère tous les documents d'un membre du personnel
   */
  async findStaffDocuments(staffId: string, tenantId: string) {
    return this.prisma.staffDocument.findMany({
      where: {
        staffId,
        tenantId,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}

