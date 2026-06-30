/**
 * ============================================================================
 * NOTIFICATIONS CONTROLLER — Cloche header (in-app notifications)
 * ============================================================================
 *
 * Endpoints REST pour le frontend :
 *   GET    /notifications                — liste (filtre ?unread=true, pagination)
 *   GET    /notifications/unread-count   — compteur non lues
 *   PATCH  /notifications/:id/read       — marquer comme lue
 *   PATCH  /notifications/read-all       — tout marquer comme lu
 *   DELETE /notifications/:id            — supprimer
 *
 * Auth : JwtAuthGuard + tenant scope (le recipientId = userId courant).
 * ============================================================================
 */

import {
  Controller, Get, Patch, Delete, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications?unread=true&limit=20&offset=0
   * Liste les notifications de l'utilisateur courant.
   */
  @Get()
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    return this.notificationService.listForUser(tenantId, user.id, {
      onlyUnread: unread === 'true',
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * GET /notifications/unread-count → { count: number }
   */
  @Get('unread-count')
  async unreadCount(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    const count = await this.notificationService.unreadCount(tenantId, user.id);
    return { count };
  }

  /**
   * PATCH /notifications/:id/read — marquer comme lue
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    await this.notificationService.markAsRead(id, user.id);
    return { success: true };
  }

  /**
   * PATCH /notifications/read-all — tout marquer comme lu
   */
  @Patch('read-all')
  async markAllAsRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    await this.notificationService.markAllAsRead(tenantId, user.id);
    return { success: true };
  }

  /**
   * DELETE /notifications/:id — supprimer
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    await this.notificationService.delete(id, user.id);
    return { success: true };
  }
}
