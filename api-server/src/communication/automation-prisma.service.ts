/**
 * ============================================================================
 * AUTOMATION PRISMA SERVICE
 * ============================================================================
 * Gestion des déclencheurs automatisés
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AutomationPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un déclencheur automatisé
   */
  async createTrigger(tenantId: string, data: {
    academicYearId?: string;
    schoolLevelId?: string;
    triggerType: string;
    channelId: string;
    templateId?: string;
    conditions?: any;
    isActive?: boolean;
  }) {
    return this.prisma.automatedTrigger.create({
      data: {
        tenantId,
        ...data,
      },
      include: {
        channel: true,
        template: true,
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
    });
  }

  /**
   * Récupérer tous les déclencheurs d'un tenant
   */
  async findAllTriggers(tenantId: string, filters?: {
    academicYearId?: string;
    schoolLevelId?: string;
    triggerType?: string;
    isActive?: boolean;
  }) {
    return this.prisma.automatedTrigger.findMany({
      where: {
        tenantId,
        ...filters,
      },
      include: {
        channel: true,
        template: true,
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupérer un déclencheur par ID
   */
  async findTriggerById(tenantId: string, id: string) {
    return this.prisma.automatedTrigger.findFirst({
      where: { id, tenantId },
      include: {
        channel: true,
        template: true,
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
    });
  }

  /**
   * Récupérer les déclencheurs actifs par type
   */
  async findActiveTriggersByType(tenantId: string, triggerType: string) {
    return this.prisma.automatedTrigger.findMany({
      where: {
        tenantId,
        triggerType,
        isActive: true,
      },
      include: {
        channel: true,
        template: true,
        academicYear: { select: { id: true, label: true } },
        schoolLevel: { select: { id: true, code: true, label: true } },
      },
    });
  }

  /**
   * Mettre à jour un déclencheur
   */
  async updateTrigger(tenantId: string, id: string, data: {
    channelId?: string;
    templateId?: string;
    conditions?: any;
    isActive?: boolean;
  }) {
    return this.prisma.automatedTrigger.update({
      where: { id },
      data,
    });
  }

  /**
   * Activer/Désactiver un déclencheur
   */
  async toggleTrigger(tenantId: string, id: string, isActive: boolean) {
    return this.prisma.automatedTrigger.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Mettre à jour le compteur et la date du dernier déclenchement
   */
  async recordTriggerExecution(id: string) {
    return this.prisma.automatedTrigger.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });
  }

  /**
   * Supprimer un déclencheur
   */
  async deleteTrigger(tenantId: string, id: string) {
    return this.prisma.automatedTrigger.delete({
      where: { id },
    });
  }
}

