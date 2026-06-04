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
import {
  CreateAnnouncementV2Dto,
  CreateConversationV2Dto,
  SendMessageV2Dto,
  CreateTemplateV2Dto,
  DashboardQueryV2Dto,
} from './dto/v2.dto';

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
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  getDashboardStats(@TenantId() tenantId: string, @Query() query: DashboardQueryV2Dto) {
    return this.dashboardService.getDashboardStats(tenantId, query);
  }

  // ANNOUNCEMENTS
  @Post('announcements')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  createAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() data: CreateAnnouncementV2Dto) {
    return this.announcementsService.create(tenantId, user.id, data);
  }

  @Get('announcements')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR', 'SECRETAIRE', 'CENSEUR', 'SURVEILLANT', 'ENSEIGNANT', 'ELEVE', 'PARENT')
  getAnnouncements(@TenantId() tenantId: string, @Query() filters: DashboardQueryV2Dto) {
    return this.announcementsService.findAll(tenantId, filters);
  }

  @Get('announcements/:id')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR', 'SECRETAIRE', 'CENSEUR', 'SURVEILLANT', 'ENSEIGNANT', 'ELEVE', 'PARENT')
  getAnnouncement(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.announcementsService.findOne(tenantId, id);
  }

  @Patch('announcements/:id/publish')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  publishAnnouncement(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.announcementsService.publish(tenantId, id);
  }

  // MESSAGING
  @Post('conversations')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR', 'SECRETAIRE', 'CENSEUR', 'SURVEILLANT', 'ENSEIGNANT', 'ELEVE', 'PARENT')
  createConversation(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() data: CreateConversationV2Dto) {
    return this.messagingService.createConversation(tenantId, user.id, data);
  }

  @Get('conversations')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR', 'SECRETAIRE', 'CENSEUR', 'SURVEILLANT', 'ENSEIGNANT', 'ELEVE', 'PARENT')
  getConversations(@TenantId() tenantId: string, @CurrentUser() user: any) {
    return this.messagingService.getConversations(tenantId, user.id);
  }

  @Get('conversations/:id/messages')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR', 'SECRETAIRE', 'CENSEUR', 'SURVEILLANT', 'ENSEIGNANT', 'ELEVE', 'PARENT')
  getMessages(@TenantId() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.messagingService.getMessages(tenantId, user.id, id);
  }

  @Post('messages')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR', 'SECRETAIRE', 'CENSEUR', 'SURVEILLANT', 'ENSEIGNANT', 'ELEVE', 'PARENT')
  sendMessage(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() data: SendMessageV2Dto) {
    return this.messagingService.sendMessage(tenantId, user.id, data);
  }

  // TEMPLATES
  @Get('templates')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  getTemplates(@TenantId() tenantId: string, @Query() filters: DashboardQueryV2Dto) {
    return this.templateService.findAll(tenantId, filters);
  }

  @Post('templates')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  createTemplate(@TenantId() tenantId: string, @Body() data: CreateTemplateV2Dto) {
    return this.templateService.create(tenantId, data);
  }
}
