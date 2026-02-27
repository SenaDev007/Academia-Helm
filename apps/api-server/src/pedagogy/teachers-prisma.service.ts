/**
 * ============================================================================
 * TEACHERS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des enseignants
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TeachersPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un matricule unique
   */
  private async generateMatricule(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TCH-${year}`;
    
    const count = await this.prisma.teacher.count({
      where: {
        tenantId,
        matricule: { startsWith: prefix },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Crée un enseignant
   */
  async createTeacher(data: {
    tenantId: string;
    schoolLevelId: string;
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: Date;
    address?: string;
    phone?: string;
    email?: string;
    departmentId?: string;
    position?: string;
    specialization?: string;
    hireDate?: Date;
    contractType?: string;
    status?: string;
  }) {
    const matricule = await this.generateMatricule(data.tenantId);

    return this.prisma.teacher.create({
      data: {
        ...data,
        matricule,
        status: data.status || 'active',
      },
      include: {
        schoolLevel: true,
        department: true,
      },
    });
  }

  /**
   * Récupère tous les enseignants
   */
  async findAllTeachers(
    tenantId: string,
    filters?: {
      schoolLevelId?: string;
      departmentId?: string;
      status?: string;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { matricule: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.teacher.findMany({
      where,
      include: {
        schoolLevel: true,
        department: true,
        teacherSubjects: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });
  }

  /**
   * Récupère un enseignant par ID
   */
  async findTeacherById(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        department: true,
        teacherSubjects: {
          include: {
            subject: true,
            academicYear: true,
          },
        },
        teacherClassAssignments: {
          include: {
            classSubject: {
              include: {
                class: true,
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    return teacher;
  }

  /**
   * Met à jour un enseignant
   */
  async updateTeacher(
    id: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      gender?: string;
      dateOfBirth?: Date;
      address?: string;
      phone?: string;
      email?: string;
      departmentId?: string;
      position?: string;
      specialization?: string;
      status?: string;
    }
  ) {
    await this.findTeacherById(id, tenantId);

    return this.prisma.teacher.update({
      where: { id },
      data,
      include: {
        schoolLevel: true,
        department: true,
      },
    });
  }

  /**
   * Archive un enseignant
   */
  async archiveTeacher(id: string, tenantId: string) {
    const teacher = await this.findTeacherById(id, tenantId);

    return this.prisma.teacher.update({
      where: { id },
      data: {
        status: 'archived',
      },
    });
  }
}

