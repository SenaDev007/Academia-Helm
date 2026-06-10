import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la gestion des décisions prises lors des réunions
 */
@Injectable()
export class MeetingDecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les décisions d'une réunion
   */
  async findByMeeting(meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    return this.prisma.meetingDecision.findMany({
      where: { meetingId },
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
      orderBy: { decisionOrder: 'asc' },
    });
  }

  /**
   * Crée une nouvelle décision
   */
  async create(
    meetingId: string,
    tenantId: string,
    data: {
      decisionText: string;
      responsibleId?: string;
      dueDate?: Date;
      decisionOrder?: number;
    },
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
      throw new BadRequestException('Cannot create decisions for a cancelled meeting');
    }

    // Si decisionOrder n'est pas fourni, calculer automatiquement
    let decisionOrder = data.decisionOrder;
    if (decisionOrder === undefined) {
      const existingDecisions = await this.prisma.meetingDecision.findMany({
        where: { meetingId },
        orderBy: { decisionOrder: 'desc' },
        take: 1,
      });
      decisionOrder = existingDecisions.length > 0 ? existingDecisions[0].decisionOrder + 1 : 0;
    }

    return this.prisma.meetingDecision.create({
      data: {
        meetingId,
        decisionText: data.decisionText,
        responsibleId: data.responsibleId || null,
        dueDate: data.dueDate || null,
        decisionOrder,
        status: 'PENDING',
      },
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
    });
  }

  /**
   * Met à jour une décision
   */
  async update(
    id: string,
    meetingId: string,
    tenantId: string,
    data: {
      decisionText?: string;
      responsibleId?: string;
      dueDate?: Date;
      status?: string; // PENDING | IN_PROGRESS | DONE | CANCELLED
      completionNotes?: string;
    },
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const decision = await this.prisma.meetingDecision.findFirst({
      where: { id, meetingId },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    // Si le statut passe à DONE, enregistrer la date de completion
    const updateData: any = { ...data };
    if (data.status === 'DONE' && decision.status !== 'DONE') {
      updateData.completionDate = new Date();
    } else if (data.status !== 'DONE' && decision.status === 'DONE') {
      updateData.completionDate = null;
    }

    return this.prisma.meetingDecision.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
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
    });
  }

  /**
   * Supprime une décision
   */
  async delete(id: string, meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const decision = await this.prisma.meetingDecision.findFirst({
      where: { id, meetingId },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    return this.prisma.meetingDecision.delete({
      where: { id },
    });
  }

  /**
   * Récupère les décisions en retard
   */
  async getOverdueDecisions(tenantId: string, academicYearId?: string) {
    const where: any = {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { lt: new Date() },
      meeting: {
        tenantId,
      },
    };

    if (academicYearId) {
      where.meeting.academicYearId = academicYearId;
    }

    return this.prisma.meetingDecision.findMany({
      where,
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            meetingDate: true,
            meetingType: true,
          },
        },
        responsible: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Récupère les statistiques des décisions
   */
  async getDecisionStats(tenantId: string, academicYearId?: string) {
    const where: any = {
      meeting: {
        tenantId,
      },
    };

    if (academicYearId) {
      where.meeting.academicYearId = academicYearId;
    }

    const decisions = await this.prisma.meetingDecision.findMany({
      where,
    });

    const total = decisions.length;
    const pending = decisions.filter((d) => d.status === 'PENDING').length;
    const inProgress = decisions.filter((d) => d.status === 'IN_PROGRESS').length;
    const done = decisions.filter((d) => d.status === 'DONE').length;
    const cancelled = decisions.filter((d) => d.status === 'CANCELLED').length;

    const now = new Date();
    const overdue = decisions.filter(
      (d) =>
        (d.status === 'PENDING' || d.status === 'IN_PROGRESS') &&
        d.dueDate &&
        d.dueDate < now,
    ).length;

    return {
      total,
      pending,
      inProgress,
      done,
      cancelled,
      overdue,
      completionRate: total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0,
    };
  }
}

