/**
 * ============================================================================
 * PORTAL LOG CONTROLLER - ACADEMIA HUB
 * ============================================================================
 * 
 * Contrôleur pour logger les redirections et accès tenant
 * Utilisé pour analytics et audit de sécurité
 * 
 * ============================================================================
 */

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('portal')
export class PortalLogController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log une redirection tenant
   * 
   * POST /portal/redirect-log
   */
  @Post('redirect-log')
  @HttpCode(HttpStatus.OK)
  async logRedirect(@Body() body: any) {
    try {
      // Log dans la base de données (table audit_logs ou table dédiée)
      await this.prisma.auditLog.create({
        data: {
          tenantId: body.tenantId || null,
          action: 'TENANT_REDIRECT',
          resource: 'TENANT',
          resourceId: body.tenantId || null,
          tableName: 'tenants',
          recordId: body.tenantId || null,
          newData: {
            tenantSlug: body.tenantSlug,
            fromUrl: body.fromUrl,
            toUrl: body.toUrl,
            method: body.method,
            environment: body.environment,
          },
          userAgent: body.userAgent,
          ipAddress: body.ipAddress,
          userId: null, // Peut être null si pas encore authentifié
          createdAt: new Date(body.timestamp || new Date()),
        },
      });

      return { success: true, logged: true };
    } catch (error) {
      console.error('Error logging redirect:', error);
      // Ne pas échouer la requête si le logging échoue
      return { success: true, logged: false };
    }
  }

  /**
   * Log une tentative d'accès à une route protégée
   * 
   * POST /portal/access-log
   */
  @Post('access-log')
  @HttpCode(HttpStatus.OK)
  async logAccess(@Body() body: any) {
    try {
      // Déterminer le niveau de log selon la raison
      const logLevel = body.reason === 'SUCCESS' ? 'INFO' : 'WARNING';
      
      await this.prisma.auditLog.create({
        data: {
          tenantId: body.tenantId || null,
          action: 'TENANT_ACCESS_ATTEMPT',
          resource: 'TENANT',
          resourceId: body.tenantId || null,
          tableName: 'tenants',
          recordId: body.tenantId || null,
          newData: {
            path: body.path,
            reason: body.reason,
            tenantIdentifier: body.tenantIdentifier,
            tenantSlug: body.tenantSlug,
            logLevel,
          },
          userAgent: body.userAgent,
          ipAddress: body.ipAddress,
          userId: body.userId || null,
          createdAt: new Date(body.timestamp || new Date()),
        },
      });

      // Si c'est une tentative suspecte, logger avec plus de détails
      if (body.reason === 'NO_TENANT' || body.reason === 'TENANT_NOT_FOUND') {
        console.warn('[Portal Access] Suspicious access attempt:', {
          path: body.path,
          reason: body.reason,
          ipAddress: body.ipAddress,
          userAgent: body.userAgent,
        });
      }

      return { success: true, logged: true };
    } catch (error) {
      console.error('Error logging access:', error);
      // Ne pas échouer la requête si le logging échoue
      return { success: true, logged: false };
    }
  }
}
