/**
 * ============================================================================
 * ACCESS DENIED LOG SERVICE - TRACAGE DES REFUS D'ACCÈS
 * ============================================================================
 * 
 * Service pour tracer tous les refus d'accès pour audit et sécurité.
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';

export interface AccessDeniedLog {
  userId: string;
  userEmail: string;
  userRole: string;
  module: Module;
  action: PermissionAction;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}

@Injectable()
export class AccessDeniedLogService {
  private readonly logger = new Logger(AccessDeniedLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trace un refus d'accès
   */
  async log(logData: AccessDeniedLog, tenantId?: string): Promise<void> {
    try {
      // tenantId est obligatoire dans le schéma Prisma
      // Si non fourni, on ne peut pas logger (mais on ne fait pas échouer la requête)
      if (!tenantId) {
        this.logger.warn('Cannot log access denied: tenantId is required but not provided');
        return;
      }

      // Créer un log dans la table AuditLog avec un type spécial
      await this.prisma.auditLog.create({
        data: {
          tenantId, // ✅ Obligatoire - récupéré depuis le contexte
          userId: logData.userId,
          action: 'ACCESS_DENIED',
          resource: logData.module,
          resourceId: null,
          tableName: 'audit_logs', // ✅ Obligatoire selon le schéma Prisma
          recordId: null,
          changes: {
            reason: logData.reason,
            requestedAction: logData.action,
            userRole: logData.userRole,
            userEmail: logData.userEmail,
          },
          ipAddress: logData.ipAddress || null,
          userAgent: logData.userAgent || null,
        },
      });

      this.logger.debug(
        `🚫 Access denied logged: ${logData.userEmail} (${logData.userRole}) - ${logData.action} on ${logData.module}`,
      );
    } catch (error) {
      // Ne pas faire échouer la requête si le log échoue
      this.logger.error('Failed to log access denied', error);
    }
  }

  /**
   * Récupère les refus d'accès récents
   */
  async getRecentAccessDenials(limit: number = 100) {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          action: 'ACCESS_DENIED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get recent access denials', error);
      return [];
    }
  }

  /**
   * Récupère les refus d'accès pour un utilisateur
   */
  async getAccessDenialsForUser(userId: string, limit: number = 50) {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          action: 'ACCESS_DENIED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get access denials for user', error);
      return [];
    }
  }
}
