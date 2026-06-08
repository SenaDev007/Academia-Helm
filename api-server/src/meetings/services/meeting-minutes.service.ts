import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la gestion des comptes rendus de réunions
 */
@Injectable()
export class MeetingMinutesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le compte rendu d'une réunion
   */
  async findByMeeting(meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    return this.prisma.meetingMinutes.findUnique({
      where: { meetingId },
      include: {
        template: true,
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
        history: {
          orderBy: { version: 'desc' },
          include: {
            modifier: {
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
      },
    });
  }

  /**
   * Crée ou met à jour le compte rendu d'une réunion
   */
  async createOrUpdate(
    meetingId: string,
    tenantId: string,
    data: {
      content: string;
      language?: string; // FR | EN
    },
    recordedBy: string,
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Vérifier que la réunion a été tenue ou est planifiée
    if (meeting.status === 'CANCELLED') {
      throw new BadRequestException('Cannot create minutes for a cancelled meeting');
    }

    const existing = await this.prisma.meetingMinutes.findUnique({
      where: { meetingId },
    });

    // Si le compte rendu existe déjà et est validé, ne pas permettre la modification
    if (existing && existing.validated) {
      throw new BadRequestException('Cannot modify validated minutes');
    }

    if (existing) {
      return this.prisma.meetingMinutes.update({
        where: { meetingId },
        data: {
          content: data.content,
          language: data.language || 'FR',
          recordedBy,
          recordedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          recorder: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } else {
      return this.prisma.meetingMinutes.create({
        data: {
          meetingId,
          content: data.content,
          language: data.language || 'FR',
          recordedBy,
          recordedAt: new Date(),
          validated: false,
        },
        include: {
          recorder: {
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
  }

  /**
   * Valide un compte rendu
   */
  async validate(meetingId: string, tenantId: string, validatedBy: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const minutes = await this.prisma.meetingMinutes.findUnique({
      where: { meetingId },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found for this meeting');
    }

    if (minutes.validated) {
      throw new BadRequestException('Minutes are already validated');
    }

    return this.prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        validated: true,
        validatedBy,
        validatedAt: new Date(),
        updatedAt: new Date(),
      },
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
    });
  }

  /**
   * Annule la validation d'un compte rendu
   */
  async unvalidate(meetingId: string, tenantId: string, unvalidatedBy: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const minutes = await this.prisma.meetingMinutes.findUnique({
      where: { meetingId },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found for this meeting');
    }

    if (!minutes.validated) {
      throw new BadRequestException('Minutes are not validated');
    }

    return this.prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        validated: false,
        validatedBy: null,
        validatedAt: null,
        updatedAt: new Date(),
      },
      include: {
        recorder: {
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
}

