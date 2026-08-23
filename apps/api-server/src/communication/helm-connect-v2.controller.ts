/**
 * ============================================================================
 * HELM CONNECT V2 — Controller (Dynamic Groups + Notifications + Scheduled Announcements)
 * ============================================================================
 *
 * Endpoints REST pour V2.
 *
 *   Dynamic Groups :
 *     GET    /chat/v2/dynamic-groups                              — list
 *     POST   /chat/v2/dynamic-groups                              — create
 *     GET    /chat/v2/dynamic-groups/:id                          — details
 *     POST   /chat/v2/dynamic-groups/:id/sync                     — re-sync members
 *     POST   /chat/v2/dynamic-groups/sync-all                     — re-sync all (admin/cron)
 *
 *   Notification Preferences :
 *     GET    /chat/v2/notifications/preferences                   — get my prefs
 *     PUT    /chat/v2/notifications/preferences                   — update prefs
 *     POST   /chat/v2/notifications/dnd/enable                     — enable DND (1H/8H/24H/FOREVER)
 *     POST   /chat/v2/notifications/dnd/disable                   — disable DND
 *     POST   /chat/v2/notifications/conversations/:id/mute        — mute conversation
 *     POST   /chat/v2/notifications/conversations/:id/unmute      — unmute conversation
 *     GET    /chat/v2/notifications/muted-conversations           — list muted
 *     GET    /chat/v2/notifications/should-notify?eventType=X&conversationId=Y  — debug
 *
 *   Scheduled Announcements :
 *     POST   /chat/v2/announcements/dispatch                      — run dispatcher (admin/cron)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { DynamicGroupService, DynamicGroupSourceType } from './services/dynamic-group.service';
import { NotificationPreferencesService, MuteDuration, EventType } from './services/notification-preferences.service';
import { ScheduledAnnouncementDispatcher } from './services/scheduled-announcement-dispatcher';

@Controller('chat/v2')
@UseGuards(JwtAuthGuard, TenantGuard)
export class HelmConnectV2Controller {
  constructor(
    private readonly dynamicGroupService: DynamicGroupService,
    private readonly notifPrefsService: NotificationPreferencesService,
    private readonly scheduledDispatcher: ScheduledAnnouncementDispatcher,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  DYNAMIC GROUPS
  // ═════════════════════════════════════════════════════════════════
  @Get('dynamic-groups')
  async listDynamicGroups(
    @TenantId() tenantId: string,
    @Query('sourceType') sourceType?: string,
  ) {
    return this.dynamicGroupService.listDynamicGroups(tenantId, {
      sourceType: sourceType as DynamicGroupSourceType | undefined,
    });
  }

  @Post('dynamic-groups')
  async createDynamicGroup(
    @TenantId() tenantId: string,
    @Body() body: {
      creatorId: string;
      sourceType: DynamicGroupSourceType;
      sourceClassId?: string;
      sourceLevel?: string;
      sourceSubjectId?: string;
      sourceRole?: string;
      academicYearId?: string;
      displayName?: string;
      description?: string;
    },
  ) {
    if (!body.creatorId) throw new BadRequestException('creatorId is required');
    if (!body.sourceType) throw new BadRequestException('sourceType is required');
    return this.dynamicGroupService.createDynamicGroup(tenantId, body.creatorId, {
      sourceType: body.sourceType,
      sourceClassId: body.sourceClassId,
      sourceLevel: body.sourceLevel,
      sourceSubjectId: body.sourceSubjectId,
      sourceRole: body.sourceRole,
      academicYearId: body.academicYearId,
      displayName: body.displayName,
      description: body.description,
    });
  }

  @Get('dynamic-groups/:id')
  async getDynamicGroup(
    @TenantId() tenantId: string,
    @Param('id') groupId: string,
  ) {
    return this.dynamicGroupService.getDynamicGroup(tenantId, groupId);
  }

  @Post('dynamic-groups/:id/sync')
  async syncDynamicGroup(
    @TenantId() tenantId: string,
    @Param('id') groupId: string,
  ) {
    return this.dynamicGroupService.syncDynamicGroup(tenantId, groupId);
  }

  @Post('dynamic-groups/sync-all')
  async syncAllDynamicGroups(@TenantId() tenantId?: string) {
    return this.dynamicGroupService.syncAllDynamicGroups(tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  NOTIFICATION PREFERENCES
  // ═════════════════════════════════════════════════════════════════
  @Get('notifications/preferences')
  async getPreferences(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.getPreferences(userId, tenantId);
  }

  @Put('notifications/preferences')
  async updatePreferences(
    @TenantId() tenantId: string,
    @Body() body: { userId: string } & Partial<{
      dndEnabled: boolean;
      dndUntil: string | null;
      dndExceptions: string[];
      enableMessages: boolean;
      enableGroupMessages: boolean;
      enableAnnouncements: boolean;
      enableMentions: boolean;
      enableFiles: boolean;
      enableInvitations: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      timezone: string;
    }>,
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    const { userId, ...updates } = body;
    return this.notifPrefsService.updatePreferences(userId, tenantId, {
      ...updates,
      dndUntil: body.dndUntil ? new Date(body.dndUntil) : body.dndUntil === null ? null : undefined,
    });
  }

  @Post('notifications/dnd/enable')
  async enableDnd(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; duration: MuteDuration; exceptions?: string[] },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.duration) throw new BadRequestException('duration is required (1H/8H/24H/FOREVER)');
    return this.notifPrefsService.enableDnd(body.userId, tenantId, body.duration, body.exceptions);
  }

  @Post('notifications/dnd/disable')
  async disableDnd(
    @Body() body: { userId: string },
    @TenantId() tenantId: string,
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.disableDnd(body.userId, tenantId);
  }

  @Post('notifications/conversations/:id/mute')
  async muteConversation(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string; duration: MuteDuration },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.duration) throw new BadRequestException('duration is required (1H/8H/24H/FOREVER)');
    return this.notifPrefsService.muteConversation(body.userId, tenantId, conversationId, body.duration);
  }

  @Post('notifications/conversations/:id/unmute')
  async unmuteConversation(
    @Param('id') conversationId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.unmuteConversation(body.userId, conversationId);
  }

  @Get('notifications/muted-conversations')
  async getMutedConversations(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.getMutedConversations(userId);
  }

  @Get('notifications/should-notify')
  async shouldNotify(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('eventType') eventType: EventType,
    @Query('conversationId') conversationId?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!eventType) throw new BadRequestException('eventType is required');
    return this.notifPrefsService.shouldNotifyUser(userId, tenantId, eventType, conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  SCHEDULED ANNOUNCEMENTS DISPATCHER
  // ═════════════════════════════════════════════════════════════════
  @Post('announcements/dispatch')
  async dispatchScheduledAnnouncements() {
    return this.scheduledDispatcher.dispatchDueAnnouncements();
  }
}
