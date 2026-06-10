/**
 * ============================================================================
 * SCHEDULING PRISMA SERVICE
 * ============================================================================
 * Gestion de la planification des messages
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SchedulingPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Planifier un message
   */
  async scheduleMessage(messageId: string, scheduledAt: Date) {
    return this.prisma.scheduledMessage.create({
      data: {
        messageId,
        scheduledAt,
        status: 'PENDING',
      },
      include: {
        message: {
          include: {
            channel: true,
            sender: { select: { id: true, firstName: true, lastName: true } },
            targets: true,
          },
        },
      },
    });
  }

  /**
   * Récupérer les messages planifiés
   */
  async findScheduledMessages(tenantId: string, filters?: {
    status?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: any = {
      message: { tenantId },
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.fromDate || filters?.toDate) {
      where.scheduledAt = {};
      if (filters.fromDate) {
        where.scheduledAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.scheduledAt.lte = filters.toDate;
      }
    }

    return this.prisma.scheduledMessage.findMany({
      where,
      include: {
        message: {
          include: {
            channel: true,
            sender: { select: { id: true, firstName: true, lastName: true } },
            targets: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Récupérer les messages planifiés à envoyer maintenant
   */
  async findPendingScheduledMessages(tenantId: string) {
    const now = new Date();
    return this.prisma.scheduledMessage.findMany({
      where: {
        message: { tenantId },
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      include: {
        message: {
          include: {
            channel: true,
            sender: { select: { id: true, firstName: true, lastName: true } },
            targets: true,
            recipients: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Mettre à jour le statut d'un message planifié
   */
  async updateScheduledMessageStatus(messageId: string, status: string, errorMessage?: string) {
    return this.prisma.scheduledMessage.update({
      where: { messageId },
      data: {
        status,
        sentAt: status === 'SENT' ? new Date() : undefined,
        errorMessage,
      },
    });
  }

  /**
   * Annuler un message planifié
   */
  async cancelScheduledMessage(messageId: string) {
    return this.prisma.scheduledMessage.update({
      where: { messageId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * Supprimer un message planifié
   */
  async deleteScheduledMessage(messageId: string) {
    return this.prisma.scheduledMessage.delete({
      where: { messageId },
    });
  }
}

