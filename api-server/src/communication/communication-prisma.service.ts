/**
 * ============================================================================
 * COMMUNICATION PRISMA SERVICE
 * ============================================================================
 * Gestion des canaux de communication (SMS, EMAIL, WHATSAPP, PUSH)
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CommunicationPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un canal de communication
   */
  async createChannel(tenantId: string, data: {
    code: string;
    name: string;
    isActive?: boolean;
    config?: any;
  }) {
    return this.prisma.communicationChannel.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  /**
   * Récupérer tous les canaux d'un tenant
   */
  async findAllChannels(tenantId: string) {
    return this.prisma.communicationChannel.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Récupérer un canal par ID
   */
  async findChannelById(tenantId: string, id: string) {
    return this.prisma.communicationChannel.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Récupérer un canal par code
   */
  async findChannelByCode(tenantId: string, code: string) {
    return this.prisma.communicationChannel.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
  }

  /**
   * Mettre à jour un canal
   */
  async updateChannel(tenantId: string, id: string, data: {
    name?: string;
    isActive?: boolean;
    config?: any;
  }) {
    return this.prisma.communicationChannel.update({
      where: { id },
      data,
    });
  }

  /**
   * Activer/Désactiver un canal
   */
  async toggleChannel(tenantId: string, id: string, isActive: boolean) {
    return this.prisma.communicationChannel.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Supprimer un canal
   */
  async deleteChannel(tenantId: string, id: string) {
    return this.prisma.communicationChannel.delete({
      where: { id },
    });
  }
}

