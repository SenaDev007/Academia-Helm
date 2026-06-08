import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la gestion des ordres du jour des réunions
 */
@Injectable()
export class MeetingAgendasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère tous les points d'ordre du jour d'une réunion
   */
  async findByMeeting(meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    return this.prisma.meetingAgenda.findMany({
      where: { meetingId },
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
      orderBy: { agendaOrder: 'asc' },
    });
  }

  /**
   * Ajoute un point à l'ordre du jour
   */
  async addAgendaItem(
    meetingId: string,
    tenantId: string,
    data: {
      topic: string;
      description?: string;
      presenterId?: string;
      durationMinutes?: number;
      agendaOrder?: number;
    },
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Vérifier que la réunion n'est pas déjà tenue
    if (meeting.status === 'HELD') {
      throw new BadRequestException('Cannot add agenda items to a meeting that has already been held');
    }

    // Si agendaOrder n'est pas fourni, calculer automatiquement
    let agendaOrder = data.agendaOrder;
    if (!agendaOrder) {
      const existingAgendas = await this.prisma.meetingAgenda.findMany({
        where: { meetingId },
        orderBy: { agendaOrder: 'desc' },
        take: 1,
      });
      agendaOrder = existingAgendas.length > 0 ? existingAgendas[0].agendaOrder + 1 : 0;
    }

    return this.prisma.meetingAgenda.create({
      data: {
        meetingId,
        topic: data.topic,
        description: data.description,
        presenterId: data.presenterId || null,
        durationMinutes: data.durationMinutes || null,
        agendaOrder,
        status: 'PLANNED',
      },
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
    });
  }

  /**
   * Met à jour un point de l'ordre du jour
   */
  async updateAgendaItem(
    id: string,
    meetingId: string,
    tenantId: string,
    data: {
      topic?: string;
      description?: string;
      presenterId?: string;
      durationMinutes?: number;
      agendaOrder?: number;
      status?: string; // PLANNED | COVERED | SKIPPED
      notes?: string;
    },
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const agendaItem = await this.prisma.meetingAgenda.findFirst({
      where: { id, meetingId },
    });

    if (!agendaItem) {
      throw new NotFoundException('Agenda item not found');
    }

    return this.prisma.meetingAgenda.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
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
    });
  }

  /**
   * Supprime un point de l'ordre du jour
   */
  async deleteAgendaItem(id: string, meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Vérifier que la réunion n'est pas déjà tenue
    if (meeting.status === 'HELD') {
      throw new BadRequestException('Cannot delete agenda items from a meeting that has already been held');
    }

    const agendaItem = await this.prisma.meetingAgenda.findFirst({
      where: { id, meetingId },
    });

    if (!agendaItem) {
      throw new NotFoundException('Agenda item not found');
    }

    return this.prisma.meetingAgenda.delete({
      where: { id },
    });
  }

  /**
   * Réorganise l'ordre du jour
   */
  async reorderAgendaItems(meetingId: string, tenantId: string, agendaItemIds: string[]) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Vérifier que la réunion n'est pas déjà tenue
    if (meeting.status === 'HELD') {
      throw new BadRequestException('Cannot reorder agenda items for a meeting that has already been held');
    }

    // Mettre à jour l'ordre de chaque point
    const updates = agendaItemIds.map((itemId, index) =>
      this.prisma.meetingAgenda.update({
        where: { id: itemId },
        data: { agendaOrder: index },
      }),
    );

    await Promise.all(updates);

    return this.findByMeeting(meetingId, tenantId);
  }
}

