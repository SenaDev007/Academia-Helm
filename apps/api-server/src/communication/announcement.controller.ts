/**
 * ============================================================================
 * HELM CONNECT — Announcement Controller
 * ============================================================================
 *
 * Endpoints REST pour les annonces officielles Helm Connect.
 *
 *   GET    /chat/announcements                  — liste paginée des annonces
 *   GET    /chat/announcements/:id              — détails d'une annonce
 *   POST   /chat/announcements                  — publier une nouvelle annonce
 *   POST   /chat/announcements/:id/read        — marquer comme lu
 *   POST   /chat/announcements/:id/confirm     — confirmer (si requiresConfirmation)
 *   GET    /chat/announcements/:id/stats       — statistiques de lecture (publishers)
 *   DELETE /chat/announcements/:id             — supprimer (soft delete)
 * ============================================================================
 */

import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { AnnouncementService, AnnouncementPriority, AnnouncementTargetType } from './services/announcement.service';

@Controller('chat/announcements')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  async listAnnouncements(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('onlyPublished') onlyPublished?: string,
    @Query('targetType') targetType?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.announcementService.listAnnouncements(tenantId, userId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      onlyPublished: onlyPublished === 'true',
      targetType: targetType as AnnouncementTargetType | undefined,
    });
  }

  @Get(':id')
  async getAnnouncement(
    @TenantId() tenantId: string,
    @Param('id') announcementId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.announcementService.getAnnouncement(tenantId, announcementId, userId);
  }

  @Post()
  async createAnnouncement(
    @TenantId() tenantId: string,
    @Body() body: {
      authorId: string;
      title: string;
      body: string;
      priority?: AnnouncementPriority;
      targetType: AnnouncementTargetType;
      targetClassId?: string;
      targetLevel?: string;
      targetGroupId?: string;
      targetChannelId?: string;
      attachments?: Array<{ url: string; name: string; size?: number; mime?: string }>;
      requiresConfirmation?: boolean;
      publishNow?: boolean;
      scheduledAt?: string;             // ⭐ V2.1 — ISO date string for scheduled publish
      expiresAt?: string;
    },
  ) {
    if (!body.authorId) throw new BadRequestException('authorId is required');
    return this.announcementService.createAnnouncement(tenantId, body.authorId, {
      title: body.title,
      body: body.body,
      priority: body.priority,
      targetType: body.targetType,
      targetClassId: body.targetClassId,
      targetLevel: body.targetLevel,
      targetGroupId: body.targetGroupId,
      targetChannelId: body.targetChannelId,
      attachments: body.attachments,
      requiresConfirmation: body.requiresConfirmation,
      publishNow: body.publishNow,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Post(':id/read')
  async markAsRead(
    @TenantId() tenantId: string,
    @Param('id') announcementId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.announcementService.markAsRead(tenantId, body.userId, announcementId, false);
  }

  @Post(':id/confirm')
  async confirmRead(
    @TenantId() tenantId: string,
    @Param('id') announcementId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.announcementService.markAsRead(tenantId, body.userId, announcementId, true);
  }

  @Get(':id/stats')
  async getStats(
    @TenantId() tenantId: string,
    @Param('id') announcementId: string,
  ) {
    return this.announcementService.getReadStats(tenantId, announcementId);
  }

  @Delete(':id')
  async deleteAnnouncement(
    @TenantId() tenantId: string,
    @Param('id') announcementId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.announcementService.deleteAnnouncement(tenantId, userId, announcementId);
  }
}
