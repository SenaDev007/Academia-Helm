import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la gestion des réunions
 * (administratives, pédagogiques, parents)
 */
@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les réunions d'un tenant
   */
  async findAll(
    tenantId: string,
    options?: {
      academicYearId?: string;
      meetingType?: string;
      scopeType?: string;
      scopeId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { tenantId };

    if (options?.academicYearId) {
      where.academicYearId = options.academicYearId;
    }

    if (options?.meetingType) {
      where.meetingType = options.meetingType;
    }

    if (options?.scopeType) {
      where.scopeType = options.scopeType;
    }

    if (options?.scopeId) {
      if (options.scopeType === 'LEVEL') {
        where.schoolLevelId = options.scopeId;
      } else if (options.scopeType === 'CLASS') {
        where.classId = options.scopeId;
      } else if (options.scopeType === 'STUDENT') {
        where.studentId = options.scopeId;
      }
    }

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.startDate || options?.endDate) {
      where.meetingDate = {};
      if (options.startDate) {
        where.meetingDate.gte = options.startDate;
      }
      if (options.endDate) {
        where.meetingDate.lte = options.endDate;
      }
    }

    return this.prisma.meeting.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: {
          include: {
            inviter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        agendas: true,
        minutes: true,
        decisions: true,
        attachments: true,
      },
      orderBy: { meetingDate: 'desc' },
    });
  }

  /**
   * Récupère une réunion par ID
   */
  async findOne(id: string, tenantId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, tenantId },
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        cancelledByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: {
          include: {
            inviter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        agendas: {
          orderBy: { agendaOrder: 'asc' },
          include: {
            presenter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        minutes: {
          include: {
            recorder: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            validator: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        decisions: {
          orderBy: { decisionOrder: 'asc' },
          include: {
            responsible: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        attachments: {
          include: {
            uploader: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }

    return meeting;
  }

  /**
   * Crée une nouvelle réunion
   */
  async create(
    tenantId: string,
    data: {
      academicYearId: string;
      meetingType: string;
      scopeType: string;
      schoolLevelId?: string;
      classId?: string;
      studentId?: string;
      title: string;
      description?: string;
      meetingDate: Date;
      startTime?: string;
      endTime?: string;
      location?: string;
      locationOnline?: boolean;
      meetingLink?: string;
    },
    createdBy: string,
  ) {
    // Validation : scopeType doit correspondre aux champs fournis
    if (data.scopeType === 'LEVEL' && !data.schoolLevelId) {
      throw new BadRequestException('schoolLevelId is required when scopeType is LEVEL');
    }
    if (data.scopeType === 'CLASS' && !data.classId) {
      throw new BadRequestException('classId is required when scopeType is CLASS');
    }
    if (data.scopeType === 'STUDENT' && !data.studentId) {
      throw new BadRequestException('studentId is required when scopeType is STUDENT');
    }

    // Validation : date de réunion ne doit pas être dans le passé
    if (data.meetingDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      throw new BadRequestException('Meeting date cannot be in the past');
    }

    return this.prisma.meeting.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        meetingType: data.meetingType,
        scopeType: data.scopeType,
        schoolLevelId: data.schoolLevelId || null,
        classId: data.classId || null,
        studentId: data.studentId || null,
        title: data.title,
        description: data.description,
        meetingDate: data.meetingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        locationOnline: data.locationOnline || false,
        meetingLink: data.meetingLink,
        status: 'PLANNED',
        createdBy,
      },
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Met à jour une réunion
   */
  async update(
    id: string,
    tenantId: string,
    data: {
      title?: string;
      description?: string;
      meetingDate?: Date;
      startTime?: string;
      endTime?: string;
      location?: string;
      locationOnline?: boolean;
      meetingLink?: string;
      status?: string;
    },
  ) {
    const existing = await this.findOne(id, tenantId);

    // Validation : ne pas modifier une réunion tenue
    if (existing.status === 'HELD') {
      throw new BadRequestException('Cannot modify a meeting that has already been held');
    }

    // Validation : date de réunion ne doit pas être dans le passé
    if (data.meetingDate && data.meetingDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      throw new BadRequestException('Meeting date cannot be in the past');
    }

    return this.prisma.meeting.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Annule une réunion
   */
  async cancel(
    id: string,
    tenantId: string,
    reason: string,
    cancelledBy: string,
  ) {
    const existing = await this.findOne(id, tenantId);

    // Validation : ne pas annuler une réunion déjà tenue
    if (existing.status === 'HELD') {
      throw new BadRequestException('Cannot cancel a meeting that has already been held');
    }

    return this.prisma.meeting.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        cancelledReason: reason,
        updatedAt: new Date(),
      },
      include: {
        cancelledByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Marque une réunion comme tenue
   */
  async markAsHeld(id: string, tenantId: string) {
    const existing = await this.findOne(id, tenantId);

    if (existing.status === 'HELD') {
      throw new BadRequestException('Meeting is already marked as held');
    }

    return this.prisma.meeting.update({
      where: { id },
      data: {
        status: 'HELD',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Récupère les réunions à venir
   */
  async getUpcoming(tenantId: string, academicYearId?: string) {
    const where: any = {
      tenantId,
      status: { in: ['PLANNED', 'POSTPONED'] },
      meetingDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    return this.prisma.meeting.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: true,
      },
      orderBy: { meetingDate: 'asc' },
    });
  }

  /**
   * Récupère l'historique des réunions
   */
  async getHistory(tenantId: string, academicYearId?: string) {
    const where: any = {
      tenantId,
      status: { in: ['HELD', 'CANCELLED'] },
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    return this.prisma.meeting.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: true,
        minutes: true,
        decisions: true,
      },
      orderBy: { meetingDate: 'desc' },
    });
  }
}

