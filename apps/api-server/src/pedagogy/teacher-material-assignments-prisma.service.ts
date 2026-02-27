/**
 * ============================================================================
 * TEACHER MATERIAL ASSIGNMENTS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des attributions de matériel aux enseignants
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTeacherMaterialAssignmentDto } from './dto/create-teacher-material-assignment.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';
import { MaterialMovementsPrismaService } from './material-movements-prisma.service';

@Injectable()
export class TeacherMaterialAssignmentsPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materialMovementsService: MaterialMovementsPrismaService,
  ) {}

  /**
   * Crée une attribution de matériel à un enseignant
   */
  async create(
    data: CreateTeacherMaterialAssignmentDto & {
      tenantId: string;
      academicYearId: string;
      performedById?: string;
    },
  ) {
    // Vérifier que le matériel existe
    const material = await this.prisma.pedagogicalMaterial.findFirst({
      where: {
        id: data.materialId,
        tenantId: data.tenantId,
        isActive: true,
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${data.materialId} not found or inactive`);
    }

    // Vérifier que l'enseignant existe
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: data.teacherId,
        tenantId: data.tenantId,
        schoolLevelId: data.schoolLevelId,
      },
    });

    if (!teacher) {
      throw new NotFoundException(
        `Teacher with ID ${data.teacherId} not found or not in the specified school level`,
      );
    }

    // R2: Vérifier que l'enseignant enseigne dans ce niveau
    const teacherLevel = await this.prisma.teacher.findFirst({
      where: {
        id: data.teacherId,
        tenantId: data.tenantId,
        schoolLevelId: data.schoolLevelId,
        status: 'active',
      },
    });

    if (!teacherLevel) {
      throw new BadRequestException(
        `Teacher ${data.teacherId} does not teach in school level ${data.schoolLevelId}`,
      );
    }

    // R4: Vérifier le stock disponible (validation stricte)
    const stock = await this.prisma.materialStock.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        materialId: data.materialId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId || null,
      },
    });

    if (!stock) {
      throw new BadRequestException(
        `No stock available for material ${data.materialId} in the specified context`,
      );
    }

    if (stock.quantityAvailable < data.quantity) {
      throw new BadRequestException(
        `Insufficient stock available. Available: ${stock.quantityAvailable}, Requested: ${data.quantity}`,
      );
    }

    // Créer l'attribution
    const assignment = await this.prisma.teacherMaterialAssignment.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        materialId: data.materialId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        quantity: data.quantity,
        conditionAtIssue: data.conditionAtIssue,
        notes: data.notes,
        signed: data.signed || false,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
          },
        },
        material: {
          select: { id: true, code: true, name: true, category: true },
        },
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // R3: Créer un mouvement de type ASSIGNMENT via le service (obligatoire pour traçabilité)
    // Le service MaterialMovements mettra à jour le stock automatiquement
    if (data.performedById) {
      await this.materialMovementsService.create({
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        materialId: data.materialId,
        movementType: 'ASSIGNMENT' as any, // Enum MaterialMovementType
        quantity: data.quantity,
        reference: `ASSIGN-${assignment.id}`,
        notes: `Assignment to teacher ${teacher.firstName} ${teacher.lastName}`,
        performedById: data.performedById,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
      });
    }

    return assignment;
  }

  /**
   * Récupère toutes les attributions (avec pagination)
   */
  async findAll(
    tenantId: string,
    academicYearId: string,
    pagination: PaginationDto,
    filters?: {
      teacherId?: string;
      materialId?: string;
      schoolLevelId?: string;
      classId?: string;
      signed?: boolean;
    },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (filters?.teacherId) {
      where.teacherId = filters.teacherId;
    }

    if (filters?.materialId) {
      where.materialId = filters.materialId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.signed !== undefined) {
      where.signed = filters.signed;
    }

    const [data, total] = await Promise.all([
      this.prisma.teacherMaterialAssignment.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              matricule: true,
            },
          },
          material: {
            select: { id: true, code: true, name: true, category: true },
          },
          schoolLevel: {
            select: { id: true, name: true, code: true },
          },
          class: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.teacherMaterialAssignment.count({ where }),
    ]);

    return createPaginatedResponse(data, total, pagination);
  }

  /**
   * Récupère une attribution par ID
   */
  async findOne(id: string, tenantId: string) {
    const assignment = await this.prisma.teacherMaterialAssignment.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            email: true,
          },
        },
        material: {
          include: {
            schoolLevel: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: { id: true, name: true, code: true },
        },
        signer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }

    return assignment;
  }

  /**
   * Signe une attribution
   */
  async sign(id: string, tenantId: string, signedBy: string) {
    const assignment = await this.findOne(id, tenantId);

    if (assignment.signed) {
      throw new BadRequestException('Assignment is already signed');
    }

    return this.prisma.teacherMaterialAssignment.update({
      where: { id },
      data: {
        signed: true,
        signedAt: new Date(),
        signedBy,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
          },
        },
        material: {
          select: { id: true, code: true, name: true },
        },
        signer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
