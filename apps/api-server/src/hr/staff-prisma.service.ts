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
    schoolLevelId?: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: Date;
    birthDate?: Date;
    phone?: string;
    email?: string;
    address?: string;
    position?: string;
    department?: string;
    roleType?: string;
    hireDate?: Date;
    contractType?: string;
    status?: string;
    salary?: number;
    bankDetails?: any;
    emergencyContact?: any;
    qualifications?: string;
    notes?: string;
  }) {
    // Vérifier l'unicité du numéro d'employé
    const existing = await this.prisma.staff.findUnique({
      where: { employeeNumber: data.employeeNumber },
    });

    if (existing) {
      throw new BadRequestException(`Staff with employee number ${data.employeeNumber} already exists`);
    }

    return this.prisma.staff.create({
      data: {
        ...data,
        birthDate: data.birthDate || data.dateOfBirth,
        roleType: data.roleType || 'TEACHER',
        status: data.status || 'ACTIVE',
      },
    });
  }

  /**
   * Récupère tous les membres du personnel
   */
  async findAllStaff(tenantId: string, filters?: {
    academicYearId?: string;
    schoolLevelId?: string;
    roleType?: string;
    status?: string;
  }) {
    const where: any = { tenantId };
    
    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    // Niveau scolaire : filtrer sauf en mode 'ALL'
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }
    if (filters?.roleType) {
      where.roleType = filters.roleType;
    }
    if (filters?.status) {
      where.status = filters.status;
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
          orderBy: { createdAt: 'desc' },
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
          orderBy: { createdAt: 'desc' },
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
          orderBy: { dateCompleted: 'desc' },
        },
        payrollItems: {
          take: 12,
          orderBy: { createdAt: 'desc' },
          include: {
            payroll: true,
          },
        },
        employeeCNSS: true,
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
      data: { status: 'ARCHIVED' },
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
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    documentType: string;
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    validated?: boolean;
    uploadedBy?: string;
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
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Valide un document
   */
  async validateDocument(id: string, tenantId: string) {
    const document = await this.prisma.staffDocument.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return this.prisma.staffDocument.update({
      where: { id },
      data: { validated: true },
    });
  }
}

