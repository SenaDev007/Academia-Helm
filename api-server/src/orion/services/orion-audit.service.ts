/**
 * ============================================================================
 * ORION AUDIT SERVICE - MODULE 8
 * ============================================================================
 * Service pour logger les accès ORION (qui a vu quoi)
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrionAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log un accès ORION
   */
  async logAccess(tenantId: string, data: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    return this.prisma.orionAuditLog.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  /**
   * Récupère les logs d'audit pour un tenant
   */
  async findAuditLogs(tenantId: string, filters?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: any = { tenantId };
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.resourceType) {
      where.resourceType = filters.resourceType;
    }
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.createdAt.lte = filters.toDate;
      }
    }

    return this.prisma.orionAuditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  /**
   * Récupère les statistiques d'accès
   */
  async getAccessStats(tenantId: string, fromDate?: Date, toDate?: Date) {
    const where: any = { tenantId };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = fromDate;
      }
      if (toDate) {
        where.createdAt.lte = toDate;
      }
    }

    const logs = await this.prisma.orionAuditLog.findMany({
      where,
      select: {
        action: true,
        resourceType: true,
        userId: true,
        createdAt: true,
      },
    });

    // Statistiques par action
    const actionStats = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Statistiques par ressource
    const resourceStats = logs.reduce((acc, log) => {
      if (log.resourceType) {
        acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Utilisateurs actifs
    const uniqueUsers = new Set(logs.map(log => log.userId).filter(Boolean));

    return {
      totalAccesses: logs.length,
      uniqueUsers: uniqueUsers.size,
      actionStats,
      resourceStats,
    };
  }
}

