import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CommunicationDashboardService } from './services/communication-dashboard.service';
import { InternalMessagingService } from './services/internal-messaging.service';
import { AnnouncementsServiceV2 } from './services/announcements.service';
import { TemplateService } from './services/template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('communication/v2')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationV2Controller {
  constructor(
    private readonly dashboardService: CommunicationDashboardService,
    private readonly messagingService: InternalMessagingService,
    private readonly announcementsService: AnnouncementsServiceV2,
    private readonly templateService: TemplateService,
  ) {}

  // DASHBOARD
  @Get('dashboard/stats')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  getDashboardStats(@TenantId() tenantId: string, @Query() query: any) {
    return this.dashboardService.getDashboardStats(tenantId, query);
  }

  // ANNOUNCEMENTS
  @Post('announcements')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  createAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.announcementsService.create(tenantId, user.id, data);
  }

  @Get('announcements')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  getAnnouncements(@TenantId() tenantId: string, @Query() filters: any) {
    return this.announcementsService.findAll(tenantId, filters);
  }

  @Get('announcements/:id')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  getAnnouncement(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.announcementsService.findOne(tenantId, id);
  }

  @Patch('announcements/:id/publish')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  publishAnnouncement(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.announcementsService.publish(tenantId, id);
  }

  // MESSAGING
  @Post('conversations')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  createConversation(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.messagingService.createConversation(tenantId, user.id, data);
  }

  @Get('conversations')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  getConversations(@TenantId() tenantId: string, @CurrentUser() user: any) {
    return this.messagingService.getConversations(tenantId, user.id);
  }

  @Get('conversations/:id/messages')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  getMessages(@TenantId() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.messagingService.getMessages(tenantId, user.id, id);
  }

  @Post('messages')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  sendMessage(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.messagingService.sendMessage(tenantId, user.id, data);
  }

  // TEMPLATES
  @Get('templates')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  getTemplates(@TenantId() tenantId: string, @Query() filters: any) {
    return this.templateService.findAll(tenantId, filters);
  }

  @Post('templates')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  createTemplate(@TenantId() tenantId: string, @Body() data: any) {
    return this.templateService.create(tenantId, data);
  }
}
