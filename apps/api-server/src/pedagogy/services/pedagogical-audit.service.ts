/**
 * ============================================================================
 * PEDAGOGICAL AUDIT SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service de traçabilité institutionnelle pour l'espace pédagogique.
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PedagogicalAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une action dans l'audit pédagogique
   */
  async log(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    oldData?: any;
    newData?: any;
  }) {
    return this.prisma.pedagogicalAuditLog.create({
      data: {
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        performedBy: params.performedBy,
        oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
        newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
      },
    });
  }

  /**
   * Récupère l'historique d'audit pour une entité
   */
  async getAuditHistory(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.pedagogicalAuditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
