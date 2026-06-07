import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AnnouncementStatus } from './entities/announcement.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
// UserRole n'existe plus, utiliser le type string directement
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('communication')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  // Announcements
  @Post('announcements')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  createAnnouncement(
    @Body() createDto: CreateAnnouncementDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationService.createAnnouncement(createDto, tenantId, user.id);
  }

  @Get('announcements')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  findAllAnnouncements(
    @TenantId() tenantId: string,
    @Body() filters?: { schoolLevelId?: string; status?: AnnouncementStatus },
  ) {
    return this.communicationService.findAllAnnouncements(
      tenantId,
      filters?.schoolLevelId,
      filters?.status,
    );
  }

  @Get('announcements/:id')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  findOneAnnouncement(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.communicationService.findOneAnnouncement(id, tenantId);
  }

  @Patch('announcements/:id/publish')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  publishAnnouncement(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationService.publishAnnouncement(id, tenantId, user.id);
  }

  // Messages
  @Post('messages')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  createMessage(
    @Body() createDto: CreateMessageDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationService.createMessage(createDto, tenantId, user.id);
  }

  @Get('messages')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  findAllMessages(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationService.findAllMessages(tenantId, user.id);
  }

  @Patch('messages/:id/read')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  markAsRead(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationService.markMessageAsRead(id, tenantId, user.id);
  }
}

